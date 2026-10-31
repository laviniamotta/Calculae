
import {
  calculateCommission,
  CommissionError,
  type PlanRule,
} from "../domain/commission";
import { isValidCents, type Cents } from "../domain/money";

export type CommissionRange = {
  id: number;
  min_sales: number;
  max_sales: number | null;
  commission_rate: number;
};

function toCents(value: number, field: string): Cents {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field}: valor monetário inválido.`);
  }

  const cents = Math.round(value * 100);

  if (!isValidCents(cents)) {
    throw new RangeError(`${field}: valor fora do limite permitido.`);
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
 * Seleciona a faixa usando a validação e a lógica do domínio.
 * A regra atual do banco aplica a taxa da faixa ao faturamento total.
 */
export function getCommissionRange(
  monthTotal: number,
  ranges: CommissionRange[],
): CommissionRange | null {
  if (ranges.length === 0) return null;

  const revenueCents = toCents(monthTotal, "Faturamento mensal");
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
 * Calcula a comissão com a regra de dinheiro em centavos
 * e arredondamento definida em src/domain/commission.ts.
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
      revenueCents: toCents(monthTotal, "Faturamento mensal"),
      salesCount: null,
    },
  );

  return result.commissionCents / 100;
}
