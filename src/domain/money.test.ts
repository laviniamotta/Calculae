import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBps, formatBRL, formatBps, parseBRL } from "./money.ts";

test("parseBRL aceita formatos brasileiros e rejeita lixo", () => {
  assert.equal(parseBRL("100"), 10000);
  assert.equal(parseBRL("1.234,56"), 123456);
  assert.equal(parseBRL("R$ 100,5"), 10050);
  assert.equal(parseBRL("0,01"), 1);
  for (const bad of ["", "abc", "-5", "1,234", "1.23", "10,555", "1..000", "100,"]) assert.equal(parseBRL(bad), null, bad);
});

test("formatBRL e formatBps", () => {
  assert.equal(formatBRL(123456), "R$ 1.234,56");
  assert.equal(formatBRL(5), "R$ 0,05");
  assert.equal(formatBRL(-100), "-R$ 1,00");
  assert.equal(formatBRL(1_000_000_000), "R$ 10.000.000,00");
  assert.equal(formatBps(50), "0,5%");
  assert.equal(formatBps(150), "1,5%");
});

test("arredondamento meio-para-cima em centavos", () => {
  assert.equal(applyBps(10050, 50), 50);   // 50,25 -> 50
  assert.equal(applyBps(10100, 50), 51);   // 50,5 -> 51 (meio sobe)
  assert.equal(applyBps(1, 5000), 1);      // 0,5 -> 1
  assert.equal(applyBps(1, 4999), 0);
  assert.equal(applyBps(0, 150), 0);
});
