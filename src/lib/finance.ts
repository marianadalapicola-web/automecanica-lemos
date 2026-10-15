/**
 * Motor de cálculos do Glossy Money — funções puras, sem efeitos colaterais.
 *
 * REGRAS DE CONTABILIZAÇÃO (as mesmas em dashboard, orçamento e relatórios):
 *
 * 1. Receitas e despesas são contabilizadas pela DATA DE COMPETÊNCIA, estejam pagas ou não.
 * 2. Transferências entre contas movem saldo, mas nunca entram em receitas/despesas.
 * 3. Compras no cartão são despesas na data da compra. Compras parceladas geram N parcelas;
 *    a parcela k tem competência = data da compra + (k−1) meses e é cobrada na fatura
 *    (1ª fatura + k−1). Cada parcela é contabilizada uma única vez.
 * 4. Fatura: compras feitas ANTES do dia de fechamento entram na fatura que fecha naquele mês;
 *    compras no dia do fechamento ou depois vão para a fatura seguinte. A fatura é identificada
 *    pelo mês de VENCIMENTO. Se dia de vencimento ≤ dia de fechamento, o vencimento cai no mês
 *    seguinte ao fechamento. A fatura de cada lançamento pode ser corrigida manualmente.
 * 5. Pagamento de fatura é liquidação de obrigação: reduz o saldo da conta e libera limite,
 *    mas NÃO é despesa (a despesa já foi contada nas compras).
 * 6. Saldo de conta = saldo inicial + movimentos efetivados (status pago) até a data.
 *    Compras no cartão não alteram saldo de conta; só o pagamento da fatura altera.
 * 7. Contribuições para metas RESERVAM dinheiro que já existe numa conta: não alteram o saldo
 *    total nem contam como despesa. Não é possível reservar mais do que o saldo livre da conta.
 */
import type {
  Account,
  AppData,
  Cents,
  CreditCard,
  Goal,
  ISODate,
  Installment,
  MonthKey,
  Transaction,
} from '../data/types';
import {
  addDays,
  addMonths,
  addMonthsToDate,
  dateInMonth,
  monthKey,
  parseISO,
  periodOf,
  monthRange,
  financialMonthOf,
} from './dates';
import { splitInstallments } from './money';

// ───────────────────────── Cartões e faturas ─────────────────────────

/** Mês (de vencimento) da fatura em que uma compra feita em `date` será cobrada. */
export function invoiceMonthFor(card: Pick<CreditCard, 'closingDay' | 'dueDay'>, date: ISODate): MonthKey {
  const { d } = parseISO(date);
  let closingMonth = monthKey(date);
  if (d >= card.closingDay) closingMonth = addMonths(closingMonth, 1);
  return card.dueDay > card.closingDay ? closingMonth : addMonths(closingMonth, 1);
}

export function invoiceDates(
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  invoiceMonth: MonthKey,
): { closing: ISODate; due: ISODate; periodStart: ISODate; periodEnd: ISODate } {
  const closingMonth = card.dueDay > card.closingDay ? invoiceMonth : addMonths(invoiceMonth, -1);
  const closing = dateInMonth(closingMonth, card.closingDay);
  const prevClosing = dateInMonth(addMonths(closingMonth, -1), card.closingDay);
  return {
    closing,
    due: dateInMonth(invoiceMonth, card.dueDay),
    periodStart: prevClosing,
    periodEnd: addDays(closing, -1),
  };
}

/** Fatura atualmente aberta (onde cairia uma compra feita hoje). */
export function currentInvoiceMonth(card: CreditCard, today: ISODate): MonthKey {
  return invoiceMonthFor(card, today);
}

export function cardCharges(data: AppData, cardId: string): Transaction[] {
  return data.transactions.filter((t) => t.cardId === cardId && t.type === 'expense');
}

export function invoiceTotal(data: AppData, cardId: string, month: MonthKey): Cents {
  return sum(cardCharges(data, cardId).filter((t) => t.invoiceMonth === month).map((t) => t.amount));
}

