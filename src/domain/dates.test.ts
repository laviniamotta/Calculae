import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, formatDateBR, getPeriod, isValidISODate, todayInBrazil } from "./dates.ts";

test("validação e formatação de datas", () => {
  assert.equal(isValidISODate("2026-02-29"), false);
  assert.equal(isValidISODate("2028-02-29"), true);
  assert.equal(isValidISODate("2026-13-01"), false);
  assert.equal(formatDateBR("2026-10-27"), "27/10/2026");
});

test("addDays atravessa mês e ano sem mudar de dia por fuso", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("'hoje' usa o fuso de São Paulo, não o do aparelho", () => {
  // 02:30 UTC de 28/10 ainda é 27/10 às 23:30 em São Paulo (UTC-3).
  assert.equal(todayInBrazil(new Date("2026-10-28T02:30:00Z")), "2026-10-27");
  assert.equal(todayInBrazil(new Date("2026-10-28T03:00:00Z")), "2026-10-28");
});

test("períodos mensal, semanal e personalizado", () => {
  assert.deepEqual(getPeriod({ kind: "monthly" }, "2028-02-10"), { start: "2028-02-01", end: "2028-02-29" });
  // 27/10/2026 é terça-feira
  assert.deepEqual(getPeriod({ kind: "weekly", weekStartsOn: 1 }, "2026-10-27"), { start: "2026-10-26", end: "2026-11-01" });
  assert.deepEqual(getPeriod({ kind: "weekly", weekStartsOn: 0 }, "2026-10-25"), { start: "2026-10-25", end: "2026-10-31" });
  assert.deepEqual(getPeriod({ kind: "custom", start: "2026-10-05", end: "2026-11-04" }, "2026-10-27"), { start: "2026-10-05", end: "2026-11-04" });
  assert.throws(() => getPeriod({ kind: "custom", start: "2026-11-04", end: "2026-10-05" }, "2026-10-27"), RangeError);
});
