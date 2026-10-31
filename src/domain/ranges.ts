/**
 * CONVENÇÃO DE INTERVALOS (decisão registrada em docs/decisions.md):
 * faixas são FECHADAS nas duas pontas e medidas em unidades inteiras
 * (centavos para dinheiro, 1 para quantidade). "R$ 0,00 a R$ 59.999,99" é
 * min=0, max=5999999. A próxima faixa contínua começa em max + 1.
 * max = null significa "em diante" (sem limite).
 */
export interface Range { min: number; max: number | null }

export type RangeIssueCode =
  | "invalid_number" | "min_greater_than_max" | "unbounded_not_last"
  | "overlap" | "gap" | "must_start_at_zero" | "last_is_bounded";

export interface RangeIssue { code: RangeIssueCode; index: number; message: string }

export interface RangeOptions {
  /** Exige cobertura contínua: sem lacunas, começando em 0. */
  contiguous: boolean;
  /** Formata limites nas mensagens (ex.: formatBRL). */
  format?: (n: number) => string;
}

/** `index` das mensagens é o da faixa como o usuário a digitou (começa em 0). */
export function validateRanges(ranges: readonly Range[], options: RangeOptions): RangeIssue[] {
  const fmt = options.format ?? String;
  const label = (i: number) => `Faixa ${i + 1}`;
  const issues: RangeIssue[] = [];

  ranges.forEach((r, i) => {
    if (!Number.isSafeInteger(r.min) || r.min < 0 || (r.max !== null && !Number.isSafeInteger(r.max))) {
      issues.push({ code: "invalid_number", index: i, message: `${label(i)}: limites devem ser números inteiros não negativos.` });
    } else if (r.max !== null && r.min > r.max) {
      issues.push({ code: "min_greater_than_max", index: i, message: `${label(i)}: o mínimo (${fmt(r.min)}) é maior que o máximo (${fmt(r.max)}).` });
    }
  });
  if (issues.length > 0) return issues; // sem números válidos, comparar faixas não faz sentido

  const sorted = ranges.map((r, index) => ({ ...r, index })).sort((a, b) => a.min - b.min || a.index - b.index);
  const first = sorted[0];
  if (options.contiguous && first && first.min !== 0) {
    issues.push({ code: "must_start_at_zero", index: first.index, message: `${label(first.index)}: a cobertura contínua deve começar em ${fmt(0)}, mas começa em ${fmt(first.min)}.` });
  }
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1]!, cur = sorted[k]!;
    if (prev.max === null) {
      issues.push({ code: "unbounded_not_last", index: prev.index, message: `${label(prev.index)} não tem limite máximo, mas há faixas depois dela (${label(cur.index)}).` });
    } else if (cur.min <= prev.max) {
      issues.push({ code: "overlap", index: cur.index, message: `${label(cur.index)} (a partir de ${fmt(cur.min)}) se sobrepõe à ${label(prev.index)} (até ${fmt(prev.max)}).` });
    } else if (options.contiguous && cur.min !== prev.max + 1) {
      issues.push({ code: "gap", index: cur.index, message: `Há uma lacuna entre ${label(prev.index)} (até ${fmt(prev.max)}) e ${label(cur.index)} (a partir de ${fmt(cur.min)}): valores de ${fmt(prev.max + 1)} a ${fmt(cur.min - 1)} ficariam sem regra.` });
    }
  }
  const last = sorted[sorted.length - 1];
  if (options.contiguous && last && last.max !== null) {
    issues.push({ code: "last_is_bounded", index: last.index, message: `${label(last.index)} termina em ${fmt(last.max)}: valores acima disso ficariam sem regra. Deixe o máximo vazio ("em diante").` });
  }
  return issues;
}

/** Índice da faixa que contém `value`, ou -1. Assume faixas já validadas. */
export function findRangeIndex(ranges: readonly Range[], value: number): number {
  return ranges.findIndex((r) => value >= r.min && (r.max === null || value <= r.max));
}
