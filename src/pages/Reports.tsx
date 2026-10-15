import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { BarsChart, ChartCard, HBarsChart, LinesChart, SERIES, type SeriesDef } from '../components/charts';
import { Icon } from '../components/Icon';
import {
  balanceHistory,
  budgetUsage,
  expensesByCategory,
  fixedVsVariable,
  futureInstallments,
  goalHistory,
  monthlySeries,
  spendingByCard,
} from '../lib/finance';
import { addMonths, formatMonth, monthRange, periodOf } from '../lib/dates';
import { downloadFile, makeBackup, transactionsToCSV } from '../lib/backup';
import { effectiveStatus } from '../lib/finance';

const fmtM = (m: string) => formatMonth(m, true);

export default function Reports() {
  const { data, today, month } = useApp();
  const [preset, setPreset] = useState<'3' | '6' | '12' | 'year' | 'custom'>('6');
  const [cFrom, setCFrom] = useState(addMonths(month, -5));
  const [cTo, setCTo] = useState(month);

  let from = addMonths(month, -5);
  let to = month;
  if (preset === '3') from = addMonths(month, -2);
  if (preset === '12') from = addMonths(month, -11);
  if (preset === 'year') {
    from = `${month.slice(0, 4)}-01`;
    to = `${month.slice(0, 4)}-12`;
  }
  if (preset === 'custom') {
    from = cFrom <= cTo ? cFrom : cTo;
    to = cFrom <= cTo ? cTo : cFrom;
  }
  const start = periodOf(from, data.settings.monthStartDay).start;
  const end = periodOf(to, data.settings.monthStartDay).end;

  const series = monthlySeries(data, from, to);
  const cats = expensesByCategory(data, start, end);
  const catTop = cats.slice(0, 7).map((c) => ({ name: `${c.icon} ${c.name}`, total: c.total }));
  const restCat = cats.slice(7).reduce((a, c) => a + c.total, 0);
  if (restCat) catTop.push({ name: 'Outras', total: restCat });
  const balances = balanceHistory(data, from, to);
  const accounts = data.accounts.slice(0, 7);
  const balSeries: SeriesDef[] = [{ key: 'total', name: 'Total', color: 'var(--s4)' }];
  const fv = fixedVsVariable(data, from, to);
  const byCard = spendingByCard(data, start, end);
  const future = futureInstallments(data, today);
  const budgetRows = monthRange(from, to).map((m) => {
    const u = budgetUsage(data, m);
    return { month: m, planned: u.overall ?? 0, used: u.totalUsed };
  });
  const goals = data.goals.slice(0, 8);
  const gh = goalHistory(data, from, to);
  const goalSeries: SeriesDef[] = goals.map((g, i) => ({ key: g.id, name: g.name, color: SERIES[i] }));

  const exportCSV = () => {
    const txs = data.transactions.filter((t) => t.competenceDate >= start && t.competenceDate <= end).sort((a, b) => a.competenceDate.localeCompare(b.competenceDate));
    const lbl = { paid: 'Pago', pending: 'Pendente', overdue: 'Vencido' };
    downloadFile(`glossy-money-${from}_a_${to}.csv`, transactionsToCSV(data, txs, (t) => (t.type === 'transfer' ? 'Transferência' : lbl[effectiveStatus(data, t, today)])), 'text/csv;charset=utf-8');
  };
  const backup = () => downloadFile(`glossy-money-backup-${today}.json`, JSON.stringify(makeBackup(data), null, 2), 'application/json');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="sub">{formatMonth(from)} — {formatMonth(to)}</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={exportCSV}><Icon name="download" /> CSV do período</button>
          <button className="btn" onClick={backup}><Icon name="download" /> Backup JSON</button>
        </div>
      </div>

      <section className="card row wrap" aria-label="Intervalo">
        <div className="segmented" role="group" aria-label="Intervalo" style={{ flexWrap: 'wrap', borderRadius: 18 }}>
          {([['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['year', 'Ano'], ['custom', 'Personalizado']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={preset === k} onClick={() => setPreset(k)}>{l}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="row wrap">
            <label className="field"><span>De</span><input type="month" className="input" value={cFrom} onChange={(e) => e.target.value && setCFrom(e.target.value)} /></label>
            <label className="field"><span>Até</span><input type="month" className="input" value={cTo} onChange={(e) => e.target.value && setCTo(e.target.value)} /></label>
          </div>
        )}
        <span className="small muted">Base: mês selecionado no dashboard ({formatMonth(month)})</span>
      </section>

      <div className="grid two">
        <ChartCard
          title="Receitas e despesas mensais"
          legend={[{ key: 'income', name: 'Receitas', color: 'var(--series-income)' }, { key: 'expense', name: 'Despesas', color: 'var(--series-expense)' }]}
          table={{ head: ['Mês', 'Receitas', 'Despesas', 'Resultado'], rows: series.map((p) => [fmtM(p.month), p.income, p.expense, p.net]) }}
          empty={series.every((p) => !p.income && !p.expense)}
        >
          <BarsChart data={series} xKey="month" xFmt={fmtM} series={[{ key: 'income', name: 'Receitas', color: 'var(--series-income)' }, { key: 'expense', name: 'Despesas', color: 'var(--series-expense)' }]} />
        </ChartCard>

        <ChartCard title="Gastos por categoria" table={{ head: ['Categoria', 'Total'], rows: cats.map((c) => [`${c.icon} ${c.name}`, c.total]) }} empty={!cats.length}>
          <HBarsChart data={catTop} />
        </ChartCard>

        <ChartCard
          title="Evolução dos saldos"
          subtitle="Saldo total ao fim de cada mês"
          table={{ head: ['Mês', 'Total', ...accounts.map((a) => a.name)], rows: balances.map((b) => [fmtM(b.month), b.total ?? '—', ...accounts.map((a) => b.accounts[a.id] ?? 0)]) }}
          empty={!data.accounts.length}
        >
          <LinesChart data={balances} xKey="month" xFmt={fmtM} series={balSeries} />
        </ChartCard>

        <ChartCard
          title="Despesas fixas e variáveis"
          subtitle="Classificação definida nas categorias (Configurações)"
          legend={[{ key: 'fixed', name: 'Fixas', color: 'var(--s4)' }, { key: 'variable', name: 'Variáveis', color: 'var(--s3)' }]}
          table={{ head: ['Mês', 'Fixas', 'Variáveis'], rows: fv.map((r) => [fmtM(r.month), r.fixed, r.variable]) }}
          empty={fv.every((r) => !r.fixed && !r.variable)}
        >
          <BarsChart data={fv} xKey="month" xFmt={fmtM} stacked series={[{ key: 'fixed', name: 'Fixas', color: 'var(--s4)' }, { key: 'variable', name: 'Variáveis', color: 'var(--s3)' }]} />
        </ChartCard>

        <ChartCard title="Gastos por cartão" subtitle="Compras e parcelas por competência no período" table={{ head: ['Cartão', 'Total'], rows: byCard.map((c) => [c.name, c.total]) }} empty={!byCard.length}>
          <HBarsChart data={byCard.map((c) => ({ name: `💳 ${c.name}`, total: c.total }))} color="var(--s4)" />
        </ChartCard>

        <ChartCard title="Parcelas futuras" subtitle="Por mês de fatura, a partir da fatura atual" table={{ head: ['Fatura', 'Total'], rows: future.map((f) => [fmtM(f.month), f.total]) }} empty={!future.length}>
          <BarsChart data={future} xKey="month" xFmt={fmtM} series={[{ key: 'total', name: 'Parcelas', color: 'var(--s2)' }]} />
        </ChartCard>

        <ChartCard
          title="Orçamento planejado × realizado"
          legend={[{ key: 'planned', name: 'Planejado', color: 'var(--s7)' }, { key: 'used', name: 'Realizado', color: 'var(--s1)' }]}
          table={{ head: ['Mês', 'Planejado', 'Realizado'], rows: budgetRows.map((r) => [fmtM(r.month), r.planned, r.used]) }}
          empty={budgetRows.every((r) => !r.planned && !r.used)}
        >
          <BarsChart data={budgetRows} xKey="month" xFmt={fmtM} series={[{ key: 'planned', name: 'Planejado', color: 'var(--s7)' }, { key: 'used', name: 'Realizado', color: 'var(--s1)' }]} />
        </ChartCard>

        <ChartCard
          title="Evolução das metas"
          subtitle={data.goals.length > 8 ? 'Mostrando as 8 primeiras metas' : 'Valor acumulado ao fim de cada mês'}
          legend={goalSeries}
          table={{ head: ['Mês', ...goals.map((g) => g.name)], rows: gh.map((r) => [fmtM(String(r.month)), ...goals.map((g) => Number(r[g.id]) || 0)]) }}
          empty={!goals.length}
        >
          <LinesChart data={gh} xKey="month" xFmt={fmtM} series={goalSeries} />
        </ChartCard>
      </div>
    </>
  );
}
