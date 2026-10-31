/**
 * Datas de venda são "datas de calendário" (YYYY-MM-DD), sem hora e sem fuso.
 * Nunca usamos new Date("YYYY-MM-DD") com horário local: é isso que faz um
 * registro "pular" de dia. Toda aritmética é feita em UTC sobre a data pura.
 */
export type ISODate = string;
export interface DateRange { start: ISODate; end: ISODate } // ambos inclusivos

export type PeriodConfig =
  | { kind: "monthly" }
  | { kind: "weekly"; weekStartsOn: 0 | 1 } // 0 = domingo, 1 = segunda
  | { kind: "custom"; start: ISODate; end: ISODate };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(iso: ISODate): Date {
  const m = ISO.exec(iso);
  if (!m) throw new RangeError(`Data inválida: ${iso}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== iso) throw new RangeError(`Data inexistente: ${iso}`);
  return d;
}

export function isValidISODate(value: string): boolean {
  try { toUtc(value); return true; } catch { return false; }
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateBR(iso: ISODate): string {
  toUtc(iso);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** "Hoje" no Brasil (America/Sao_Paulo), independente do fuso do aparelho. */
export function todayInBrazil(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function isInRange(date: ISODate, range: DateRange): boolean {
  return date >= range.start && date <= range.end; // ISO ordena como texto
}

export function getPeriod(config: PeriodConfig, reference: ISODate): DateRange {
  const ref = toUtc(reference);
  if (config.kind === "custom") {
    toUtc(config.start); toUtc(config.end);
    if (config.start > config.end) throw new RangeError("Período com início depois do fim");
    return { start: config.start, end: config.end };
  }
  if (config.kind === "monthly") {
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth();
    return {
      start: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
      end: new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10),
    };
  }
  const offset = (ref.getUTCDay() - config.weekStartsOn + 7) % 7;
  const start = addDays(reference, -offset);
  return { start, end: addDays(start, 6) };
}
