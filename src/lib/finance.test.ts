import { describe, expect, it } from 'vitest';
import { emptyData } from '../data/defaults';
import type { AppData } from '../data/types';
import * as ops from '../data/ops';
import {
  accountBalance,
  budgetUsage,
  cardSummary,
  effectiveStatus,
  expensesByCategory,
  freeBalance,
  goalSaved,
  installmentProgress,
  invoiceDates,
  invoiceInfo,
  invoiceMonthFor,
  periodSummary,
  statement,
  totalBalance,
  totalReserved,
  futureInstallments,
} from './finance';
import { makeBackup, transactionsToCSV, validateBackup } from './backup';
import { parseBRL, splitInstallments } from './money';
import { periodOf, financialMonthOf } from './dates';

const TODAY = '2026-10-15';

function base(): { data: AppData; corrente: string; poupanca: string } {
  let data = emptyData();
  data = ops.saveAccount(data, { name: 'Corrente', type: 'checking', initialBalance: 100000, startDate: '2026-09-01', color: '#DB65AA' });
  data = ops.saveAccount(data, { name: 'Poupança', type: 'savings', initialBalance: 50000, startDate: '2026-09-01', color: '#9676D5' });
  return { data, corrente: data.accounts[0].id, poupanca: data.accounts[1].id };
}

const tx = (over: Partial<ops.TxInput>): ops.TxInput => ({
  description: 'x',
  amount: 1000,
  type: 'expense',
  categoryId: 'cat-alimentacao',
  competenceDate: '2026-10-10',
  dueDate: null,
  paidDate: null,
  accountId: null,
  toAccountId: null,
  cardId: null,
  invoiceMonth: null,
  paymentMethod: 'pix',
  status: 'paid',
  notes: '',
  ...over,
});

function withCard(d: AppData, accountId: string) {
  const data = ops.saveCard(d, {
    name: 'Nubank', nickname: 'Roxinho', limit: 300000, closingDay: 3, dueDay: 10,
    paymentAccountId: accountId, theme: 'lilac',
  });
  return { data, card: data.cards[0] };
}

describe('money helpers', () => {
  it('parses BRL input', () => {
    expect(parseBRL('1.234,56')).toBe(123456);
    expect(parseBRL('R$ 10')).toBe(1000);
    expect(parseBRL('10.5')).toBe(1050);
    expect(parseBRL('1.000')).toBe(100000);
    expect(parseBRL('abc')).toBeNull();
  });
  it('splits installments without losing cents', () => {
    const p = splitInstallments(10000, 3);
    expect(p).toEqual([3334, 3333, 3333]);
    expect(p.reduce((a, b) => a + b)).toBe(10000);
  });
});

describe('fluxo 2/3 — receitas, despesas e saldo', () => {
  it('receita paga aumenta o saldo e entra nas receitas do período', () => {
    let { data, corrente } = base();
    data = ops.saveTransaction(data, tx({ type: 'income', amount: 500000, categoryId: 'cat-salario', accountId: corrente, competenceDate: '2026-10-05' }));
    const acc = data.accounts[0];
    expect(accountBalance(data, acc)).toBe(600000);
    const s = periodSummary(data, '2026-10', TODAY);
    expect(s.income).toBe(500000);
    expect(s.expense).toBe(0);
  });

  it('despesa paga reduz saldo; pendente não reduz saldo mas conta como despesa e pendência', () => {
    let { data, corrente } = base();
    data = ops.saveTransaction(data, tx({ amount: 20000, accountId: corrente }));
    data = ops.saveTransaction(data, tx({ amount: 15000, accountId: corrente, status: 'pending', dueDate: '2026-10-20', categoryId: 'cat-moradia' }));
    data = ops.saveTransaction(data, tx({ amount: 5000, accountId: corrente, status: 'pending', dueDate: '2026-10-01', categoryId: 'cat-saude' }));
    expect(accountBalance(data, data.accounts[0])).toBe(80000);
    const s = periodSummary(data, '2026-10', TODAY);
    expect(s.expense).toBe(40000);
    expect(s.payablePending).toBe(20000);
    expect(s.overdueCount).toBe(1);
    const statuses = data.transactions.map((t) => effectiveStatus(data, t, TODAY));
    expect(statuses).toEqual(['paid', 'pending', 'overdue']);
  });

  it('saldo em data anterior e extrato com saldo corrente', () => {
    let { data, corrente } = base();
    data = ops.saveTransaction(data, tx({ type: 'income', amount: 1000, accountId: corrente, competenceDate: '2026-09-10', categoryId: 'cat-vendas' }));
    data = ops.saveTransaction(data, tx({ amount: 300, accountId: corrente, competenceDate: '2026-10-02' }));
    const acc = data.accounts[0];
    expect(accountBalance(data, acc, '2026-09-30')).toBe(101000);
    expect(accountBalance(data, acc, '2026-10-02')).toBe(100700);
    const st = statement(data, acc, '2026-10-01', '2026-10-31');
    expect(st.opening).toBe(101000);
    expect(st.rows.map((r) => r.balance)).toEqual([100700]);
  });

  it('valida campos obrigatórios', () => {
    const { data } = base();
    expect(() => ops.saveTransaction(data, tx({ amount: 0, accountId: data.accounts[0].id }))).toThrow(ops.OpError);
    expect(() => ops.saveTransaction(data, tx({ description: '  ' }))).toThrow(/descrição/);
  });
});

