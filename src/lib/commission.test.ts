import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calculateEstimatedCommission,
  getCommissionEstimate,
  getCommissionRange,
  validateCommissionRanges,
  validateCommissionRangeDrafts,
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

test("rejeita faixas com lacunas no cálculo", () => {
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

test("aceita faixas contínuas com a última faixa ilimitada", () => {
  assert.equal(validateCommissionRanges(ranges), null);
});

test("rejeita uma última faixa limitada na validação completa", () => {
  const invalidRanges: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1,
    },
  ];

  const error = validateCommissionRanges(invalidRanges);

  assert.notEqual(error, null);
  assert.match(error ?? "", /em diante/);
});

test("rejeita taxas com mais de duas casas decimais", () => {
  const invalidRanges: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: null,
      commission_rate: 1.555,
    },
  ];

  const error = validateCommissionRanges(invalidRanges);

  assert.match(error ?? "", /duas casas decimais/);
});

test("retorna erro controlado para faixas inválidas recebidas do banco", () => {
  const invalidRanges: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1,
    },
  ];

  const result = getCommissionEstimate(1000, invalidRanges);

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.ok(result.error.length > 0);
  }
});

test("retorna erro controlado quando os dados possuem lacunas", () => {
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

  const result = getCommissionEstimate(1000, invalidRanges);

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.ok(result.error.length > 0);
  }
});

test("calcula normalmente quando a configuração é válida", () => {
  const result = getCommissionEstimate(1000, ranges);

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.range?.id, 2);
    assert.equal(result.amount, 20);
  }
});

// ============================================================================
// TESTES DA VALIDAÇÃO PROGRESSIVA
// ============================================================================

test("cadastro progressivo aceita a primeira faixa limitada", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1,
    },
  ];

  assert.equal(validateCommissionRangeDrafts(draft), null);
});

test("cadastro progressivo aceita duas faixas contínuas e limitadas", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1,
    },
    {
      id: 2,
      min_sales: 5000.01,
      max_sales: 10000,
      commission_rate: 2,
    },
  ];

  assert.equal(validateCommissionRangeDrafts(draft), null);
});

test("cadastro progressivo aceita lacunas temporárias", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1,
    },
    {
      id: 2,
      min_sales: 6000,
      max_sales: 10000,
      commission_rate: 2,
    },
  ];

  assert.equal(validateCommissionRangeDrafts(draft), null);
});

test("cadastro progressivo rejeita faixas sobrepostas", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1,
    },
    {
      id: 2,
      min_sales: 4999,
      max_sales: 10000,
      commission_rate: 2,
    },
  ];

  assert.match(
    validateCommissionRangeDrafts(draft) ?? "",
    /sobrepõe/,
  );
});

test("cadastro progressivo exige que a primeira faixa comece em zero", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 5000,
      max_sales: 10000,
      commission_rate: 1,
    },
  ];

  assert.match(
    validateCommissionRangeDrafts(draft) ?? "",
    /deve começar/,
  );
});

test("cadastro progressivo rejeita faixa ilimitada antes de outra", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: null,
      commission_rate: 1,
    },
    {
      id: 2,
      min_sales: 5000,
      max_sales: 10000,
      commission_rate: 2,
    },
  ];

  assert.match(
    validateCommissionRangeDrafts(draft) ?? "",
    /não tem limite máximo/,
  );
});

test("cadastro progressivo também rejeita taxas inválidas", () => {
  const draft: CommissionRange[] = [
    {
      id: 1,
      min_sales: 0,
      max_sales: 5000,
      commission_rate: 1.555,
    },
  ];

  assert.match(
    validateCommissionRangeDrafts(draft) ?? "",
    /duas casas decimais/,
  );
});