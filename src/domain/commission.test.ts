import { test } from "node:test";
import assert from "node:assert/strict";
import { CommissionError, calculateCommission, commissionForPeriod, selectVersion, validateRule, validateVersions, type PlanRule, type PlanVersion } from "./commission.ts";
import { validateRanges } from "./ranges.ts";
import type { SaleEntry } from "./sales.ts";

// Exemplo ILUSTRATIVO do documento (editável): 0% / 0,5% / 1% / 1,5%
const tiers = [
  { min: 0, max: 5_999_999, rateBps: 0 },
  { min: 6_000_000, max: 7_999_999, rateBps: 50 },
  { min: 8_000_000, max: 9_999_999, rateBps: 100 },
  { min: 10_000_000, max: null, rateBps: 150 },
];
const total: PlanRule = { kind: "tiers", base: "total", requireContinuous: true, tiers };
const portion: PlanRule = { kind: "tiers", base: "portion", requireContinuous: true, tiers };
const calc = (rule: PlanRule, revenueCents: number, salesCount: number | null = null) => calculateCommission(rule, { revenueCents, salesCount });

test("faixas: abaixo, nos limites e logo acima de cada limite (base total)", () => {
  const expectIt = (revenue: number, commission: number, tier: number) => {
    const r = calc(total, revenue);
    assert.equal(r.commissionCents, commission, `receita ${revenue}`);
    assert.equal(r.tierIndex, tier, `faixa de ${revenue}`);
  };
  expectIt(0, 0, 0);                  // limite inferior da 1ª faixa
  expectIt(5_999_999, 0, 0);          // limite superior: R$ 59.999,99
  expectIt(6_000_000, 30_000, 1);     // imediatamente acima: R$ 60.000,00 -> 0,5%
  expectIt(7_999_999, 40_000, 1);     // 7.999.999 * 0,5% = 39.999,995 -> arredonda p/ 40.000
  expectIt(8_000_000, 80_000, 2);
  expectIt(9_999_999, 100_000, 2);    // 99.999,99 * 1% = 999,9999 -> R$ 1.000,00
  expectIt(10_000_000, 150_000, 3);   // faixa final ilimitada
  expectIt(999_999_999, 15_000_000, 3); // 1,5% de R$ 9.999.999,99 = R$ 149.999,99985 -> R$ 150.000,00
});

test("taxa zero resulta em comissão zero (não em erro)", () => {
  assert.equal(calc({ kind: "percentage", rateBps: 0 }, 123_456).commissionCents, 0);
});

test("base total x base parcela produzem resultados diferentes e corretos", () => {
  // Faturamento R$ 90.000,00: total => 1% de 90.000 = 900,00
  assert.equal(calc(total, 9_000_000).commissionCents, 90_000);
  // parcela => 0% dos primeiros 60k + 0,5% de 20k (=100,00) + 1% de 10k (=100,00) = 200,00
  assert.equal(calc(portion, 9_000_000).commissionCents, 20_000);
  // exatamente no limite: R$ 60.000,00 não tem parcela na 2ª faixa
  assert.equal(calc(portion, 6_000_000).commissionCents, 0);
});

test("porcentagem simples com arredondamento", () => {
  assert.equal(calc({ kind: "percentage", rateBps: 250 }, 10_050).commissionCents, 251); // 251,25 -> 251
});

test("valores fixos por faixa de meta", () => {
  const fixed: PlanRule = { kind: "fixed", requireContinuous: false, tiers: [{ min: 5_000_000, max: 9_999_999, amountCents: 20_000 }, { min: 10_000_000, max: null, amountCents: 50_000 }] };
  assert.equal(calc(fixed, 5_000_000).commissionCents, 20_000);
  assert.equal(calc(fixed, 10_000_000).commissionCents, 50_000);
  assert.throws(() => calc(fixed, 4_999_999), (err) => err instanceof CommissionError && err.code === "no_applicable_rule");
});

test("comissão por quantidade: usa a quantidade informada, nunca deduz", () => {
  const perSale: PlanRule = { kind: "per_sale", perSaleCents: 500 };
  assert.equal(calc(perSale, 123_456, 7).commissionCents, 3_500);
  assert.throws(() => calc(perSale, 123_456, null), (err) => err instanceof CommissionError && err.code === "quantity_required");
  const goals: PlanRule = { kind: "count_tiers", requireContinuous: true, tiers: [{ min: 0, max: 9, amountCents: 0 }, { min: 10, max: null, amountCents: 20_000 }] };
  assert.equal(calc(goals, 0, 9).commissionCents, 0);
  assert.equal(calc(goals, 0, 10).commissionCents, 20_000);
});

