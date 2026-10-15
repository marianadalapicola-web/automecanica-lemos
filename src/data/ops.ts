/**
 * Operações puras sobre AppData. Cada função recebe o estado atual e devolve um novo estado
 * (ou lança OpError com uma mensagem amigável quando a operação é inválida).
 */
import type {
  Account,
  AppData,
  CreditCard,
  Goal,
  GoalContribution,
  Installment,
  InvoicePayment,
  MonthBudget,
  MonthKey,
  Transaction,
  Category,
  Settings,
} from './types';
import { buildInstallmentTransactions, invoiceMonthFor, validateContribution } from '../lib/finance';
import { addMonths, isValidISO } from '../lib/dates';

export class OpError extends Error {}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const nowStamp = () => new Date().toISOString();

// ───────────── Transações ─────────────

export type TxInput = Omit<Transaction, 'id' | 'createdAt' | 'installmentId' | 'installmentNumber'> & {
  id?: string;
};

export function normalizeTx(data: AppData, input: TxInput): TxInput {
  const t = { ...input, description: input.description.trim(), notes: input.notes?.trim() ?? '' };
  if (!t.description) throw new OpError('Informe uma descrição.');
  if (!Number.isInteger(t.amount) || t.amount <= 0) throw new OpError('O valor deve ser maior que zero.');
  if (!isValidISO(t.competenceDate)) throw new OpError('Data de competência inválida.');
  if (t.dueDate && !isValidISO(t.dueDate)) throw new OpError('Data de vencimento inválida.');
  if (t.paidDate && !isValidISO(t.paidDate)) throw new OpError('Data de pagamento inválida.');

  if (t.type === 'transfer') {
    if (!t.accountId || !t.toAccountId) throw new OpError('Escolha as contas de origem e destino.');
    if (t.accountId === t.toAccountId) throw new OpError('Origem e destino devem ser contas diferentes.');
    t.cardId = null;
    t.invoiceMonth = null;
    t.categoryId = null;
    t.paymentMethod = t.paymentMethod === 'credit' ? 'transfer' : t.paymentMethod;
  } else if (t.type === 'expense' && t.cardId) {
    const card = data.cards.find((c) => c.id === t.cardId);
    if (!card) throw new OpError('Cartão não encontrado.');
    t.accountId = null;
    t.toAccountId = null;
    t.paymentMethod = 'credit';
    t.invoiceMonth = t.invoiceMonth || invoiceMonthFor(card, t.competenceDate);
    t.status = 'pending'; // derivado da fatura
    t.paidDate = null;
    t.dueDate = null;
  } else {
    if (!t.accountId) throw new OpError('Escolha a conta.');
    t.cardId = null;
    t.invoiceMonth = null;
    t.toAccountId = null;
  }
  if (t.accountId && !data.accounts.some((a) => a.id === t.accountId)) throw new OpError('Conta não encontrada.');
  if (t.toAccountId && !data.accounts.some((a) => a.id === t.toAccountId))
    throw new OpError('Conta de destino não encontrada.');
  if (!t.cardId) {
    if (t.status === 'paid') t.paidDate = t.paidDate || t.competenceDate;
    else t.paidDate = null;
  }
  return t;
}

export function saveTransaction(data: AppData, input: TxInput): AppData {
  const t = normalizeTx(data, input);
  if (t.id) {
    const existing = data.transactions.find((x) => x.id === t.id);
    if (!existing) throw new OpError('Lançamento não encontrado.');
    const updated: Transaction = { ...existing, ...t, id: existing.id } as Transaction;
    return { ...data, transactions: data.transactions.map((x) => (x.id === existing.id ? updated : x)) };
  }
  const tx: Transaction = {
    ...(t as Transaction),
    id: uid(),
    installmentId: null,
    installmentNumber: null,
    createdAt: nowStamp(),
  };
  return { ...data, transactions: [...data.transactions, tx] };
}

export function deleteTransaction(data: AppData, id: string): AppData {
  const t = data.transactions.find((x) => x.id === id);
  if (t?.installmentId) throw new OpError('Esta é uma parcela. Edite ou exclua o parcelamento inteiro em Parcelamentos.');
  return { ...data, transactions: data.transactions.filter((x) => x.id !== id) };
}

/** Correção manual da fatura de uma parcela/compra. */
export function setInvoiceMonth(data: AppData, txId: string, month: MonthKey): AppData {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new OpError('Mês de fatura inválido.');
  return {
    ...data,
    transactions: data.transactions.map((t) => (t.id === txId && t.cardId ? { ...t, invoiceMonth: month } : t)),
  };
}

// ───────────── Parcelamentos ─────────────

export type InstallmentInput = Omit<Installment, 'id' | 'createdAt'> & { id?: string };

