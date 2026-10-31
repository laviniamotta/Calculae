/** Dinheiro SEMPRE em centavos inteiros. Nunca float como fonte de verdade. */
export type Cents = number;

const MAX_CENTS = 1_000_000_000_000; // R$ 10 bilhões: teto de sanidade

export function isValidCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS;
}

/** "1.234,56" | "R$ 100" | "100,5" -> centavos. Retorna null se inválido. */
export function parseBRL(input: string): Cents | null {
  const text = input.replace(/^R\$\s*/i, "").trim();
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const reais = Number((match[1] ?? "").replaceAll(".", ""));
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = reais * 100 + cents;
  return isValidCents(total) ? total : null;
}

/** Centavos -> "R$ 1.234,56". Sem float: o inteiro é formatado diretamente. */
export function formatBRL(cents: Cents): string {
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100).toLocaleString("pt-BR");
  const rest = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}R$ ${reais},${rest}`;
}

/**
 * Aplica taxa em pontos-base (1 bp = 0,01%) com arredondamento "meio para cima".
 * 0,5% = 50 bps; 1,5% = 150 bps. O produto é inteiro, então não há erro de float.
 */
export function applyBps(baseCents: Cents, bps: number): Cents {
  return Math.floor((baseCents * bps + 5000) / 10000);
}

/** 150 -> "1,5%" */
export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