export function invoicePaid(data: AppData, cardId: string, month: MonthKey): Cents {
  return sum(
    data.invoicePayments.filter((p) => p.cardId === cardId && p.invoiceMonth === month).map((p) => p.amount),
  );
}

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'partial' | 'overdue' | 'empty';

export interface InvoiceInfo {
  cardId: string;
  month: MonthKey;
  total: Cents;
  paid: Cents;
  remaining: Cents;
  closing: ISODate;
  due: ISODate;
  status: InvoiceStatus;
  items: Transaction[];
}

export function invoiceInfo(data: AppData, card: CreditCard, month: MonthKey, today: ISODate): InvoiceInfo {
  const items = cardCharges(data, card.id)
    .filter((t) => t.invoiceMonth === month)
    .sort((a, b) => a.competenceDate.localeCompare(b.competenceDate));
  const total = sum(items.map((t) => t.amount));
  const paid = invoicePaid(data, card.id, month);
  const remaining = Math.max(0, total - paid);
  const { closing, due } = invoiceDates(card, month);
  let status: InvoiceStatus;
  if (total === 0 && paid === 0) status = 'empty';
  else if (remaining === 0) status = 'paid';
  else if (today > due) status = 'overdue';
  else if (today < closing) status = 'open';
  else if (paid > 0) status = 'partial';
  else status = 'closed';
  return { cardId: card.id, month, total, paid, remaining, closing, due, status, items };
}

/** Meses de fatura existentes para um cartão (com compras ou pagamentos). */
export function invoiceMonths(data: AppData, cardId: string): MonthKey[] {
  const set = new Set<MonthKey>();
  cardCharges(data, cardId).forEach((t) => t.invoiceMonth && set.add(t.invoiceMonth));
  data.invoicePayments.filter((p) => p.cardId === cardId).forEach((p) => set.add(p.invoiceMonth));
  return [...set].sort();
}

export interface CardSummary {
  used: Cents;
  available: Cents;
  current: InvoiceInfo;
  previous: InvoiceInfo;
  /** Próxima fatura com valor em aberto (ou a atual). */
  nextDue: InvoiceInfo;
  recent: Transaction[];
}

export function cardSummary(data: AppData, card: CreditCard, today: ISODate): CardSummary {
  const charges = cardCharges(data, card.id);
  const payments = sum(data.invoicePayments.filter((p) => p.cardId === card.id).map((p) => p.amount));
  // Limite usado = tudo que foi comprado (inclusive parcelas futuras) − o que já foi pago.
  const used = Math.max(0, sum(charges.map((t) => t.amount)) - payments);
  const cur = currentInvoiceMonth(card, today);
  const current = invoiceInfo(data, card, cur, today);
  const previous = invoiceInfo(data, card, addMonths(cur, -1), today);
  const unpaid = invoiceMonths(data, card.id)
    .map((m) => invoiceInfo(data, card, m, today))
    .filter((i) => i.remaining > 0 && i.month <= cur)
    .sort((a, b) => a.due.localeCompare(b.due));
  return {
    used,
    available: card.limit - used,
    current,
    previous,
    nextDue: unpaid[0] ?? current,
    recent: [...charges].sort((a, b) => b.competenceDate.localeCompare(a.competenceDate)).slice(0, 5),
  };
}

// ───────────────────────── Parcelamentos ─────────────────────────

/** Gera as transações-parcela de um parcelamento (determinístico pelo id). */
export function buildInstallmentTransactions(inst: Installment, now: string): Transaction[] {
  const amounts = splitInstallments(inst.total, inst.count);
  return amounts.map((amount, i) => ({
    id: `${inst.id}-p${i + 1}`,
    description: `${inst.description} (${i + 1}/${inst.count})`,
    amount,
    type: 'expense',
    categoryId: inst.categoryId,
    competenceDate: addMonthsToDate(inst.purchaseDate, i),
    dueDate: null,
    paidDate: null,
    accountId: null,
    toAccountId: null,
    cardId: inst.cardId,
    invoiceMonth: addMonths(inst.firstInvoiceMonth, i),
    paymentMethod: 'credit',
    status: 'pending',
    notes: inst.notes,
    installmentId: inst.id,
    installmentNumber: i + 1,
    createdAt: now,
  }));
}

