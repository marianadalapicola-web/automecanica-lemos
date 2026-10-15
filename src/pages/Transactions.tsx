import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { useQuickAdd } from '../components/Layout';
import { Empty, MonthPicker } from '../components/ui';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { effectiveStatus } from '../lib/finance';
import { periodOf } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { downloadFile, transactionsToCSV } from '../lib/backup';
import type { Transaction } from '../data/types';

const PAGE = 25;
type Sort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export default function Transactions() {
  const { data, today, month, setMonth } = useApp();
  const { openNew, openEdit } = useQuickAdd();
  const [q, setQ] = useState('');
  const [periodMode, setPeriodMode] = useState<'month' | 'range' | 'all'>('month');
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<Sort>('date_desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let start = '0000-01-01';
    let end = '9999-12-31';
    if (periodMode === 'month') ({ start, end } = periodOf(month, data.settings.monthStartDay));
    else if (periodMode === 'range') {
      start = from || start;
      end = to || end;
    }
    const needle = q.trim().toLowerCase();
    const list = data.transactions.filter((t) => {
      if (t.competenceDate < start || t.competenceDate > end) return false;
      if (needle && !t.description.toLowerCase().includes(needle) && !t.notes.toLowerCase().includes(needle)) return false;
      if (type && t.type !== type) return false;
      if (category && (category === '__none' ? t.categoryId : t.categoryId !== category)) return false;
      if (source) {
        const [k, id] = source.split(':');
        if (k === 'acc' && t.accountId !== id && t.toAccountId !== id) return false;
        if (k === 'card' && t.cardId !== id) return false;
      }
      if (status && (t.type === 'transfer' || effectiveStatus(data, t, today) !== status)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: Transaction, b: Transaction) => number> = {
      date_desc: (a, b) => b.competenceDate.localeCompare(a.competenceDate) || b.createdAt.localeCompare(a.createdAt),
      date_asc: (a, b) => a.competenceDate.localeCompare(b.competenceDate) || a.createdAt.localeCompare(b.createdAt),
      amount_desc: (a, b) => b.amount - a.amount,
      amount_asc: (a, b) => a.amount - b.amount,
    };
    return list.sort(cmp[sort]);
  }, [data, q, periodMode, month, from, to, type, category, source, status, sort, today]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const totals = filtered.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.inc += t.amount;
      if (t.type === 'expense') acc.exp += t.amount;
      return acc;
    },
    { inc: 0, exp: 0 },
  );

  const exportCSV = () => {
    const label = { paid: 'Pago', pending: 'Pendente', overdue: 'Vencido' };
    const csv = transactionsToCSV(data, filtered, (t) => (t.type === 'transfer' ? (t.status === 'paid' ? 'Efetivada' : 'Agendada') : label[effectiveStatus(data, t, today)]));
    downloadFile(`glossy-money-transacoes-${today}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transações</h1>
          <p className="sub">{filtered.length} lançamento(s) · receitas {formatBRL(totals.inc)} · despesas {formatBRL(totals.exp)}</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={exportCSV} disabled={!filtered.length}><Icon name="download" /> CSV</button>
          <button className="btn primary" onClick={() => openNew()}><Icon name="plus" /> Novo</button>
        </div>
      </div>

      <section className="card stack" aria-label="Filtros">
        <div className="row wrap">
          <div className="segmented" role="group" aria-label="Período">
            {(['month', 'range', 'all'] as const).map((m) => (
              <button key={m} aria-pressed={periodMode === m} onClick={() => reset(() => setPeriodMode(m))}>
                {m === 'month' ? 'Mês' : m === 'range' ? 'Período' : 'Tudo'}
              </button>
            ))}
          </div>
          {periodMode === 'month' && <MonthPicker value={month} onChange={(m) => reset(() => setMonth(m))} />}
          {periodMode === 'range' && (
            <div className="row wrap">
              <label className="field"><span className="sr-only">De</span><input type="date" className="input" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} aria-label="Data inicial" /></label>
              <span className="muted">até</span>
              <label className="field"><span className="sr-only">Até</span><input type="date" className="input" value={to} onChange={(e) => reset(() => setTo(e.target.value))} aria-label="Data final" /></label>
            </div>
          )}
        </div>
        <div className="filters">
          <label className="field search">
            <span className="sr-only">Pesquisar</span>
            <input className="input" type="search" placeholder="🔍 Pesquisar descrição…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
          </label>
          <select className="input" value={type} onChange={(e) => reset(() => setType(e.target.value))} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
            <option value="transfer">Transferências</option>
          </select>
          <select className="input" value={category} onChange={(e) => reset(() => setCategory(e.target.value))} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            <option value="__none">Sem categoria</option>
          </select>
          <select className="input" value={source} onChange={(e) => reset(() => setSource(e.target.value))} aria-label="Conta ou cartão">
            <option value="">Todas as contas</option>
            {data.accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
            {data.cards.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.nickname || c.name}</option>)}
          </select>
          <select className="input" value={status} onChange={(e) => reset(() => setStatus(e.target.value))} aria-label="Status">
            <option value="">Todos os status</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Vencidos</option>
          </select>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenação">
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>
        </div>
      </section>

      <section className="card">
        {shown.length ? (
          <>
            <div className="tx-list">{shown.map((t) => <TxRow key={t.id} t={t} onClick={() => openEdit(t)} />)}</div>
            {pages > 1 && (
              <nav className="row" style={{ justifyContent: 'center', marginTop: 14 }} aria-label="Paginação">
                <button className="btn sm" disabled={cur === 1} onClick={() => setPage(cur - 1)}><Icon name="left" /> Anterior</button>
                <span className="small muted">Página {cur} de {pages}</span>
                <button className="btn sm" disabled={cur === pages} onClick={() => setPage(cur + 1)}>Próxima <Icon name="right" /></button>
              </nav>
            )}
          </>
        ) : data.transactions.length ? (
          <Empty art="🔍" title="Nada encontrado" text="Nenhum lançamento corresponde aos filtros." />
        ) : (
          <Empty art="🧾" title="Nenhum lançamento ainda" text="Registre sua primeira receita ou despesa." action={<button className="btn primary" onClick={() => openNew()}>Adicionar lançamento</button>} />
        )}
      </section>
    </>
  );
}