export function saveInstallment(data: AppData, input: InstallmentInput): AppData {
  const card = data.cards.find((c) => c.id === input.cardId);
  if (!card) throw new OpError('Escolha o cartão.');
  if (!input.description.trim()) throw new OpError('Informe uma descrição.');
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 72)
    throw new OpError('Quantidade de parcelas deve ser entre 1 e 72.');
  if (!Number.isInteger(input.total) || input.total < input.count)
    throw new OpError('Valor total inválido.');
  if (!isValidISO(input.purchaseDate)) throw new OpError('Data da compra inválida.');
  // Vazio = regra automática de fechamento; preenchido = correção manual explícita.
  const firstInvoiceMonth = input.firstInvoiceMonth || invoiceMonthFor(card, input.purchaseDate);
  if (!/^\d{4}-\d{2}$/.test(firstInvoiceMonth)) throw new OpError('Mês da 1ª fatura inválido.');
  const existing = input.id ? data.installments.find((i) => i.id === input.id) : undefined;
  const inst: Installment = {
    ...input,
    description: input.description.trim(),
    notes: input.notes?.trim() ?? '',
    firstInvoiceMonth,
    id: existing?.id ?? uid(),
    createdAt: existing?.createdAt ?? nowStamp(),
  };
  const others = data.transactions.filter((t) => t.installmentId !== inst.id);
  const parcels = buildInstallmentTransactions(inst, nowStamp());
  return {
    ...data,
    installments: existing
      ? data.installments.map((i) => (i.id === inst.id ? inst : i))
      : [...data.installments, inst],
    transactions: [...others, ...parcels],
  };
}

export function deleteInstallment(data: AppData, id: string): AppData {
  return {
    ...data,
    installments: data.installments.filter((i) => i.id !== id),
    transactions: data.transactions.filter((t) => t.installmentId !== id),
  };
}

// ───────────── Faturas ─────────────

export function payInvoice(data: AppData, p: Omit<InvoicePayment, 'id'>): AppData {
  if (!data.cards.some((c) => c.id === p.cardId)) throw new OpError('Cartão não encontrado.');
  if (!data.accounts.some((a) => a.id === p.accountId)) throw new OpError('Escolha a conta de pagamento.');
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new OpError('Valor do pagamento inválido.');
  if (!isValidISO(p.date)) throw new OpError('Data do pagamento inválida.');
  return { ...data, invoicePayments: [...data.invoicePayments, { ...p, id: uid() }] };
}

export function deleteInvoicePayment(data: AppData, id: string): AppData {
  return { ...data, invoicePayments: data.invoicePayments.filter((p) => p.id !== id) };
}

// ───────────── Contas ─────────────

export function saveAccount(data: AppData, input: Omit<Account, 'id'> & { id?: string }): AppData {
  if (!input.name.trim()) throw new OpError('Informe o nome da conta.');
  if (!Number.isInteger(input.initialBalance)) throw new OpError('Saldo inicial inválido.');
  if (!isValidISO(input.startDate)) throw new OpError('Data de início inválida.');
  const acc: Account = { ...input, name: input.name.trim(), id: input.id ?? uid() };
  return input.id
    ? { ...data, accounts: data.accounts.map((a) => (a.id === acc.id ? acc : a)) }
    : { ...data, accounts: [...data.accounts, acc] };
}

export function deleteAccount(data: AppData, id: string): AppData {
  const used =
    data.transactions.some((t) => t.accountId === id || t.toAccountId === id) ||
    data.invoicePayments.some((p) => p.accountId === id) ||
    data.cards.some((c) => c.paymentAccountId === id) ||
    data.goals.some((g) => g.contributions.some((c) => c.accountId === id));
  if (used)
    throw new OpError(
      'Esta conta possui lançamentos, cartões ou reservas vinculados. Arquive-a em vez de excluir, ou remova os vínculos primeiro.',
    );
  return { ...data, accounts: data.accounts.filter((a) => a.id !== id) };
}

// ───────────── Cartões ─────────────

export function saveCard(data: AppData, input: Omit<CreditCard, 'id'> & { id?: string }): AppData {
  if (!input.name.trim()) throw new OpError('Informe o nome do cartão.');
  if (!Number.isInteger(input.limit) || input.limit < 0) throw new OpError('Limite inválido.');
  for (const [k, v] of [['fechamento', input.closingDay], ['vencimento', input.dueDay]] as const)
    if (!Number.isInteger(v) || v < 1 || v > 28) throw new OpError(`Dia de ${k} deve ser entre 1 e 28.`);
  if (!data.accounts.some((a) => a.id === input.paymentAccountId))
    throw new OpError('Escolha a conta usada para pagar a fatura.');
  const card: CreditCard = { ...input, name: input.name.trim(), nickname: input.nickname.trim(), id: input.id ?? uid() };
  return input.id
    ? { ...data, cards: data.cards.map((c) => (c.id === card.id ? card : c)) }
    : { ...data, cards: [...data.cards, card] };
}