export interface InstallmentProgress {
  parcels: (Transaction & { effStatus: EffStatus })[];
  paidCount: number;
  pendingCount: number;
  /** Parcela "atual" = primeira ainda não paga (ou a última, se todas pagas). */
  currentNumber: number;
  paidAmount: Cents;
  remainingAmount: Cents;
}

export function installmentProgress(data: AppData, inst: Installment, today: ISODate): InstallmentProgress {
  const parcels = data.transactions
    .filter((t) => t.installmentId === inst.id)
    .sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0))
    .map((t) => ({ ...t, effStatus: effectiveStatus(data, t, today) }));
  const paid = parcels.filter((p) => p.effStatus === 'paid');
  const firstOpen = parcels.find((p) => p.effStatus !== 'paid');
  return {
    parcels,
    paidCount: paid.length,
    pendingCount: parcels.length - paid.length,
    currentNumber: firstOpen?.installmentNumber ?? parcels.length,
    paidAmount: sum(paid.map((p) => p.amount)),
    remainingAmount: sum(parcels.filter((p) => p.effStatus !== 'paid').map((p) => p.amount)),
  };
}

// ───────────────────────── Status ─────────────────────────

export type EffStatus = 'paid' | 'pending' | 'overdue';

export function effectiveStatus(data: AppData, t: Transaction, today: ISODate): EffStatus {
  if (t.cardId && t.type === 'expense') {
    if (!t.invoiceMonth) return 'pending';
    const card = data.cards.find((c) => c.id === t.cardId);
    if (!card) return 'pending';
    const total = invoiceTotal(data, card.id, t.invoiceMonth);
    const paid = invoicePaid(data, card.id, t.invoiceMonth);
    if (total > 0 && paid >= total) return 'paid';
    return today > invoiceDates(card, t.invoiceMonth).due ? 'overdue' : 'pending';
  }
  if (t.status === 'paid') return 'paid';
  const ref = t.dueDate ?? t.competenceDate;
  return ref < today ? 'overdue' : 'pending';
}

// ───────────────────────── Contas e saldos ─────────────────────────

export interface Movement {
  id: string;
  date: ISODate;
  description: string;
  /** Positivo entra, negativo sai. */
  delta: Cents;
  kind: 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'invoice_payment';
  ref: Transaction | null;
}

