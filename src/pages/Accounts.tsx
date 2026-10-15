import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { useQuickAdd } from '../components/Layout';
import { Empty, Modal, Money, MoneyInput, Progress, StatusChip, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import * as ops from '../data/ops';
import type { Account, AccountType, CardTheme, CreditCard } from '../data/types';
import { ACCOUNT_TYPE_LABEL, CARD_THEMES, SWATCHES } from '../data/defaults';
import {
  accountBalance,
  cardSummary,
  currentInvoiceMonth,
  effectiveStatus,
  invoiceInfo,
  invoiceMonths,
  reservedInAccount,
  statement,
  totalBalance,
  type InvoiceStatus,
} from '../lib/finance';
import { addMonths, formatDate, formatMonth } from '../lib/dates';
import { formatBRL, pct } from '../lib/money';

export default function Accounts() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'cartoes' ? 'cards' : 'accounts';
  const setTab = (t: string) => setParams(t === 'cards' ? { aba: 'cartoes' } : {});
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contas e cartões</h1>
          <p className="sub">Onde seu dinheiro está e o que está no crédito</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'accounts'} onClick={() => setTab('accounts')}>🏦 Contas</button>
        <button role="tab" aria-selected={tab === 'cards'} onClick={() => setTab('cards')}>💳 Cartões de crédito</button>
      </div>
      {tab === 'accounts' ? <AccountsTab /> : <CardsTab />}
    </>
  );
}

// ───────────────────────── Contas ─────────────────────────

