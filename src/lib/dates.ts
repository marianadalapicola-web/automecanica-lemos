import type { ISODate, MonthKey } from '../data/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function parseISO(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function isValidISO(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function monthKey(s: ISODate): MonthKey {
  return s.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthKey(todayISO());
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Data com o dia limitado ao último dia do mês (ex.: 31 → 30/28). */
export function dateInMonth(key: MonthKey, day: number): ISODate {
  const [y, m] = key.split('-').map(Number);
  return `${key}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function addMonthsToDate(s: ISODate, n: number): ISODate {
  const { d } = parseISO(s);
  return dateInMonth(addMonths(monthKey(s), n), d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(s);
  return toISO(new Date(y, m - 1, d + n));
}

export function diffDays(a: ISODate, b: ISODate): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000,
  );
}

export function monthDiff(a: MonthKey, b: MonthKey): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return yb * 12 + mb - (ya * 12 + ma);
}

export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

/**
 * Período do "mês financeiro". Com startDay = 1 é o mês civil.
 * Com startDay = 5, o mês 2026-10 vai de 05/10 a 04/11.
 */
export function periodOf(key: MonthKey, startDay = 1): { start: ISODate; end: ISODate } {
  if (startDay <= 1) {
    const [y, m] = key.split('-').map(Number);
    return { start: `${key}-01`, end: `${key}-${pad(daysInMonth(y, m))}` };
  }
  const start = dateInMonth(key, startDay);
  const end = addDays(dateInMonth(addMonths(key, 1), startDay), -1);
  return { start, end };
}

/** Mês financeiro ao qual uma data pertence. */
export function financialMonthOf(s: ISODate, startDay = 1): MonthKey {
  const k = monthKey(s);
  if (startDay <= 1) return k;
  return parseISO(s).d >= startDay ? k : addMonths(k, -1);
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDate(s: ISODate | null | undefined): string {
  if (!s) return '—';
  const { y, m, d } = parseISO(s);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function formatMonth(key: MonthKey, short = false): string {
  const [y, m] = key.split('-').map(Number);
  const name = short ? `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}` : `${MONTHS[m - 1]} de ${y}`;
  return name[0].toUpperCase() + name.slice(1);
}

/** Converte 'DD/MM/AAAA' em ISO; retorna null se inválida. */
export function parseBRDate(s: string): ISODate | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return isValidISO(iso) ? iso : null;
}
