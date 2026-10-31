import { test } from "node:test";
import assert from "node:assert/strict";
import { addEntry, bestDay, countSales, dailyTotals, removeEntry, totalCents, updateEntry, type SaleEntry } from "./sales.ts";

const e = (id: string, saleDate: string, amountCents: number, kind: SaleEntry["kind"] = "individual", salesCount?: number): SaleEntry =>
  ({ id, saleDate, amountCents, kind, ...(salesCount === undefined ? {} : { salesCount }) });

test("R$ 100 individual + R$ 500 acumulado = R$ 600 no dia", () => {
  let list: SaleEntry[] = [];
  list = addEntry(list, e("a", "2026-10-27", 10000));
  list = addEntry(list, e("b", "2026-10-27", 50000, "cumulative"));
  const days = dailyTotals(list);
  assert.equal(days.length, 1);
  assert.equal(days[0]!.totalCents, 60000);
  assert.deepEqual(days[0]!.entries.map((x) => [x.kind, x.amountCents]), [["individual", 10000], ["cumulative", 50000]]);
});

test("editar e excluir recalculam; nada é duplicado nem mutado", () => {
  const original = [e("a", "2026-10-27", 10000), e("b", "2026-10-27", 50000, "cumulative")];
  const snapshot = structuredClone(original);
  const edited = updateEntry(original, "b", { amountCents: 30000 });
  assert.equal(totalCents(edited), 40000);
  const removed = removeEntry(edited, "a");
  assert.equal(totalCents(removed), 30000);
  assert.equal(removed.length, 1);
  assert.deepEqual(original, snapshot, "a lista original não pode ser alterada");
});

test("melhor dia soma o dia inteiro, não pega a maior venda isolada", () => {
  const list = [e("1", "2026-10-01", 90000), e("2", "2026-10-02", 40000), e("3", "2026-10-02", 40000, "cumulative", 3), e("4", "2026-10-02", 30000)];
  const best = bestDay(list);
  assert.equal(best?.date, "2026-10-02");
  assert.equal(best?.totalCents, 110000);
  assert.equal(bestDay([]), null);
});

test("quantidade nunca é deduzida do dinheiro", () => {
  assert.equal(countSales([e("1", "2026-10-01", 100), e("2", "2026-10-01", 100)]), 2);
  assert.equal(countSales([e("1", "2026-10-01", 100), e("2", "2026-10-01", 50000, "cumulative", 4)]), 5);
  assert.equal(countSales([e("1", "2026-10-01", 100), e("2", "2026-10-01", 50000, "cumulative")]), null);
});