function AccountsTab() {
  const { data, update } = useApp();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<Account | 'new' | null>(params.get('nova') === 'conta' ? 'new' : null);
  const [stmt, setStmt] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (params.get('nova')) setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = data.accounts.filter((a) => showArchived || !a.archived);

  const remove = async (a: Account) => {
    const yes = await confirm({ title: 'Excluir conta?', message: `A conta “${a.name}” será excluída.`, confirmLabel: 'Excluir', danger: true });
    if (yes) update((d) => ops.deleteAccount(d, a.id), 'Conta excluída');
  };

  return (
    <>
      <div className="row between wrap">
        <div>
          <div className="small muted">Saldo total</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}><Money cents={totalBalance(data)} /></div>
        </div>
        <div className="row wrap">
          {data.accounts.some((a) => a.archived) && (
            <label className="check small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivadas</label>
          )}
          <button className="btn primary" onClick={() => setEdit('new')}><Icon name="plus" /> Nova conta</button>
        </div>
      </div>
      {list.length ? (
        <div className="grid three">
          {list.map((a) => {
            const bal = accountBalance(data, a);
            const reserved = reservedInAccount(data, a.id);
            return (
              <article key={a.id} className="card glossy stack" style={{ borderTop: `4px solid ${a.color}`, opacity: a.archived ? 0.6 : 1 }}>
                <div className="row between">
                  <div>
                    <h3>{a.name}</h3>
                    <span className="small muted">{ACCOUNT_TYPE_LABEL[a.type]}{a.archived ? ' · arquivada' : ''}</span>
                  </div>
                  <span className="tx-icon" aria-hidden>{a.type === 'cash' ? '💵' : a.type === 'savings' ? '🐷' : a.type === 'digital' ? '📱' : '🏦'}</span>
                </div>
                <div>
                  <div className={`num ${bal < 0 ? 'neg' : ''}`} style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatBRL(bal)}</div>
                  {reserved !== 0 && <div className="small muted">Reservado em metas {formatBRL(reserved)} · livre {formatBRL(bal - reserved)}</div>}
                  <div className="tiny muted">Controle desde {formatDate(a.startDate)} · saldo inicial {formatBRL(a.initialBalance)}</div>
                </div>
                <div className="row wrap">
                  <button className="btn sm" onClick={() => setStmt(a)}><Icon name="list" size={16} /> Extrato</button>
                  <button className="btn sm ghost" onClick={() => setEdit(a)}><Icon name="edit" size={16} /> Editar</button>
                  <button className="btn sm ghost" onClick={() => update((d) => ops.saveAccount(d, { ...a, archived: !a.archived }), a.archived ? 'Conta reativada' : 'Conta arquivada')}>
                    {a.archived ? 'Reativar' : 'Arquivar'}
                  </button>
                  <button className="icon-btn" onClick={() => remove(a)} aria-label={`Excluir ${a.name}`}><Icon name="trash" size={18} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty art="🏦" title="Nenhuma conta cadastrada" text="Cadastre conta corrente, conta digital, poupança ou dinheiro em espécie." action={<button className="btn primary" onClick={() => setEdit('new')}>Criar conta</button>} />
        </section>
      )}
      {edit && <AccountForm account={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {stmt && <StatementModal account={stmt} onClose={() => setStmt(null)} />}
    </>
  );
}

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { update, today } = useApp();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [initial, setInitial] = useState<number | null>(account?.initialBalance ?? 0);
  const [startDate, setStart] = useState(account?.startDate ?? today);
  const [color, setColor] = useState(account?.color ?? SWATCHES[0]);
  const save = () => {
    const ok = update(
      (d) => ops.saveAccount(d, { id: account?.id, name, type, initialBalance: initial ?? NaN, startDate, color, archived: account?.archived }),
      account ? 'Conta atualizada ✧' : 'Conta criada ✧',
    );
    if (ok) onClose();
  };
  return (
    <Modal title={account ? 'Editar conta' : 'Nova conta'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <form className="form-grid cols" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field span2"><span>Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Itaú, Carteira" required maxLength={60} /></label>
        <label className="field"><span>Tipo</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <MoneyInput label="Saldo inicial" value={initial} onChange={setInitial} allowNegative />
        <label className="field"><span>Início do controle</span><input type="date" className="input" value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <div className="field"><span>Cor</span>
          <div className="row wrap" role="radiogroup" aria-label="Cor">
            {SWATCHES.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '2px solid #fff', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
        <p className="form-note span2">O saldo atual é calculado a partir do saldo inicial somado às receitas, despesas pagas, transferências e pagamentos de fatura.</p>
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}

function StatementModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const { data, today } = useApp();
  const { openEdit } = useQuickAdd();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [at, setAt] = useState(today);
  const st = statement(data, account, from, to);
  const label: Record<string, string> = { income: 'Receita', expense: 'Despesa', transfer_in: 'Transferência recebida', transfer_out: 'Transferência enviada', invoice_payment: 'Pagamento de fatura' };
  return (
    <Modal title={`Extrato · ${account.name}`} onClose={onClose} wide>
      <div className="stack">
        <div className="row wrap">
          <label className="field"><span>De</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>Até</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <div className="card" style={{ padding: 12, boxShadow: 'none' }}>
            <label className="field"><span>Consultar saldo em</span><input type="date" className="input" value={at} onChange={(e) => setAt(e.target.value)} /></label>
            <div style={{ fontWeight: 800, marginTop: 6 }} className="num">
              {at < account.startDate ? <span className="muted small">Antes do início do controle ({formatDate(account.startDate)})</span> : formatBRL(accountBalance(data, account, at))}
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th className="r">Valor</th><th className="r">Saldo</th></tr></thead>
            <tbody>
              <tr><td colSpan={4} className="muted">Saldo anterior</td><td className="r num">{formatBRL(st.opening)}</td></tr>
              {st.rows.map((r) => (
                <tr key={r.id} onClick={() => r.ref && openEdit(r.ref)} style={{ cursor: r.ref ? 'pointer' : 'default' }}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.description}</td>
                  <td className="small muted">{label[r.kind]}</td>
                  <td className={`r ${r.delta >= 0 ? 'pos' : 'neg'}`}>{formatBRL(r.delta)}</td>
                  <td className="r">{formatBRL(r.balance)}</td>
                </tr>
              ))}
              <tr><td colSpan={4}><strong>Saldo final</strong></td><td className="r"><strong>{formatBRL(st.closing)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        {!st.rows.length && <p className="muted small">Nenhum movimento efetivado no período. Lançamentos pendentes não alteram o saldo até serem pagos.</p>}
      </div>
    </Modal>
  );
}

// ───────────────────────── Cartões ─────────────────────────

function CardsTab() {
  const { data, today, update } = useApp();
  const { openNew } = useQuickAdd();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<CreditCard | 'new' | null>(params.get('nova') === 'cartao' ? 'new' : null);
  const [inv, setInv] = useState<CreditCard | null>(null);

  useEffect(() => {
    if (params.get('nova')) setParams({ aba: 'cartoes' }, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (c: CreditCard) => {
    const yes = await confirm({ title: 'Excluir cartão?', message: `O cartão “${c.name}” será excluído.`, confirmLabel: 'Excluir', danger: true });
    if (yes) update((d) => ops.deleteCard(d, c.id), 'Cartão excluído');
  };

  if (!data.accounts.length)
    return (
      <section className="card">
        <Empty art="🏦" title="Cadastre uma conta antes" text="O cartão precisa de uma conta para pagamento da fatura." />
      </section>
    );

  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={() => setEdit('new')}><Icon name="plus" /> Novo cartão</button>
      </div>
      {data.cards.length ? (
        <div className="grid two">
          {data.cards.map((c) => {
            const s = cardSummary(data, c, today);
            return (
              <article key={c.id} className="card stack" style={{ opacity: c.archived ? 0.6 : 1 }}>
                <div className={`cc ${c.theme}`}>
                  <div className="row between">
                    <span className="cc-name">{c.nickname || c.name}</span>
                    <span aria-hidden>✧ ♡</span>
                  </div>
                  <div className="chip-ic" aria-hidden />
                  <div className="row between">
                    <div>
                      <div className="tiny" style={{ opacity: 0.8 }}>Fatura atual · {formatMonth(s.current.month, true)}</div>
                      <div className="cc-nums" style={{ fontSize: '1.3rem' }}>{formatBRL(s.current.total)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tiny" style={{ opacity: 0.8 }}>{c.name}</div>
                      <div className="tiny cc-nums">fecha {c.closingDay} · vence {c.dueDay}</div>
                    </div>
                  </div>
                </div>
                <Progress value={pct(s.used, c.limit)} tone={pct(s.used, c.limit) > 90 ? 'over' : 'lilac'} label="Limite utilizado" />
                <div className="grid stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <MiniStat label="Limite utilizado" value={formatBRL(s.used)} />
                  <MiniStat label="Limite disponível" value={formatBRL(s.available)} tone={s.available < 0 ? 'neg' : ''} />
                  <MiniStat label={`Fatura anterior (${formatMonth(s.previous.month, true)})`} value={formatBRL(s.previous.total)} extra={s.previous.status !== 'empty' ? <InvoiceChip status={s.previous.status} /> : null} />
                  <MiniStat label="Próximo vencimento" value={formatDate(s.nextDue.due)} extra={<span className="tiny muted">{formatBRL(s.nextDue.remaining)} em aberto</span>} />
                </div>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Compras recentes</h3>
                  {s.recent.length ? (
                    <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }}>
                      {s.recent.map((t) => (
                        <li key={t.id} className="row between small">
                          <span className="ellipsis grow">{formatDate(t.competenceDate)} · {t.description}</span>
                          <strong className="num">{formatBRL(t.amount)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="small muted">Nenhuma compra registrada.</p>}
                </div>
                <div className="row wrap">
                  <button className="btn sm primary" onClick={() => openNew({ type: 'expense', cardId: c.id })} disabled={c.archived}><Icon name="plus" size={16} /> Compra</button>
                  <button className="btn sm" onClick={() => setInv(c)}><Icon name="card" size={16} /> Faturas</button>
                  <button className="btn sm ghost" onClick={() => setEdit(c)}><Icon name="edit" size={16} /> Editar</button>
                  <button className="btn sm ghost" onClick={() => update((d) => ops.saveCard(d, { ...c, archived: !c.archived }), c.archived ? 'Cartão reativado' : 'Cartão arquivado')}>{c.archived ? 'Reativar' : 'Arquivar'}</button>
                  <button className="icon-btn" onClick={() => remove(c)} aria-label={`Excluir ${c.name}`}><Icon name="trash" size={18} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty art="💳" title="Nenhum cartão" text="Cadastre seus cartões para acompanhar limite, faturas e parcelas." action={<button className="btn primary" onClick={() => setEdit('new')}>Adicionar cartão</button>} />
        </section>
      )}
      {edit && <CardForm card={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {inv && <InvoicesModal card={inv} onClose={() => setInv(null)} />}
    </>
  );
}

function MiniStat({ label, value, tone = '', extra }: { label: string; value: string; tone?: string; extra?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '10px 12px' }}>
      <div className="tiny muted" style={{ fontWeight: 700 }}>{label}</div>
      <div className={`num ${tone}`} style={{ fontWeight: 800 }}>{value}</div>
      {extra}
    </div>
  );
}

const INV_LABEL: Record<InvoiceStatus, [string, string]> = {
  open: ['Aberta', 'info'],
  closed: ['Fechada', 'pending'],
  partial: ['Paga parcialmente', 'pending'],
  paid: ['Paga', 'paid'],
  overdue: ['Vencida', 'overdue'],
  empty: ['Sem lançamentos', ''],
};
export function InvoiceChip({ status }: { status: InvoiceStatus }) {
  const [l, c] = INV_LABEL[status];
  return <span className={`chip ${c}`}>{l}</span>;
}

function CardForm({ card, onClose }: { card?: CreditCard; onClose: () => void }) {
  const { data, update } = useApp();
  const [name, setName] = useState(card?.name ?? '');
  const [nickname, setNick] = useState(card?.nickname ?? '');
  const [limit, setLimit] = useState<number | null>(card?.limit ?? null);
  const [closingDay, setClosing] = useState(card?.closingDay ?? 1);
  const [dueDay, setDue] = useState(card?.dueDay ?? 10);
  const [acc, setAcc] = useState(card?.paymentAccountId ?? data.accounts.find((a) => !a.archived)?.id ?? '');
  const [theme, setTheme] = useState<CardTheme>(card?.theme ?? 'bubblegum');
  const save = () => {
    const ok = update(
      (d) => ops.saveCard(d, { id: card?.id, name, nickname, limit: limit ?? NaN, closingDay, dueDay, paymentAccountId: acc, theme, archived: card?.archived }),
      card ? 'Cartão atualizado ✧' : 'Cartão criado ✧',
    );
    if (ok) onClose();
  };
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <Modal title={card ? 'Editar cartão' : 'Novo cartão'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <form className="form-grid cols" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className={`cc ${theme} span2`} style={{ minHeight: 0, maxWidth: 320, margin: '0 auto' }} aria-hidden>
          <span className="cc-name">{nickname || name || 'Meu cartão'}</span>
          <div className="chip-ic" />
          <span className="cc-nums">{limit != null ? formatBRL(limit) : 'R$ —'}</span>
        </div>
        <label className="field"><span>Nome do cartão</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank Mastercard" maxLength={60} /></label>
        <label className="field"><span>Apelido</span><input className="input" value={nickname} onChange={(e) => setNick(e.target.value)} placeholder="Ex.: Roxinho" maxLength={30} /></label>
        <MoneyInput label="Limite total" value={limit} onChange={setLimit} />
        <label className="field"><span>Conta para pagamento</span>
          <select className="input" value={acc} onChange={(e) => setAcc(e.target.value)}>
            {data.accounts.filter((a) => !a.archived || a.id === acc).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Dia de fechamento</span>
          <select className="input" value={closingDay} onChange={(e) => setClosing(Number(e.target.value))}>{days.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
        <label className="field"><span>Dia de vencimento</span>
          <select className="input" value={dueDay} onChange={(e) => setDue(Number(e.target.value))}>{days.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
        <div className="field span2"><span>Tema visual</span>
          <div className="segmented" role="group" aria-label="Tema do cartão" style={{ flexWrap: 'wrap', borderRadius: 18 }}>
            {CARD_THEMES.map((t) => <button type="button" key={t.id} aria-pressed={theme === t.id} onClick={() => setTheme(t.id as CardTheme)}>{t.label}</button>)}
          </div>
        </div>
        <p className="form-note span2">
          Regra: compras feitas antes do dia {closingDay} entram na fatura que fecha naquele mês; a partir do dia {closingDay}, na seguinte.
          {dueDay <= closingDay ? ' Como o vencimento é antes do fechamento, a fatura vence no mês seguinte ao fechamento.' : ''} Dias limitados a 28 para valer em todos os meses.
        </p>
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}

function InvoicesModal({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const { data, today, update } = useApp();
  const { openEdit } = useQuickAdd();
  const confirm = useConfirm();
  const cur = currentInvoiceMonth(card, today);
  const months = Array.from(new Set([...invoiceMonths(data, card.id), cur])).sort();
  const [month, setMonth] = useState(cur);
  const info = invoiceInfo(data, card, month, today);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [payAcc, setPayAcc] = useState(card.paymentAccountId);
  const [payDate, setPayDate] = useState(today);
  const payments = data.invoicePayments.filter((p) => p.cardId === card.id && p.invoiceMonth === month);

  useEffect(() => setPayAmount(info.remaining || null), [month, info.remaining]);

  const pay = () => {
    if (!payAmount) return;
    update((d) => ops.payInvoice(d, { cardId: card.id, invoiceMonth: month, amount: payAmount, date: payDate, accountId: payAcc }), 'Pagamento de fatura registrado ✧');
  };
  const removePayment = async (id: string) => {
    if (await confirm({ title: 'Excluir pagamento?', message: 'O valor volta para o saldo da conta e a fatura volta a ficar em aberto.', danger: true, confirmLabel: 'Excluir' }))
      update((d) => ops.deleteInvoicePayment(d, id), 'Pagamento excluído');
  };

  return (
    <Modal title={`Faturas · ${card.nickname || card.name}`} onClose={onClose} wide>
      <div className="stack">
        <div className="row wrap between">
          <div className="month-picker">
            <button className="icon-btn" aria-label="Fatura anterior" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" /></button>
            <select className="input" style={{ border: 0, minWidth: 170 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Fatura">
              {Array.from(new Set([...months, month])).sort().map((m) => <option key={m} value={m}>{formatMonth(m)}{m === cur ? ' (atual)' : ''}</option>)}
            </select>
            <button className="icon-btn" aria-label="Próxima fatura" onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" /></button>
          </div>
          <InvoiceChip status={info.status} />
        </div>
        <div className="grid stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <MiniStat label="Total" value={formatBRL(info.total)} />
          <MiniStat label="Pago" value={formatBRL(info.paid)} />
          <MiniStat label="Em aberto" value={formatBRL(info.remaining)} />
          <MiniStat label="Fechamento" value={formatDate(info.closing)} />
          <MiniStat label="Vencimento" value={formatDate(info.due)} />
        </div>

        <h3>Lançamentos da fatura</h3>
        {info.items.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Status</th><th className="r">Valor</th></tr></thead>
              <tbody>
                {info.items.map((t) => (
                  <tr key={t.id} onClick={() => openEdit(t)} style={{ cursor: 'pointer' }} title="Clique para editar ou corrigir a fatura">
                    <td>{formatDate(t.competenceDate)}</td>
                    <td>{t.description}</td>
                    <td><StatusChip status={effectiveStatus(data, t, today)} /></td>
                    <td className="r">{formatBRL(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="small muted">Nenhuma compra nesta fatura.</p>}
        <p className="tiny muted">Clique em um lançamento para mover para outra fatura (correção manual de datas).</p>

        <h3>Pagamentos</h3>
        {payments.length ? (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }}>
            {payments.map((p) => (
              <li key={p.id} className="row between small">
                <span>{formatDate(p.date)} · {data.accounts.find((a) => a.id === p.accountId)?.name}</span>
                <span className="row"><strong className="num">{formatBRL(p.amount)}</strong><button className="icon-btn" onClick={() => removePayment(p.id)} aria-label="Excluir pagamento"><Icon name="trash" size={16} /></button></span>
              </li>
            ))}
          </ul>
        ) : <p className="small muted">Nenhum pagamento registrado.</p>}

        {info.remaining > 0 && (
          <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
            <h3 style={{ marginBottom: 10 }}>Pagar fatura</h3>
            <div className="form-grid cols">
              <MoneyInput label="Valor" value={payAmount} onChange={setPayAmount} />
              <label className="field"><span>Conta</span>
                <select className="input" value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>
                  {data.accounts.filter((a) => !a.archived || a.id === payAcc).map((a) => <option key={a.id} value={a.id}>{a.name} ({formatBRL(accountBalance(data, a))})</option>)}
                </select>
              </label>
              <label className="field"><span>Data</span><input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></label>
              <div className="field" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={pay} disabled={!payAmount}>Registrar pagamento</button></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              O pagamento debita a conta e libera o limite, mas não é uma nova despesa — as compras já foram contabilizadas nas datas em que foram feitas.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
