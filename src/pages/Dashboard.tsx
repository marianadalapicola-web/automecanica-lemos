import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { useQuickAdd } from '../components/Layout';
import { Empty, Money, MonthPicker, Progress } from '../components/ui';
import { Icon, Sparkle } from '../components/Icon';
import { BarsChart, ChartCard, HBarsChart } from '../components/charts';
import { TxRow } from '../components/TxRow';
import { AlertsBanner } from '../components/Alerts';
import {
  cardSummary,
  expensesByCategory,
  goalSaved,
  hasAnyData,
  moneyCheck,
  monthlySeries,
  periodSummary,
  totalBalance,
  totalReserved,
  upcoming,
} from '../lib/finance';
import { addMonths, diffDays, formatDate, formatMonth, periodOf } from '../lib/dates';
import { formatBRL, pct } from '../lib/money';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Dashboard() {
  const { data, today, month, setMonth } = useApp();
  const { openNew, openEdit } = useQuickAdd();
  const name = data.settings.displayName;

  if (!hasAnyData(data)) return <Welcome />;

  const { start, end } = periodOf(month, data.settings.monthStartDay);
  const s = periodSummary(data, month, today);
  const balance = totalBalance(data);
  const reserved = totalReserved(data);
  const series = monthlySeries(data, addMonths(month, -5), month);
  const cats = expensesByCategory(data, start, end);
  const insights = moneyCheck(data, month, today);
  const recent = [...data.transactions]
    .sort((a, b) => b.competenceDate.localeCompare(a.competenceDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const next = upcoming(data, today, 30).slice(0, 6);
  const topCats = cats.slice(0, 7);
  const rest = cats.slice(7).reduce((a, c) => a + c.total, 0);
  const catData = [...topCats.map((c) => ({ name: `${c.icon} ${c.name}`, total: c.total })), ...(rest ? [{ name: 'Outras', total: rest }] : [])];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}{name ? `, ${name}` : ''} <Sparkle size={18} /></h1>
          <p className="sub">your money, your dreams ♡</p>
        </div>
        <div className="row wrap">
          <MonthPicker value={month} onChange={setMonth} />
          <button className="btn primary" onClick={() => openNew()}><Icon name="plus" /> Adicionar</button>
        </div>
      </div>

      <AlertsBanner />

      <section className="grid stats" aria-label="Indicadores do período">
        <Stat label="Saldo total" value={<Money cents={balance} />} hint="Todas as contas, hoje" dot="var(--purple)" />
        <Stat label="Receitas" value={<Money cents={s.income} className="pos" />} hint={`Recebido: ${formatBRL(s.incomeReceived)}`} dot="var(--series-income)" />
        <Stat label="Despesas" value={<Money cents={s.expense} className="neg" />} hint="Por competência, inclui cartão" dot="var(--series-expense)" />
        <Stat
          label="Pendentes"
          value={<Money cents={s.payablePending + s.invoicesPending} />}
          hint={`${s.invoicesPending ? `Faturas ${formatBRL(s.invoicesPending)} · ` : ''}A receber ${formatBRL(s.receivablePending)}`}
          dot="var(--s3)"
        />
        <Stat label="Reservado em metas" value={<Money cents={reserved} />} hint={`Livre: ${formatBRL(balance - reserved)}`} dot="var(--s5)" />
        <Stat
          label="Renda poupada"
          value={<span className={`num ${s.savingsRate >= 0 ? 'pos' : 'neg'}`}>{s.income ? `${Math.round(s.savingsRate)}%` : '—'}</span>}
          hint={s.income ? `Sobra: ${formatBRL(s.net)}` : 'Sem receitas no período'}
          dot="var(--mint)"
        />
      </section>

      <section className="card glossy" aria-labelledby="mc">
        <div className="card-head">
          <h2 id="mc"><span className="money-check-title">Money check</span> <Sparkle size={16} /></h2>
          <span className="small muted">{formatMonth(month)}</span>
        </div>
        {insights.length ? (
          <div className="insights">
            {insights.map((i, k) => (
              <div key={k} className={`insight ${i.tone}`}>
                <span className="ic" aria-hidden>{i.icon}</span>
                <div>
                  <strong>{i.title}</strong>
                  <p className="small muted">{i.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">Registre receitas e despesas neste mês para ver suas análises.</p>
        )}
      </section>

      <div className="grid two">
        <ChartCard
          title="Receitas × despesas"
          subtitle="Últimos 6 meses"
          legend={[
            { key: 'income', name: 'Receitas', color: 'var(--series-income)' },
            { key: 'expense', name: 'Despesas', color: 'var(--series-expense)' },
          ]}
          table={{ head: ['Mês', 'Receitas', 'Despesas', 'Saldo'], rows: series.map((p) => [formatMonth(p.month, true), p.income, p.expense, p.net]) }}
          empty={series.every((p) => !p.income && !p.expense)}
        >
          <BarsChart
            data={series}
            xKey="month"
            xFmt={(m) => formatMonth(m, true)}
            series={[
              { key: 'income', name: 'Receitas', color: 'var(--series-income)' },
              { key: 'expense', name: 'Despesas', color: 'var(--series-expense)' },
            ]}
          />
          <HistoryTable series={series} />
        </ChartCard>

        <ChartCard
          title="Gastos por categoria"
          subtitle={formatMonth(month)}
          table={{ head: ['Categoria', 'Total', '% das despesas'], rows: cats.map((c) => [`${c.icon} ${c.name}`, c.total, `${Math.round(pct(c.total, s.expense))}%`]) }}
          empty={!cats.length}
        >
          <HBarsChart data={catData} />
        </ChartCard>
      </div>

      <div className="grid three">
        <section className="card">
          <div className="card-head">
            <h2>Transações recentes</h2>
            <Link to="/transacoes" className="btn sm ghost">Ver todas</Link>
          </div>
          {recent.length ? (
            <div className="tx-list">{recent.map((t) => <TxRow key={t.id} t={t} onClick={() => openEdit(t)} />)}</div>
          ) : (
            <Empty title="Nenhuma transação" action={<button className="btn primary sm" onClick={() => openNew()}>Adicionar</button>} />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Próximos vencimentos</h2>
            <span className="small muted">30 dias</span>
          </div>
          {next.length ? (
            <ul className="tx-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {next.map((u) => {
                const d = diffDays(today, u.date);
                return (
                  <li key={u.id} className="tx-row" style={{ cursor: u.tx ? 'pointer' : 'default' }} onClick={() => u.tx && openEdit(u.tx)}>
                    <span className="tx-icon" aria-hidden>{u.kind === 'invoice' ? '💳' : u.kind === 'income' ? '💰' : '🧾'}</span>
                    <span className="tx-main">
                      <span className="tx-title" style={{ display: 'block' }}>{u.label}</span>
                      <span className="tx-meta">
                        {formatDate(u.date)} ·{' '}
                        {u.overdue ? <span className="chip overdue">! Vencido há {-d}d</span> : d === 0 ? <span className="chip pending">Vence hoje</span> : <span>em {d} dia{d > 1 ? 's' : ''}</span>}
                      </span>
                    </span>
                    <span className={`tx-amount ${u.kind === 'income' ? 'pos' : ''}`}>{formatBRL(u.amount)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty art="🌸" title="Nada a vencer" text="Nenhuma conta ou fatura pendente nos próximos 30 dias." />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Cartões</h2>
            <Link to="/contas?aba=cartoes" className="btn sm ghost">Gerenciar</Link>
          </div>
          {data.cards.filter((c) => !c.archived).length ? (
            <div className="stack">
              {data.cards.filter((c) => !c.archived).map((c) => {
                const cs = cardSummary(data, c, today);
                return (
                  <div key={c.id} className="stack" style={{ gap: 6 }}>
                    <div className="row between">
                      <strong>💳 {c.nickname || c.name}</strong>
                      <span className="small">Fatura {formatMonth(cs.current.month, true)}: <strong className="num">{formatBRL(cs.current.total)}</strong></span>
                    </div>
                    <Progress value={pct(cs.used, c.limit)} tone={pct(cs.used, c.limit) > 90 ? 'over' : 'lilac'} label={`Limite usado do ${c.name}`} />
                    <div className="row between tiny muted">
                      <span>Usado {formatBRL(cs.used)}</span>
                      <span>Disponível {formatBRL(cs.available)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty art="💳" title="Sem cartões" text="Cadastre um cartão para acompanhar faturas." action={<Link to="/contas?aba=cartoes&nova=cartao" className="btn sm">Adicionar cartão</Link>} />
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Metas financeiras</h2>
          <Link to="/metas" className="btn sm ghost">Ver metas</Link>
        </div>
        {data.goals.length ? (
          <div className="grid three">
            {data.goals.slice(0, 6).map((g) => {
              const saved = goalSaved(g);
              return (
                <div key={g.id} className="stack" style={{ gap: 6 }}>
                  <div className="row between">
                    <strong>{g.icon} {g.name}</strong>
                    <span className="small num">{Math.round(pct(saved, g.target))}%</span>
                  </div>
                  <Progress value={pct(saved, g.target)} tone={saved >= g.target ? 'mint' : ''} label={`Progresso da meta ${g.name}`} />
                  <span className="tiny muted">{formatBRL(saved)} de {formatBRL(g.target)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty art="⭐" title="Nenhuma meta ainda" text="Que tal começar a guardar para um sonho?" action={<Link to="/metas" className="btn sm">Criar meta</Link>} />
        )}
      </section>
    </>
  );
}

function HistoryTable({ series }: { series: { month: string; income: number; expense: number; net: number }[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Histórico dos últimos meses</caption>
        <thead>
          <tr><th>Mês</th><th className="r">Receitas</th><th className="r">Despesas</th><th className="r">Saldo</th></tr>
        </thead>
        <tbody>
          {[...series].reverse().slice(0, 4).map((p) => (
            <tr key={p.month}>
              <td>{formatMonth(p.month, true)}</td>
              <td className="r">{formatBRL(p.income)}</td>
              <td className="r">{formatBRL(p.expense)}</td>
              <td className={`r ${p.net >= 0 ? 'pos' : 'neg'}`}>{formatBRL(p.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint, dot }: { label: string; value: React.ReactNode; hint?: string; dot: string }) {
  return (
    <div className="card glossy stat">
      <span className="label"><span className="dot" style={{ background: dot }} />{label}</span>
      <span className="value">{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Welcome() {
  const { data } = useApp();
  const { openNew } = useQuickAdd();
  const hasAccount = data.accounts.length > 0;
  return (
    <section className="card glossy" style={{ padding: '36px 22px' }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: '2.6rem' }} aria-hidden>🦋 <Sparkle size={30} /> 💖</div>
        <h1>Boas-vindas ao Glossy Money{data.settings.displayName ? `, ${data.settings.displayName}` : ''}!</h1>
        <p className="muted" style={{ maxWidth: 520 }}>
          Seu organizador financeiro está prontinho. Comece cadastrando onde seu dinheiro está e registre seus primeiros lançamentos — os
          gráficos e análises aparecem automaticamente.
        </p>
        <ol className="stack" style={{ textAlign: 'left', maxWidth: 420, paddingLeft: 20, margin: 0 }}>
          <li><strong>Crie uma conta</strong> (corrente, digital, poupança ou dinheiro) com o saldo atual.</li>
          <li><strong>Lance sua primeira receita</strong>, como o salário.</li>
          <li><strong>Registre despesas</strong> e, se quiser, cadastre seus cartões.</li>
        </ol>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <Link className={`btn ${hasAccount ? '' : 'primary'}`} to="/contas?nova=conta"><Icon name="wallet" /> Criar conta</Link>
          <button className={`btn ${hasAccount ? 'primary' : ''}`} onClick={() => openNew({ type: 'income' })}><Icon name="plus" /> Primeira receita</button>
          <button className="btn" onClick={() => openNew({ type: 'expense' })}>Primeira despesa</button>
        </div>
      </div>
    </section>
  );
}
