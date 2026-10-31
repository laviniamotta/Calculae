
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEstimatedCommission,
  getCommissionRange,
  type CommissionRange,
} from "./commission.ts";
import { CommissionError } from "../domain/commission.ts";

const ranges: CommissionRange[] = [
  {
    id: 1,
    min_sales: 0,
    max_sales: 999.99,
    commission_rate: 1.5,
  },
  {
    id: 2,
    min_sales: 1000,
    max_sales: null,
    commission_rate: 2,
  },
];

test("seleciona a faixa correta nos limites em centavos", () => {
  assert.equal(getCommissionRange(999.99, ranges)?.id, 1);
  assert.equal(getCommissionRange(1000, ranges)?.id, 2);
});

test("calcula a comissão com arredondamento para centavos", () => {
  const range: CommissionRange = {
    id: 1,
    min_sales: 0,
    max_sales: null,
    commission_rate: 2.5,
  };

  assert.equal(calculateEstimatedCommission(100.5, range), 2.51);
});

test("taxa zero continua sendo uma comissão válida", () => {
  const range: CommissionRange = {
    id: 1,
    min_sales: 0,
    max_sales: null,
    commission_rate: 0,
  };

  assert.equal(calculateEstimatedCommission(1000, range), 0);
});

test("sem faixas cadastradas não existe comissão aplicável", () => {
  assert.equal(getCommissionRange(1000, []), null);
});

test("rejeita faixas com lacunas", () => {
  const invalidRanges: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 999.99,
      commission_rate: 1,
    },
    {
      id: 2,
      min_sales: 1000.01,
      max_sales: null,
      commission_rate: 2,
    },
  ];

  assert.throws(
    () => getCommissionRange(1000, invalidRanges),
    (error) =>
      error instanceof CommissionError &&
      error.code === "invalid_rule",
  );
});