/** Movimentos EFETIVADOS de uma conta (afetam saldo). */
export function accountMovements(data: AppData, accountId: string): Movement[] {
  const out: Movement[] = [];
  for (const t of data.transactions) {
    if (t.status !== 'paid' || t.cardId) continue;
    const date = t.paidDate ?? t.competenceDate;
    if (t.type === 'income' && t.accountId === accountId) {
      out.push({ id: t.id, date, description: t.description, delta: t.amount, kind: 'income', ref: t });
    } else if (t.type === 'expense' && t.accountId === accountId) {
      out.push({ id: t.id, date, description: t.description, delta: -t.amount, kind: 'expense', ref: t });
    } else if (t.type === 'transfer') {
      if (t.accountId === accountId)
        out.push({ id: t.id, date, description: t.description, delta: -t.amount, kind: 'transfer_out', ref: t });
      if (t.toAccountId === accountId)
        out.push({ id: t.id + ':in', date, description: t.description, delta: t.amount, kind: 'transfer_in', ref: t });
    }
  }
  for (const p of data.invoicePayments) {
    if (p.accountId !== accountId) continue;
    const card = data.cards.find((c) => c.id === p.cardId);
    out.push({
      id: p.id,
      date: p.date,
      description: `Pagamento fatura ${card?.nickname || card?.name || 'cartão'} (${p.invoiceMonth})`,
      delta: -p.amount,
      kind: 'invoice_payment',
      ref: null,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Saldo de uma conta ao final do dia `at` (padrão: considera todos os movimentos efetivados). */
export function accountBalance(data: AppData, account: Account, at?: ISODate): Cents {
  return (
    account.initialBalance +
    sum(
      accountMovements(data, account.id)
        .filter((m) => !at || m.date <= at)
        .map((m) => m.delta),
    )
  );
}

export function statement(
  data: AppData,
  account: Account,
  from: ISODate,
  to: ISODate,
): { opening: Cents; rows: (Movement & { balance: Cents })[]; closing: Cents } {
  const all = accountMovements(data, account.id);
  let bal = account.initialBalance + sum(all.filter((m) => m.date < from).map((m) => m.delta));
  const opening = bal;
  const rows = all
    .filter((m) => m.date >= from && m.date <= to)
    .map((m) => {
      bal += m.delta;
      return { ...m, balance: bal };
    });
  return { opening, rows, closing: bal };
}

export function activeAccounts(data: AppData): Account[] {
  return data.accounts.filter((a) => !a.archived);
}

export function totalBalance(data: AppData, at?: ISODate): Cents {
  return sum(data.accounts.map((a) => accountBalance(data, a, at)));
}

// ───────────────────────── Metas ─────────────────────────

export function goalSaved(goal: Goal): Cents {
  return sum(goal.contributions.map((c) => c.amount));
}

export function totalReserved(data: AppData, at?: ISODate): Cents {
  return sum(data.goals.flatMap((g) => g.contributions.filter((c) => !at || c.date <= at).map((c) => c.amount)));
}

export function reservedInAccount(data: AppData, accountId: string, excludeContributionId?: string): Cents {
  return sum(
    data.goals.flatMap((g) =>
      g.contributions.filter((c) => c.accountId === accountId && c.id !== excludeContributionId).map((c) => c.amount),
    ),
  );
}

export function freeBalance(data: AppData, account: Account, excludeContributionId?: string): Cents {
  return accountBalance(data, account) - reservedInAccount(data, account.id, excludeContributionId);
}

/** Valida uma contribuição (reserva/resgate). Retorna mensagem de erro ou null. */
export function validateContribution(
  data: AppData,
  goal: Goal,
  amount: Cents,
  accountId: string,
  excludeContributionId?: string,
): string | null {
  if (!amount) return 'Informe um valor diferente de zero.';
  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) return 'Escolha a conta onde o dinheiro está guardado.';
  const savedOther = sum(goal.contributions.filter((c) => c.id !== excludeContributionId).map((c) => c.amount));
  if (amount > 0) {
    const free = freeBalance(data, account, excludeContributionId);
    if (amount > free)
      return `Saldo livre insuficiente em ${account.name}. Disponível para reservar: ${(free / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
  } else {
    const savedInAccount = sum(
      goal.contributions
        .filter((c) => c.accountId === accountId && c.id !== excludeContributionId)
        .map((c) => c.amount),
    );
    if (-amount > savedOther || -amount > savedInAccount)
      return 'O resgate não pode ser maior do que o valor reservado nesta conta para a meta.';
  }
  return null;
}

// ───────────────────────── Períodos, receitas e despesas ─────────────────────────

export function inPeriod(date: ISODate, start: ISODate, end: ISODate) {
  return date >= start && date <= end;
}

export function txInRange(data: AppData, start: ISODate, end: ISODate): Transaction[] {
  return data.transactions.filter((t) => inPeriod(t.competenceDate, start, end));
}

export interface PeriodSummary {
  income: Cents;
  expense: Cents;
  incomeReceived: Cents;
  net: Cents;
  savingsRate: number;
  /** Despesas fora do cartão ainda não pagas com vencimento no período (ou antes, vencidas). */
  payablePending: Cents;
  /** Saldo em aberto das faturas que vencem no período. */
  invoicesPending: Cents;
  receivablePending: Cents;
  overdueCount: number;
}

export function periodSummary(data: AppData, month: MonthKey, today: ISODate): PeriodSummary {
  const { start, end } = periodOf(month, data.settings.monthStartDay);
  const txs = txInRange(data, start, end);
  const income = sum(txs.filter((t) => t.type === 'income').map((t) => t.amount));
  const expense = sum(txs.filter((t) => t.type === 'expense').map((t) => t.amount));
  const incomeReceived = sum(txs.filter((t) => t.type === 'income' && t.status === 'paid').map((t) => t.amount));

  let payablePending = 0;
  let receivablePending = 0;
  let overdueCount = 0;
  for (const t of data.transactions) {
    if (t.cardId || t.type === 'transfer' || t.status === 'paid') continue;
    const ref = t.dueDate ?? t.competenceDate;
    const overdue = ref < today;
    // pendências do período + qualquer pendência vencida anterior (continua devida)
    if (inPeriod(ref, start, end) || (overdue && ref < start)) {
      if (t.type === 'expense') payablePending += t.amount;
      else receivablePending += t.amount;
      if (overdue) overdueCount++;
    }
  }
  let invoicesPending = 0;
  for (const card of data.cards) {
    for (const m of invoiceMonths(data, card.id)) {
      const inv = invoiceInfo(data, card, m, today);
      if (inv.remaining > 0 && (inPeriod(inv.due, start, end) || (inv.due < start && inv.status === 'overdue'))) {
        invoicesPending += inv.remaining;
        if (inv.status === 'overdue') overdueCount++;
      }
    }
  }
  const net = income - expense;
  return {
    income,
    expense,
    incomeReceived,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    payablePending,
    invoicesPending,
    receivablePending,
    overdueCount,
  };
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  icon: string;
  total: Cents;
}

export function expensesByCategory(data: AppData, start: ISODate, end: ISODate): CategoryTotal[] {
  const map = new Map<string | null, Cents>();
  for (const t of txInRange(data, start, end)) {
    if (t.type !== 'expense') continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([categoryId, total]) => {
      const c = data.categories.find((x) => x.id === categoryId);
      return { categoryId, name: c?.name ?? 'Sem categoria', icon: c?.icon ?? '•', total };
    })
    .sort((a, b) => b.total - a.total);
}

export interface MonthPoint {
  month: MonthKey;
  income: Cents;
  expense: Cents;
  net: Cents;
}

export function monthlySeries(data: AppData, from: MonthKey, to: MonthKey): MonthPoint[] {
  return monthRange(from, to).map((month) => {
    const { start, end } = periodOf(month, data.settings.monthStartDay);
    const txs = txInRange(data, start, end);
    const income = sum(txs.filter((t) => t.type === 'income').map((t) => t.amount));
    const expense = sum(txs.filter((t) => t.type === 'expense').map((t) => t.amount));
    return { month, income, expense, net: income - expense };
  });
}

export function fixedVsVariable(data: AppData, from: MonthKey, to: MonthKey) {
  return monthRange(from, to).map((month) => {
    const { start, end } = periodOf(month, data.settings.monthStartDay);
    let fixed = 0;
    let variable = 0;
    for (const t of txInRange(data, start, end)) {
      if (t.type !== 'expense') continue;
      const c = data.categories.find((x) => x.id === t.categoryId);
      if (c?.fixed) fixed += t.amount;
      else variable += t.amount;
    }
    return { month, fixed, variable };
  });
}

export function balanceHistory(data: AppData, from: MonthKey, to: MonthKey) {
  return monthRange(from, to).map((month) => {
    const { end } = periodOf(month, data.settings.monthStartDay);
    const accounts: Record<string, Cents> = {};
    for (const a of data.accounts) accounts[a.id] = a.startDate <= end ? accountBalance(data, a, end) : 0;
    const started = data.accounts.some((a) => a.startDate <= end);
    return { month, total: started ? sum(Object.values(accounts)) : null, accounts };
  });
}

/** Gastos no cartão por competência (mesma regra do dashboard). */
export function spendingByCard(data: AppData, start: ISODate, end: ISODate) {
  return data.cards
    .map((c) => ({
      cardId: c.id,
      name: c.nickname || c.name,
      total: sum(
        txInRange(data, start, end)
          .filter((t) => t.cardId === c.id && t.type === 'expense')
          .map((t) => t.amount),
      ),
    }))
    .filter((x) => x.total > 0);
}

/** Parcelas ainda não cobradas, agrupadas por mês de fatura (a partir da fatura atual). */
export function futureInstallments(data: AppData, today: ISODate) {
  const map = new Map<MonthKey, Cents>();
  for (const card of data.cards) {
    const cur = currentInvoiceMonth(card, today);
    for (const t of cardCharges(data, card.id)) {
      if (!t.installmentId || !t.invoiceMonth || t.invoiceMonth < cur) continue;
      map.set(t.invoiceMonth, (map.get(t.invoiceMonth) ?? 0) + t.amount);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
}

export function goalHistory(data: AppData, from: MonthKey, to: MonthKey) {
  return monthRange(from, to).map((month) => {
    const { end } = periodOf(month, data.settings.monthStartDay);
    const row: Record<string, number | string> = { month };
    for (const g of data.goals) row[g.id] = sum(g.contributions.filter((c) => c.date <= end).map((c) => c.amount));
    return row;
  });
}

// ───────────────────────── Orçamento ─────────────────────────

export interface BudgetLine {
  categoryId: string;
  name: string;
  icon: string;
  planned: Cents;
  used: Cents;
  remaining: Cents;
  percent: number;
}

export function budgetUsage(data: AppData, month: MonthKey) {
  const budget = data.budgets[month] ?? { overall: null, categories: {}, savingsGoal: null };
  const { start, end } = periodOf(month, data.settings.monthStartDay);
  const byCat = expensesByCategory(data, start, end);
  const used = (id: string) => byCat.find((c) => c.categoryId === id)?.total ?? 0;
  const lines: BudgetLine[] = Object.entries(budget.categories)
    .filter(([, planned]) => planned > 0)
    .map(([categoryId, planned]) => {
      const c = data.categories.find((x) => x.id === categoryId);
      const u = used(categoryId);
      return {
        categoryId,
        name: c?.name ?? 'Categoria removida',
        icon: c?.icon ?? '•',
        planned,
        used: u,
        remaining: planned - u,
        percent: planned > 0 ? (u / planned) * 100 : 0,
      };
    })
    .sort((a, b) => b.percent - a.percent);
  const totalUsed = sum(byCat.map((c) => c.total));
  const plannedSum = sum(lines.map((l) => l.planned));
  const overall = budget.overall ?? (plannedSum > 0 ? plannedSum : null);
  const summary = periodSummary(data, month, '0000-00-00');
  return {
    budget,
    lines,
    totalUsed,
    overall,
    overallIsDerived: budget.overall == null && plannedSum > 0,
    overallRemaining: overall != null ? overall - totalUsed : null,
    savingsGoal: budget.savingsGoal,
    saved: summary.net,
  };
}

// ───────────────────────── Próximos vencimentos ─────────────────────────

export interface UpcomingItem {
  id: string;
  label: string;
  date: ISODate;
  amount: Cents;
  kind: 'bill' | 'invoice' | 'income';
  overdue: boolean;
  cardId?: string;
  invoiceMonth?: MonthKey;
  tx?: Transaction;
}

export function upcoming(data: AppData, today: ISODate, days = 30): UpcomingItem[] {
  const limit = addDays(today, days);
  const out: UpcomingItem[] = [];
  for (const t of data.transactions) {
    if (t.cardId || t.type === 'transfer' || t.status === 'paid') continue;
    const date = t.dueDate ?? t.competenceDate;
    if (date > limit) continue;
    out.push({
      id: t.id,
      label: t.description,
      date,
      amount: t.amount,
      kind: t.type === 'income' ? 'income' : 'bill',
      overdue: date < today,
      tx: t,
    });
  }
  for (const card of data.cards) {
    for (const m of invoiceMonths(data, card.id)) {
      const inv = invoiceInfo(data, card, m, today);
      if (inv.remaining <= 0 || inv.due > limit) continue;
      out.push({
        id: `inv-${card.id}-${m}`,
        label: `Fatura ${card.nickname || card.name}`,
        date: inv.due,
        amount: inv.remaining,
        kind: 'invoice',
        overdue: inv.due < today,
        cardId: card.id,
        invoiceMonth: m,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ───────────────────────── Money check ✧ ─────────────────────────

export interface Insight {
  icon: string;
  title: string;
  text: string;
  tone: 'good' | 'warn' | 'info';
}

export function moneyCheck(data: AppData, month: MonthKey, today: ISODate): Insight[] {
  const out: Insight[] = [];
  const fmt = (c: Cents) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const { start, end } = periodOf(month, data.settings.monthStartDay);
  const cur = periodSummary(data, month, today);
  const prev = periodSummary(data, addMonths(month, -1), today);
  const cats = expensesByCategory(data, start, end);

  if (cats.length) {
    const top = cats[0];
    out.push({
      icon: top.icon,
      title: 'Maior despesa',
      text: `${top.name} somou ${fmt(top.total)} (${Math.round((top.total / Math.max(cur.expense, 1)) * 100)}% das despesas).`,
      tone: 'info',
    });
  }
  const b = budgetUsage(data, month);
  if (b.overall != null) {
    const rem = b.overallRemaining ?? 0;
    out.push({
      icon: rem >= 0 ? '♡' : '!',
      title: 'Orçamento',
      text:
        rem >= 0
          ? `Ainda restam ${fmt(rem)} do orçamento de ${fmt(b.overall)}.`
          : `O orçamento foi ultrapassado em ${fmt(-rem)}.`,
      tone: rem >= 0 ? 'good' : 'warn',
    });
    const over = b.lines.filter((l) => l.remaining < 0);
    if (over.length)
      out.push({
        icon: '!',
        title: 'Categorias acima do limite',
        text: over.map((l) => `${l.name} (+${fmt(-l.remaining)})`).join(', '),
        tone: 'warn',
      });
  }
  if (prev.expense > 0 || prev.income > 0) {
    const diff = cur.expense - prev.expense;
    out.push({
      icon: diff <= 0 ? '↘' : '↗',
      title: 'Evolução mensal',
      text:
        prev.expense > 0
          ? `Despesas ${diff <= 0 ? 'caíram' : 'subiram'} ${Math.abs(Math.round((diff / prev.expense) * 100))}% em relação ao mês anterior (${fmt(prev.expense)} → ${fmt(cur.expense)}).`
          : `No mês anterior não houve despesas; neste mês são ${fmt(cur.expense)}.`,
      tone: diff <= 0 ? 'good' : 'info',
    });
  }
  if (cur.income > 0) {
    out.push({
      icon: '✧',
      title: 'Taxa de poupança',
      text: `Você poupou ${Math.round(cur.savingsRate)}% da renda do período (${fmt(cur.net)}).`,
      tone: cur.savingsRate >= 10 ? 'good' : cur.savingsRate < 0 ? 'warn' : 'info',
    });
  }
  if (b.savingsGoal) {
    out.push({
      icon: '★',
      title: 'Meta de economia',
      text:
        cur.net >= b.savingsGoal
          ? `Meta de economia de ${fmt(b.savingsGoal)} atingida!`
          : `Faltam ${fmt(b.savingsGoal - cur.net)} para a meta de economia de ${fmt(b.savingsGoal)}.`,
      tone: cur.net >= b.savingsGoal ? 'good' : 'info',
    });
  }
  if (cur.overdueCount > 0)
    out.push({
      icon: '!',
      title: 'Vencidos',
      text: `${cur.overdueCount} lançamento(s) ou fatura(s) vencido(s) aguardando pagamento.`,
      tone: 'warn',
    });
  return out;
}

export function hasAnyData(data: AppData): boolean {
  return data.transactions.length > 0 || data.accounts.length > 0 || data.cards.length > 0 || data.goals.length > 0;
}

export function monthOfToday(data: AppData, today: ISODate): MonthKey {
  return financialMonthOf(today, data.settings.monthStartDay);
}

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}
