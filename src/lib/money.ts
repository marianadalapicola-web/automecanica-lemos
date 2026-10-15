import type { Cents } from '../data/types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

export function formatBRLCompact(cents: Cents): string {
  return Math.abs(cents) < 100000 ? formatBRL(cents) : brlCompact.format(cents / 100);
}

/**
 * Converte texto digitado ("1.234,56", "1234.5", "R$ 10") em centavos.
 * Retorna null quando não é um número válido.
 */
export function parseBRL(input: string): Cents | null {
  let s = input.replace(/\s|R\$/g, '').trim();
  if (!s) return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234.567" ou "1.234" → separador de milhar
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return neg ? -cents : cents;
}

/** Centavos → texto editável "1234,56". */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Divide um total em n parcelas inteiras; a diferença de centavos fica na 1ª parcela. */
export function splitInstallments(total: Cents, n: number): Cents[] {
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}