export function deleteCard(data: AppData, id: string): AppData {
  if (data.transactions.some((t) => t.cardId === id) || data.invoicePayments.some((p) => p.cardId === id))
    throw new OpError('Este cartão possui compras ou pagamentos. Arquive-o ou exclua os lançamentos primeiro.');
  return { ...data, cards: data.cards.filter((c) => c.id !== id) };
}

// ───────────── Metas ─────────────

export function saveGoal(
  data: AppData,
  input: Omit<Goal, 'id' | 'contributions' | 'createdAt'> & { id?: string },
): AppData {
  if (!input.name.trim()) throw new OpError('Dê um nome para a meta.');
  if (!Number.isInteger(input.target) || input.target <= 0) throw new OpError('Valor desejado inválido.');
  if (input.targetDate && !isValidISO(input.targetDate)) throw new OpError('Data prevista inválida.');
  if (input.id) {
    return {
      ...data,
      goals: data.goals.map((g) => (g.id === input.id ? { ...g, ...input, name: input.name.trim() } : g)),
    };
  }
  const goal: Goal = { ...input, name: input.name.trim(), id: uid(), contributions: [], createdAt: nowStamp() };
  return { ...data, goals: [...data.goals, goal] };
}

export function deleteGoal(data: AppData, id: string): AppData {
  return { ...data, goals: data.goals.filter((g) => g.id !== id) };
}

export function addContribution(data: AppData, goalId: string, c: Omit<GoalContribution, 'id'>): AppData {
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal) throw new OpError('Meta não encontrada.');
  if (!Number.isInteger(c.amount)) throw new OpError('Valor inválido.');
  if (!isValidISO(c.date)) throw new OpError('Data inválida.');
  const err = validateContribution(data, goal, c.amount, c.accountId);
  if (err) throw new OpError(err);
  return {
    ...data,
    goals: data.goals.map((g) =>
      g.id === goalId ? { ...g, contributions: [...g.contributions, { ...c, id: uid() }] } : g,
    ),
  };
}

export function deleteContribution(data: AppData, goalId: string, contributionId: string): AppData {
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal) return data;
  const remaining = goal.contributions.filter((c) => c.id !== contributionId);
  const s = remaining.reduce((a, c) => a + c.amount, 0);
  if (s < 0) throw new OpError('Excluir esta contribuição deixaria a meta com saldo negativo. Exclua o resgate antes.');
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, contributions: remaining } : g)) };
}

// ───────────── Orçamento ─────────────

export function setBudget(data: AppData, month: MonthKey, budget: MonthBudget): AppData {
  const categories: Record<string, number> = {};
  for (const [k, v] of Object.entries(budget.categories)) {
    if (!Number.isInteger(v) || v < 0) throw new OpError('Limite inválido.');
    if (v > 0) categories[k] = v;
  }
  return { ...data, budgets: { ...data.budgets, [month]: { ...budget, categories } } };
}

export function copyBudgetFromPrevious(data: AppData, month: MonthKey): AppData {
  const prev = data.budgets[addMonths(month, -1)];
  if (!prev) throw new OpError('O mês anterior não tem orçamento definido.');
  return {
    ...data,
    budgets: { ...data.budgets, [month]: { ...prev, categories: { ...prev.categories } } },
  };
}

// ───────────── Categorias e configurações ─────────────

export function saveCategory(data: AppData, input: Omit<Category, 'id'> & { id?: string }): AppData {
  const name = input.name.trim();
  if (!name) throw new OpError('Informe o nome da categoria.');
  if (data.categories.some((c) => c.id !== input.id && c.kind === input.kind && c.name.toLowerCase() === name.toLowerCase()))
    throw new OpError('Já existe uma categoria com esse nome.');
  const cat: Category = { ...input, name, id: input.id ?? uid() };
  return input.id
    ? { ...data, categories: data.categories.map((c) => (c.id === cat.id ? cat : c)) }
    : { ...data, categories: [...data.categories, cat] };
}

/** Exclui a categoria; lançamentos e orçamentos que a usavam ficam "sem categoria". */
export function deleteCategory(data: AppData, id: string): AppData {
  const budgets: AppData['budgets'] = {};
  for (const [m, b] of Object.entries(data.budgets)) {
    const categories = { ...b.categories };
    delete categories[id];
    budgets[m] = { ...b, categories };
  }
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    transactions: data.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
    installments: data.installments.map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i)),
    budgets,
  };
}

export function saveSettings(data: AppData, s: Settings): AppData {
  if (!Number.isInteger(s.monthStartDay) || s.monthStartDay < 1 || s.monthStartDay > 28)
    throw new OpError('O primeiro dia do mês financeiro deve ser entre 1 e 28.');
  return { ...data, settings: s };
}
