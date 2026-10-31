import { applyBps, formatBRL, isValidCents, type Cents } from "./money.ts";
import { findRangeIndex, validateRanges, type Range, type RangeIssue } from "./ranges.ts";
import { isInRange, type DateRange, type ISODate } from "./dates.ts";
import { countSales, entriesInRange, totalCents, type SaleEntry } from "./sales.ts";

export interface RateTier extends Range { rateBps: number }       // faixa de faturamento -> %
export interface FixedTier extends Range { amountCents: Cents }   // faixa de faturamento -> valor fixo
export interface CountTier extends Range { amountCents: Cents }   // faixa de QUANTIDADE -> valor fixo

export type PlanRule =
  | { kind: "percentage"; rateBps: number }
  /** base "total": a taxa da faixa vale para TODO o faturamento. "portion": só para a parcela dentro de cada faixa. */
  | { kind: "tiers"; base: "total" | "portion"; requireContinuous: boolean; tiers: RateTier[] }
  | { kind: "fixed"; requireContinuous: boolean; tiers: FixedTier[] }
  | { kind: "per_sale"; perSaleCents: Cents }
  | { kind: "count_tiers"; requireContinuous: boolean; tiers: CountTier[] };

export interface PlanVersion { id: string; effectiveFrom: ISODate; effectiveTo: ISODate | null; rule: PlanRule }

export type CommissionErrorCode = "no_applicable_rule" | "quantity_required" | "no_plan_in_effect" | "invalid_rule";
export class CommissionError extends Error {
  constructor(readonly code: CommissionErrorCode, message: string) { super(message); this.name = "CommissionError"; }
}

export interface CommissionResult { commissionCents: Cents; revenueCents: Cents; tierIndex: number | null }

const validRate = (bps: number) => Number.isInteger(bps) && bps >= 0 && bps <= 10_000;

/** Valida a configuração inteira. Lista vazia = pode salvar. */
export function validateRule(rule: PlanRule): RangeIssue[] {
  const bad = (message: string): RangeIssue[] => [{ code: "invalid_number", index: 0, message }];
  switch (rule.kind) {
    case "percentage":
      return validRate(rule.rateBps) ? [] : bad("A taxa deve estar entre 0% e 100%.");
    case "per_sale":
      return isValidCents(rule.perSaleCents) ? [] : bad("O valor por venda é inválido.");
    case "tiers": {
      const rates = rule.tiers.flatMap((t, i) => (validRate(t.rateBps) ? [] : [{ code: "invalid_number" as const, index: i, message: `Faixa ${i + 1}: a taxa deve estar entre 0% e 100%.` }]));
      // "portion" só é inequívoco com faixas contínuas, então força a continuidade.
      const contiguous = rule.requireContinuous || rule.base === "portion";
      return [...rates, ...validateRanges(rule.tiers, { contiguous, format: formatBRL })];
    }
    case "fixed":
      return validateRanges(rule.tiers, { contiguous: rule.requireContinuous, format: formatBRL });
    case "count_tiers":
      return validateRanges(rule.tiers, { contiguous: rule.requireContinuous, format: (n) => `${n} venda(s)` });
  }
}

export function calculateCommission(rule: PlanRule, input: { revenueCents: Cents; salesCount: number | null }): CommissionResult {
  const { revenueCents, salesCount } = input;
  const done = (commissionCents: Cents, tierIndex: number | null = null): CommissionResult => ({ commissionCents, revenueCents, tierIndex });
  const issues = validateRule(rule);
  if (issues.length > 0) throw new CommissionError("invalid_rule", issues[0]!.message);

  switch (rule.kind) {
    case "percentage":
      return done(applyBps(revenueCents, rule.rateBps));
    case "per_sale":
      if (salesCount === null) throw new CommissionError("quantity_required", "Informe a quantidade de vendas dos lançamentos acumulados.");
      return done(salesCount * rule.perSaleCents);
    case "tiers": {
      const i = findRangeIndex(rule.tiers, revenueCents);
      if (i < 0) throw noRule(revenueCents);
      if (rule.base === "total") return done(applyBps(revenueCents, rule.tiers[i]!.rateBps), i);
      // Parcela: cada faixa cobre [min, próximoMin). Somamos os numeradores e arredondamos UMA vez.
      const sorted = [...rule.tiers].sort((a, b) => a.min - b.min);
      let numerator = 0;
      sorted.forEach((t, k) => {
        const upper = sorted[k + 1]?.min ?? Infinity;
        numerator += Math.max(0, Math.min(revenueCents, upper) - t.min) * t.rateBps;
      });
      return done(Math.floor((numerator + 5000) / 10000), i);
    }
    case "fixed": {
      const i = findRangeIndex(rule.tiers, revenueCents);
      if (i < 0) throw noRule(revenueCents);
      return done(rule.tiers[i]!.amountCents, i);
    }
    case "count_tiers": {
      if (salesCount === null) throw new CommissionError("quantity_required", "Informe a quantidade de vendas dos lançamentos acumulados.");
      const i = findRangeIndex(rule.tiers, salesCount);
      if (i < 0) throw new CommissionError("no_applicable_rule", `Nenhuma faixa cobre ${salesCount} venda(s).`);
      return done(rule.tiers[i]!.amountCents, i);
    }
  }
}

const noRule = (revenue: Cents) => new CommissionError("no_applicable_rule", `Nenhuma faixa cobre o faturamento de ${formatBRL(revenue)}.`);

/** Vigências do mesmo usuário não podem se sobrepor. */
export function validateVersions(versions: readonly PlanVersion[]): string[] {
  const sorted = [...versions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const problems: string[] = [];
  sorted.forEach((v, k) => {
    if (v.effectiveTo !== null && v.effectiveTo < v.effectiveFrom) problems.push(`Vigência ${v.effectiveFrom}: o término é anterior ao início.`);
    const prev = sorted[k - 1];
    if (prev && (prev.effectiveTo === null || prev.effectiveTo >= v.effectiveFrom)) problems.push(`A vigência iniciada em ${v.effectiveFrom} se sobrepõe à iniciada em ${prev.effectiveFrom}.`);
  });
  return problems;
}

export function selectVersion(versions: readonly PlanVersion[], date: ISODate): PlanVersion | null {
  return versions.find((v) => isInRange(date, { start: v.effectiveFrom, end: v.effectiveTo ?? "9999-12-31" })) ?? null;
}

/**
 * Comissão de um período. A regra usada é a vigente no INÍCIO do período:
 * uma regra nova no meio do período só vale a partir do próximo, então
 * nunca misturamos duas regras e períodos passados não mudam.
 */
export function commissionForPeriod(versions: readonly PlanVersion[], period: DateRange, entries: readonly SaleEntry[]): CommissionResult {
  const version = selectVersion(versions, period.start);
  if (!version) throw new CommissionError("no_plan_in_effect", "Nenhuma regra de comissão vigente neste período.");
  const inPeriod = entriesInRange(entries, period);
  return calculateCommission(version.rule, { revenueCents: totalCents(inPeriod), salesCount: countSales(inPeriod) });
}
