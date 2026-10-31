
import {
  calculateCommission,
  CommissionError,
  type PlanRule,
} from "../domain/commission";
import {
  formatBRL,
  isValidCents,
  type Cents,
} from "../domain/money";
import { validateRanges as validateDomainRanges } from "../domain/ranges";

export type CommissionRange = {
  id: number;
  min_sales: number;
  max_sales: number | null;
  commission_rate: number;
};

export type CommissionEstimate =
  | {
      ok: true;
      range: CommissionRange | null;
      amount: number | null;
    }
  | {
      ok: false;
      error: string;
    };

function toCents(value: number, field: string): Cents {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field}: valor monetário inválido.`);
  }

  const cents = Math.round(value * 100);

  if (!isValidCents(cents)) {
    throw new RangeError(`${field}: valor fora do limite permitido.`);
  }

  if (Math.abs(value - cents / 100) > 1e-7) {
    throw new RangeError(
      `${field}: informe um valor com no máximo duas casas decimais.`,
    );
  }

  return cents;
}

function toBasisPoints(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new RangeError("A comissão deve estar entre 0% e 100%.");
  }

  const scaled = rate * 100;
  const basisPoints = Math.round(scaled);

  if (Math.abs(scaled - basisPoints) > 1e-8) {
    throw new RangeError(
      "A taxa de comissão deve ter no máximo duas casas decimais.",
    );
  }

  return basisPoints;
}

/**
 * Converte as faixas da tela/banco para a representação do domínio
 * e reutiliza a validação oficial de continuidade.
 */
export function validateCommissionRanges(
  ranges: CommissionRange[],
): string | null {
  if (ranges.length === 0) return null;

  const tiers: { min: Cents; max: Cents | null }[] = [];

  for (const [index, range] of ranges.entries()) {
    try {
      const min = toCents(range.min_sales, "Limite mínimo");
      const max =
        range.max_sales === null
          ? null
          : toCents(range.max_sales, "Limite máximo");

      toBasisPoints(range.commission_rate);

      tiers.push({ min, max });
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "valor inválido.";

      return `Faixa ${index + 1}: ${reason}`;
    }
  }

  const issues = validateDomainRanges(tiers, {
    contiguous: true,
    format: formatBRL,
  });

  return issues[0]?.message ?? null;
}

function buildTierRule(ranges: CommissionRange[]) {
  const ordered = [...ranges].sort(
    (a, b) => a.min_sales - b.min_sales,
  );

  const tiers = ordered.map((range) => ({
    min: toCents(range.min_sales, "Limite mínimo"),
    max:
      range.max_sales === null
        ? null
        : toCents(range.max_sales, "Limite máximo"),
    rateBps: toBasisPoints(range.commission_rate),
  }));

  const rule: PlanRule = {
    kind: "tiers",
    base: "total",
    requireContinuous: true,
    tiers,
  };

  return { ordered, rule };
}

/**
 * Seleciona a faixa usando as regras do domínio.
 * A regra atual do banco aplica a taxa da faixa ao faturamento total.
 */
export function getCommissionRange(
  monthTotal: number,
  ranges: CommissionRange[],
): CommissionRange | null {
  if (ranges.length === 0) return null;

  const revenueCents = toCents(
    monthTotal,
    "Faturamento mensal",
  );

  const { ordered, rule } = buildTierRule(ranges);

  try {
    const result = calculateCommission(rule, {
      revenueCents,
      salesCount: null,
    });

    if (result.tierIndex === null) return null;

    return ordered[result.tierIndex] ?? null;
  } catch (error) {
    if (
      error instanceof CommissionError &&
      error.code === "no_applicable_rule"
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Calcula a comissão com dinheiro em centavos e
 * arredondamento definido no domínio.
 */
export function calculateEstimatedCommission(
  monthTotal: number,
  range: CommissionRange | null,
): number | null {
  if (!range) return null;

  const result = calculateCommission(
    {
      kind: "percentage",
      rateBps: toBasisPoints(range.commission_rate),
    },
    {
      revenueCents: toCents(
        monthTotal,
        "Faturamento mensal",
      ),
      salesCount: null,
    },
  );

  return result.commissionCents / 100;
}

/**
 * Ponto seguro para as telas.
 * Uma configuração inválida retorna um erro controlado,
 * em vez de lançar uma exceção durante a renderização.
 */
export function getCommissionEstimate(
  monthTotal: number,
  ranges: CommissionRange[],
): CommissionEstimate {
  try {
    const range = getCommissionRange(monthTotal, ranges);
    const amount = calculateEstimatedCommission(
      monthTotal,
      range,
    );

    return {
      ok: true,
      range,
      amount,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível calcular a comissão.",
    };
  }
}
