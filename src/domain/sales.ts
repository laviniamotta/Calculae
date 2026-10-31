import type { Cents } from "./money.ts";
import { isInRange, type DateRange, type ISODate } from "./dates.ts";

export type EntryKind = "individual" | "cumulative";

export interface SaleEntry {
  id: string;
  saleDate: ISODate;
  amountCents: Cents;
  kind: EntryKind;
  /** Quantidade de vendas informada. Nunca deduzida do valor. */
  salesCount?: number | null;
  note?: string;
}

export interface DailyTotal { date: ISODate; totalCents: Cents; entries: SaleEntry[] }

/** Soma de TODOS os lançamentos do dia: o acumulado é adicional, nunca substitui. */
export function dailyTotals(entries: readonly SaleEntry[]): DailyTotal[] {
  const byDate = new Map<ISODate, DailyTotal>();
  for (const entry of entries) {
    const day = byDate.get(entry.saleDate) ?? { date: entry.saleDate, totalCents: 0, entries: [] };
    day.totalCents += entry.amountCents;
    day.entries.push(entry);
    byDate.set(entry.saleDate, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function totalCents(entries: readonly SaleEntry[]): Cents {
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

export function entriesInRange(entries: readonly SaleEntry[], range: DateRange): SaleEntry[] {
  return entries.filter((e) => isInRange(e.saleDate, range));
}

/** Melhor dia = maior SOMA diária, não a maior venda individual. */
export function bestDay(entries: readonly SaleEntry[]): DailyTotal | null {
  return dailyTotals(entries).reduce<DailyTotal | null>(
    (best, day) => (best === null || day.totalCents > best.totalCents ? day : best), null);
}

/**
 * Quantidade de vendas. Individual conta 1 (ou o valor informado);
 * acumulado só conta se o usuário informou. Se faltar, retorna null
 * em vez de adivinhar a partir do dinheiro.
 */
export function countSales(entries: readonly SaleEntry[]): number | null {
  let count = 0;
  for (const e of entries) {
    const informed = e.salesCount ?? (e.kind === "individual" ? 1 : null);
    if (informed === null) return null;
    count += informed;
  }
  return count;
}

export function addEntry(entries: readonly SaleEntry[], entry: SaleEntry): SaleEntry[] {
  return [...entries, entry];
}
export function updateEntry(entries: readonly SaleEntry[], id: string, patch: Partial<Omit<SaleEntry, "id">>): SaleEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
}
export function removeEntry(entries: readonly SaleEntry[], id: string): SaleEntry[] {
  return entries.filter((e) => e.id !== id);
}