test("validação: sobreposição, lacuna, início, mínimo>máximo, ilimitada fora do fim", () => {
  const codes = (ranges: { min: number; max: number | null }[], contiguous = true) => validateRanges(ranges, { contiguous }).map((i) => i.code);
  assert.deepEqual(codes(tiers.map(({ min, max }) => ({ min, max }))), []);
  assert.deepEqual(codes([{ min: 0, max: 100 }, { min: 100, max: null }]), ["overlap"]);
  assert.deepEqual(codes([{ min: 0, max: 100 }, { min: 102, max: null }]), ["gap"]);
  assert.deepEqual(codes([{ min: 0, max: 100 }, { min: 102, max: null }], false), []); // sem cobertura contínua, lacuna é permitida
  assert.deepEqual(codes([{ min: 50, max: null }]), ["must_start_at_zero"]);
  assert.deepEqual(codes([{ min: 10, max: 5 }]), ["min_greater_than_max"]);
  // A 1ª não tem limite mas não é a última; e a última (10–20) é limitada, deixando valores > 20 sem regra.
  assert.deepEqual(codes([{ min: 0, max: null }, { min: 10, max: 20 }]), ["unbounded_not_last", "last_is_bounded"]);
  assert.deepEqual(codes([{ min: 0, max: 100 }]), ["last_is_bounded"]);
});

test("validação: mensagem aponta a faixa conflitante e o porquê", () => {
  const [issue] = validateRule({ kind: "tiers", base: "total", requireContinuous: true, tiers: [{ min: 0, max: 5_999_999, rateBps: 0 }, { min: 5_500_000, max: null, rateBps: 50 }] });
  assert.match(issue!.message, /Faixa 2.*R\$ 55\.000,00.*sobrepõe.*Faixa 1.*R\$ 59\.999,99/);
  assert.equal(issue!.index, 1);
});

test("configuração inválida não calcula nem salva; 'parcela' exige faixas contínuas", () => {
  const bad: PlanRule = { kind: "tiers", base: "portion", requireContinuous: false, tiers: [{ min: 0, max: 100, rateBps: 50 }, { min: 200, max: null, rateBps: 50 }] };
  assert.deepEqual(validateRule(bad).map((i) => i.code), ["gap"]);
  assert.throws(() => calc(bad, 150), (err) => err instanceof CommissionError && err.code === "invalid_rule");
  assert.equal(validateRule({ kind: "percentage", rateBps: 10_001 }).length, 1);
  assert.equal(validateRule({ kind: "percentage", rateBps: -1 }).length, 1);
});

test("vigência: regra antiga e nova; sobreposição é rejeitada", () => {
  const v1: PlanVersion = { id: "v1", effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30", rule: { kind: "percentage", rateBps: 100 } };
  const v2: PlanVersion = { id: "v2", effectiveFrom: "2026-10-01", effectiveTo: null, rule: { kind: "percentage", rateBps: 200 } };
  assert.equal(selectVersion([v1, v2], "2026-09-30")?.id, "v1");
  assert.equal(selectVersion([v1, v2], "2026-10-01")?.id, "v2");
  assert.equal(selectVersion([v1, v2], "2025-12-31"), null);
  assert.deepEqual(validateVersions([v1, v2]), []);
  assert.equal(validateVersions([v1, { ...v2, effectiveFrom: "2026-09-15" }]).length, 1);
});

test("período: mudar a regra depois NÃO altera o resultado do período passado", () => {
  const sales: SaleEntry[] = [
    { id: "1", saleDate: "2026-09-10", amountCents: 1_000_000, kind: "individual" },
    { id: "2", saleDate: "2026-10-10", amountCents: 1_000_000, kind: "individual" },
  ];
  const v1: PlanVersion = { id: "v1", effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30", rule: { kind: "percentage", rateBps: 100 } };
  const v2: PlanVersion = { id: "v2", effectiveFrom: "2026-10-01", effectiveTo: null, rule: { kind: "percentage", rateBps: 200 } };
  const sep = { start: "2026-09-01", end: "2026-09-30" }, oct = { start: "2026-10-01", end: "2026-10-31" };
  assert.equal(commissionForPeriod([v1], sep, sales).commissionCents, 10_000);
  assert.equal(commissionForPeriod([v1, v2], sep, sales).commissionCents, 10_000); // inalterado
  assert.equal(commissionForPeriod([v1, v2], oct, sales).commissionCents, 20_000);
  assert.equal(commissionForPeriod([v1, v2], oct, sales).revenueCents, 1_000_000); // só vendas do período
  assert.throws(() => commissionForPeriod([v2], sep, sales), (err) => err instanceof CommissionError && err.code === "no_plan_in_effect");
});
