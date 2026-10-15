import type { AppData, Transaction } from '../data/types';
import { emptyData } from '../data/defaults';
import { isValidISO, formatDate } from './dates';
import { PAYMENT_METHOD_LABEL, TX_TYPE_LABEL } from '../data/defaults';

export const BACKUP_FORMAT = 'glossy-money-backup';

export function makeBackup(data: AppData) {
  return { format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), data };
}

export type BackupResult = { ok: true; data: AppData; summary: string } | { ok: false; errors: string[] };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/** Valida estrutura e integridade referencial de um backup antes de restaurá-lo. */
export function validateBackup(raw: unknown): BackupResult {
  const errors: string[] = [];
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT || !isObj(raw.data))
    return { ok: false, errors: ['Arquivo não é um backup do Glossy Money.'] };
  const d = raw.data as Record<string, unknown>;
  if (d.schemaVersion !== 1) errors.push('Versão de backup não suportada.');
  const arrays = ['categories', 'accounts', 'cards', 'transactions', 'installments', 'invoicePayments', 'goals'] as const;
  for (const k of arrays) if (!Array.isArray(d[k])) errors.push(`Campo "${k}" ausente ou inválido.`);
  if (!isObj(d.settings)) errors.push('Configurações ausentes.');
  if (!isObj(d.budgets)) errors.push('Orçamentos ausentes.');
  if (errors.length) return { ok: false, errors };

  const base = emptyData();
  const data = { ...base, ...d, settings: { ...base.settings, ...(d.settings as object) } } as AppData;
  const ids = new Set<string>();
  const dup = (id: unknown, where: string) => {
    if (!isStr(id) || !id) return errors.push(`${where}: identificador inválido.`);
    if (ids.has(id)) errors.push(`${where}: identificador duplicado (${id}).`);
    ids.add(id);
  };
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const cardIds = new Set(data.cards.map((c) => c.id));

  data.categories.forEach((c, i) => {
    dup(c.id, `Categoria ${i + 1}`);
    if (!isStr(c.name) || !['income', 'expense'].includes(c.kind)) errors.push(`Categoria ${i + 1} inválida.`);
  });
  data.accounts.forEach((a, i) => {
    dup(a.id, `Conta ${i + 1}`);
    if (!isStr(a.name) || !isInt(a.initialBalance) || !isValidISO(a.startDate)) errors.push(`Conta ${i + 1} inválida.`);
  });
  data.cards.forEach((c, i) => {
    dup(c.id, `Cartão ${i + 1}`);
    if (!isStr(c.name) || !isInt(c.limit) || !isInt(c.closingDay) || !isInt(c.dueDay))
      errors.push(`Cartão ${i + 1} inválido.`);
    if (!accountIds.has(c.paymentAccountId)) errors.push(`Cartão ${i + 1}: conta de pagamento inexistente.`);
  });
  data.transactions.forEach((t: Transaction, i) => {
    dup(t.id, `Transação ${i + 1}`);
    if (!isStr(t.description) || !isInt(t.amount) || t.amount <= 0) errors.push(`Transação ${i + 1}: valor ou descrição inválidos.`);
    if (!['income', 'expense', 'transfer'].includes(t.type)) errors.push(`Transação ${i + 1}: tipo inválido.`);
    if (!isValidISO(t.competenceDate)) errors.push(`Transação ${i + 1}: data inválida.`);
    if (t.accountId && !accountIds.has(t.accountId)) errors.push(`Transação ${i + 1}: conta inexistente.`);
    if (t.toAccountId && !accountIds.has(t.toAccountId)) errors.push(`Transação ${i + 1}: conta destino inexistente.`);
    if (t.cardId && !cardIds.has(t.cardId)) errors.push(`Transação ${i + 1}: cartão inexistente.`);
  });
  data.installments.forEach((x, i) => {
    dup(x.id, `Parcelamento ${i + 1}`);
    if (!cardIds.has(x.cardId)) errors.push(`Parcelamento ${i + 1}: cartão inexistente.`);
  });
  data.invoicePayments.forEach((p, i) => {
    dup(p.id, `Pagamento de fatura ${i + 1}`);
    if (!isInt(p.amount) || !cardIds.has(p.cardId) || !accountIds.has(p.accountId))
      errors.push(`Pagamento de fatura ${i + 1} inválido.`);
  });
  data.goals.forEach((g, i) => {
    dup(g.id, `Meta ${i + 1}`);
    if (!isInt(g.target) || !Array.isArray(g.contributions)) errors.push(`Meta ${i + 1} inválida.`);
    else
      g.contributions.forEach((c, j) => {
        if (!isInt(c.amount) || !accountIds.has(c.accountId)) errors.push(`Meta ${i + 1}, contribuição ${j + 1} inválida.`);
      });
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };
  return {
    ok: true,
    data,
    summary: `${data.transactions.length} transações, ${data.accounts.length} contas, ${data.cards.length} cartões, ${data.goals.length} metas`,
  };
}

// ───────────── CSV ─────────────

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com separador ";" e vírgula decimal (abre corretamente no Excel em pt-BR). */
export function transactionsToCSV(data: AppData, txs: Transaction[], statusOf: (t: Transaction) => string): string {
  const cat = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? '';
  const acc = (id: string | null) => data.accounts.find((a) => a.id === id)?.name ?? '';
  const card = (id: string | null) => {
    const c = data.cards.find((x) => x.id === id);
    return c ? c.nickname || c.name : '';
  };
  const header = [
    'id', 'descricao', 'valor', 'tipo', 'categoria', 'data_competencia', 'data_vencimento',
    'data_pagamento', 'conta', 'conta_destino', 'cartao', 'fatura', 'forma_pagamento', 'status', 'parcela', 'observacoes',
  ];
  const rows = txs.map((t) =>
    [
      t.id,
      t.description,
      (t.amount / 100).toFixed(2).replace('.', ','),
      TX_TYPE_LABEL[t.type],
      cat(t.categoryId),
      formatDate(t.competenceDate),
      t.dueDate ? formatDate(t.dueDate) : '',
      t.paidDate ? formatDate(t.paidDate) : '',
      acc(t.accountId),
      acc(t.toAccountId),
      card(t.cardId),
      t.invoiceMonth ?? '',
      PAYMENT_METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod,
      statusOf(t),
      t.installmentNumber ? String(t.installmentNumber) : '',
      t.notes,
    ]
      .map(csvCell)
      .join(';'),
  );
  return '﻿' + [header.join(';'), ...rows].join('\r\n');
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