describe('fluxo 4 — transferência entre contas', () => {
  it('move saldo sem virar receita ou despesa', () => {
    let { data, corrente, poupanca } = base();
    data = ops.saveTransaction(data, tx({ type: 'transfer', amount: 30000, accountId: corrente, toAccountId: poupanca, categoryId: 'cat-outros' }));
    expect(accountBalance(data, data.accounts[0])).toBe(70000);
    expect(accountBalance(data, data.accounts[1])).toBe(80000);
    expect(totalBalance(data)).toBe(150000);
    const s = periodSummary(data, '2026-10', TODAY);
    expect(s.income).toBe(0);
    expect(s.expense).toBe(0);
    expect(data.transactions[0].categoryId).toBeNull();
  });
  it('rejeita transferência para a mesma conta', () => {
    const { data, corrente } = base();
    expect(() => ops.saveTransaction(data, tx({ type: 'transfer', accountId: corrente, toAccountId: corrente }))).toThrow();
  });
});

describe('fluxo 5/6/7 — cartão, parcelas e pagamento de fatura', () => {
  it('regra de fechamento: antes do fechamento → fatura do mês; no dia/depois → seguinte', () => {
    const card = { closingDay: 3, dueDay: 10 };
    expect(invoiceMonthFor(card, '2026-10-02')).toBe('2026-10');
    expect(invoiceMonthFor(card, '2026-10-03')).toBe('2026-11');
    expect(invoiceMonthFor(card, '2026-10-15')).toBe('2026-11');
    // vencimento antes do fechamento → vence no mês seguinte ao fechamento
    const c2 = { closingDay: 25, dueDay: 5 };
    expect(invoiceMonthFor(c2, '2026-10-10')).toBe('2026-11');
    expect(invoiceMonthFor(c2, '2026-10-26')).toBe('2026-12');
    expect(invoiceDates(c2, '2026-11')).toMatchObject({ closing: '2026-10-25', due: '2026-11-05' });
  });

  it('compra à vista no cartão: despesa no mês da compra, sem alterar saldo da conta', () => {
    let { data, corrente } = base();
    const r = withCard(data, corrente);
    data = r.data;
    data = ops.saveTransaction(data, tx({ amount: 25000, cardId: r.card.id, competenceDate: '2026-10-15', categoryId: 'cat-compras' }));
    const t = data.transactions[0];
    expect(t.invoiceMonth).toBe('2026-11');
    expect(t.accountId).toBeNull();
    expect(accountBalance(data, data.accounts[0])).toBe(100000);
    expect(periodSummary(data, '2026-10', TODAY).expense).toBe(25000);
    const sum = cardSummary(data, r.card, TODAY);
    expect(sum.used).toBe(25000);
    expect(sum.available).toBe(275000);
    expect(sum.current.month).toBe('2026-11');
    expect(sum.current.total).toBe(25000);
  });

  it('parcelamento gera N parcelas em faturas consecutivas e consome o limite total', () => {
    let { data, corrente } = base();
    const r = withCard(data, corrente);
    data = ops.saveInstallment(r.data, {
      description: 'Notebook', total: 300000, count: 3, purchaseDate: '2026-10-15',
      firstInvoiceMonth: '', cardId: r.card.id, categoryId: 'cat-compras', notes: '',
    });
    const inst = data.installments[0];
    expect(inst.firstInvoiceMonth).toBe('2026-11');
    const parcels = data.transactions.filter((t) => t.installmentId === inst.id);
    expect(parcels.map((p) => p.invoiceMonth)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(parcels.map((p) => p.competenceDate)).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
    expect(parcels.reduce((a, p) => a + p.amount, 0)).toBe(300000);
    // cada parcela conta uma única vez, no mês de competência
    expect(periodSummary(data, '2026-10', TODAY).expense).toBe(100000);
    expect(periodSummary(data, '2026-11', TODAY).expense).toBe(100000);
    expect(cardSummary(data, data.cards[0], TODAY).used).toBe(300000);
    const prog = installmentProgress(data, inst, TODAY);
    expect(prog).toMatchObject({ paidCount: 0, pendingCount: 3, currentNumber: 1 });
    expect(futureInstallments(data, TODAY).map((f) => f.month)).toEqual(['2026-11', '2026-12', '2027-01']);

    // editar o parcelamento regenera parcelas sem duplicar
    data = ops.saveInstallment(data, { ...inst, count: 4 });
    expect(data.transactions.filter((t) => t.installmentId === inst.id)).toHaveLength(4);
    expect(data.transactions).toHaveLength(4);

    // excluir parcela isolada não é permitido
    expect(() => ops.deleteTransaction(data, `${inst.id}-p1`)).toThrow(/parcela/);
    data = ops.deleteInstallment(data, inst.id);
    expect(data.transactions).toHaveLength(0);
  });

  it('pagar fatura liquida a obrigação sem criar nova despesa', () => {
    let { data, corrente } = base();
    const r = withCard(data, corrente);
    data = ops.saveTransaction(r.data, tx({ amount: 40000, cardId: r.card.id, competenceDate: '2026-09-20', categoryId: 'cat-lazer' }));
    const card = data.cards[0];
    expect(data.transactions[0].invoiceMonth).toBe('2026-10');
    const before = periodSummary(data, '2026-10', TODAY);
    expect(invoiceInfo(data, card, '2026-10', TODAY).status).toBe('overdue'); // venceu dia 10
    data = ops.payInvoice(data, { cardId: card.id, invoiceMonth: '2026-10', amount: 40000, date: '2026-10-09', accountId: corrente });
    const inv = invoiceInfo(data, card, '2026-10', TODAY);
    expect(inv.status).toBe('paid');
    expect(effectiveStatus(data, data.transactions[0], TODAY)).toBe('paid');
    // saldo da conta cai, limite é liberado
    expect(accountBalance(data, data.accounts[0])).toBe(60000);
    expect(cardSummary(data, card, TODAY).used).toBe(0);
    // despesas (setembro e outubro) inalteradas → sem duplicidade
    const after = periodSummary(data, '2026-10', TODAY);
    expect(after.expense).toBe(before.expense);
    expect(periodSummary(data, '2026-09', TODAY).expense).toBe(40000);
    expect(expensesByCategory(data, '2026-01-01', '2026-12-31').reduce((a, c) => a + c.total, 0)).toBe(40000);
  });

  it('correção manual da fatura de uma compra', () => {
    let { data, corrente } = base();
    const r = withCard(data, corrente);
    data = ops.saveTransaction(r.data, tx({ cardId: r.card.id, competenceDate: '2026-10-15' }));
    data = ops.setInvoiceMonth(data, data.transactions[0].id, '2026-12');
    expect(data.transactions[0].invoiceMonth).toBe('2026-12');
  });
});

describe('fluxo 8 — metas', () => {
  it('contribuição reserva dinheiro sem criar saldo nem despesa', () => {
    let { data, corrente } = base();
    data = ops.saveGoal(data, { name: 'Viagem', description: '', target: 500000, targetDate: '2027-06-01', priority: 'high', color: '#DB65AA', icon: '✈️' });
    const g = data.goals[0];
    data = ops.addContribution(data, g.id, { date: '2026-10-10', amount: 30000, accountId: corrente, note: '' });
    expect(goalSaved(data.goals[0])).toBe(30000);
    expect(totalReserved(data)).toBe(30000);
    expect(totalBalance(data)).toBe(150000); // saldo total inalterado
    expect(freeBalance(data, data.accounts[0])).toBe(70000);
    expect(periodSummary(data, '2026-10', TODAY).expense).toBe(0);
    // não permite reservar mais do que o saldo livre
    expect(() => ops.addContribution(data, g.id, { date: '2026-10-11', amount: 80000, accountId: corrente, note: '' })).toThrow(/insuficiente/);
    // resgate maior que o reservado é recusado
    expect(() => ops.addContribution(data, g.id, { date: '2026-10-11', amount: -40000, accountId: corrente, note: '' })).toThrow();
    data = ops.addContribution(data, g.id, { date: '2026-10-12', amount: -10000, accountId: corrente, note: 'resgate' });
    expect(goalSaved(data.goals[0])).toBe(20000);
  });
});

describe('fluxo 9 — orçamento', () => {
  it('indicadores refletem limites e lançamentos (cartão incluso uma vez)', () => {
    let { data, corrente } = base();
    const r = withCard(data, corrente);
    data = ops.setBudget(r.data, '2026-10', { overall: 100000, categories: { 'cat-lazer': 20000 }, savingsGoal: null });
    data = ops.saveTransaction(data, tx({ amount: 15000, accountId: corrente, categoryId: 'cat-lazer' }));
    data = ops.saveTransaction(data, tx({ amount: 10000, cardId: r.card.id, categoryId: 'cat-lazer', competenceDate: '2026-10-12' }));
    let u = budgetUsage(data, '2026-10');
    expect(u.lines[0]).toMatchObject({ planned: 20000, used: 25000, remaining: -5000 });
    expect(u.overallRemaining).toBe(75000);
    // pagar a fatura não muda o orçamento
    data = ops.payInvoice(data, { cardId: r.card.id, invoiceMonth: '2026-11', amount: 10000, date: '2026-10-14', accountId: corrente });
    expect(budgetUsage(data, '2026-10').totalUsed).toBe(25000);
    data = ops.setBudget(data, '2026-10', { overall: 100000, categories: { 'cat-lazer': 30000 }, savingsGoal: null });
    u = budgetUsage(data, '2026-10');
    expect(u.lines[0].remaining).toBe(5000);
    data = ops.copyBudgetFromPrevious(data, '2026-11');
    expect(data.budgets['2026-11'].categories['cat-lazer']).toBe(30000);
  });
});

describe('fluxo 10 — backup e CSV', () => {
  it('exporta, valida e restaura backup', () => {
    let { data, corrente } = base();
    data = ops.saveTransaction(data, tx({ accountId: corrente, description: 'Café; "especial"' }));
    const json = JSON.parse(JSON.stringify(makeBackup(data)));
    const r = validateBackup(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(data);
    const broken = JSON.parse(JSON.stringify(json));
    broken.data.transactions[0].accountId = 'nao-existe';
    const r2 = validateBackup(broken);
    expect(r2.ok).toBe(false);
    expect(validateBackup({ foo: 1 }).ok).toBe(false);
    const csv = transactionsToCSV(data, data.transactions, () => 'pago');
    expect(csv).toContain('"Café; ""especial"""');
    expect(csv).toContain('10,00');
  });
});

describe('mês financeiro', () => {
  it('respeita o primeiro dia configurado', () => {
    expect(periodOf('2026-10', 5)).toEqual({ start: '2026-10-05', end: '2026-11-04' });
    expect(financialMonthOf('2026-10-04', 5)).toBe('2026-09');
    expect(periodOf('2026-02', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});
