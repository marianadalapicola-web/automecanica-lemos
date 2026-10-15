import { useEffect, useState } from 'react';
import { useApp } from '../store/AppContext';
import { MoneyInput, MonthPicker, Progress, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import * as ops from '../data/ops';
import { budgetUsage, expensesByCategory } from '../lib/finance';
import { addMonths, formatMonth, periodOf } from '../lib/dates';
import { formatBRL } from '../lib/money';

function tone(p: number) {
  return p > 100 ? 'over' : p >= 80 ? 'warn' : 'mint';
}

export default function Budget() {
  const { data, month, setMonth, update } = useApp();
  const confirm = useConfirm();
  const usage = budgetUsage(data, month);
  const { start, end } = periodOf(month, data.settings.monthStartDay);
  const spent = expensesByCategory(data, start, end);
  const expenseCats = data.categories.filter((c) => c.kind === 'expense');

  const [editing, setEditing] = useState(false);
  const [overall, setOverall] = useState<number | null>(null);
  const [savings, setSavings] = useState<number | null>(null);
  const [limits, setLimits] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const b = data.budgets[month];
    setOverall(b?.overall ?? null);
    setSavings(b?.savingsGoal ?? null);
    setLimits(Object.fromEntries(expenseCats.map((c) => [c.id, b?.categories[c.id] ?? null])));
    setEditing(false);
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    const b = data.budgets[month];
    setOverall(b?.overall ?? null);
    setSavings(b?.savingsGoal ?? null);
    setLimits(Object.fromEntries(expenseCats.map((c) => [c.id, b?.categories[c.id] ?? null])));
    setEditing(true);
  };

  const save = () => {
    const categories: Record<string, number> = {};
    for (const [k, v] of Object.entries(limits)) if (v) categories[k] = v;
    if (update((d) => ops.setBudget(d, month, { overall, savingsGoal: savings, categories }), 'Orçamento salvo ✧')) setEditing(false);
  };

  const copyPrev = async () => {
    if (data.budgets[month] && !(await confirm({ title: 'Substituir orçamento?', message: `O orçamento de ${formatMonth(month)} será substituído pelo de ${formatMonth(addMonths(month, -1))}.`, confirmLabel: 'Copiar' })))
      return;
    update((d) => ops.copyBudgetFromPrevious(d, month), 'Orçamento copiado do mês anterior ✧');
  };

  const used = (id: string) => spent.find((s) => s.categoryId === id)?.total ?? 0;
  const hasBudget = !!data.budgets[month];
  const overallPct = usage.overall ? (usage.totalUsed / usage.overall) * 100 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orçamento</h1>
          <p className="sub">Planejado × realizado por competência (compras no cartão contam uma vez, na data da compra/parcela)</p>
        </div>
        <div className="row wrap">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      <div className="grid two">
        <section className="card glossy stack">
          <div className="row between">
            <h2>Limite geral</h2>
            {usage.overall != null && <span className={`chip ${overallPct > 100 ? 'overdue' : overallPct >= 80 ? 'pending' : 'paid'}`}>{Math.round(overallPct)}%</span>}
          </div>
          {usage.overall != null ? (
            <>
              <Progress value={overallPct} tone={tone(overallPct)} label="Uso do limite geral" />
              <div className="row between small">
                <span>Utilizado <strong className="num">{formatBRL(usage.totalUsed)}</strong></span>
                <span>Planejado <strong className="num">{formatBRL(usage.overall)}</strong></span>
              </div>
              <div className={`num ${usage.overallRemaining! < 0 ? 'neg' : 'pos'}`} style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                {usage.overallRemaining! >= 0 ? `Restam ${formatBRL(usage.overallRemaining!)}` : `Excedido em ${formatBRL(-usage.overallRemaining!)}`}
              </div>
              {usage.overallIsDerived && <p className="tiny muted">Limite geral = soma dos limites por categoria.</p>}
            </>
          ) : (
            <p className="muted small">Sem limite geral definido. Despesas do mês: {formatBRL(usage.totalUsed)}.</p>
          )}
        </section>
        <section className="card glossy stack">
          <h2>Meta de economia do mês</h2>
          {usage.savingsGoal ? (
            <>
              <Progress value={(Math.max(0, usage.saved) / usage.savingsGoal) * 100} tone="mint" label="Progresso da meta de economia" />
              <div className="row between small">
                <span>Economizado <strong className="num">{formatBRL(usage.saved)}</strong></span>
                <span>Meta <strong className="num">{formatBRL(usage.savingsGoal)}</strong></span>
              </div>
              <p className="tiny muted">Economia = receitas − despesas do período.</p>
            </>
          ) : (
            <p className="muted small">Defina quanto deseja poupar neste mês.</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Por categoria</h2>
          <div className="row wrap">
            <button className="btn sm" onClick={copyPrev} disabled={!data.budgets[addMonths(month, -1)]}><Icon name="upload" size={16} /> Copiar mês anterior</button>
            {!editing && <button className="btn sm primary" onClick={startEdit}><Icon name="edit" size={16} /> {hasBudget ? 'Ajustar limites' : 'Definir orçamento'}</button>}
          </div>
        </div>

        {editing ? (
          <div className="stack">
            <div className="form-grid cols">
              <MoneyInput label="Limite geral de despesas (opcional)" value={overall} onChange={setOverall} />
              <MoneyInput label="Meta de economia (opcional)" value={savings} onChange={setSavings} />
            </div>
            <div className="form-grid cols">
              {expenseCats.map((c) => (
                <div key={c.id} className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="grow">
                    <MoneyInput label={`${c.icon} ${c.name}`} value={limits[c.id] ?? null} onChange={(v) => setLimits((l) => ({ ...l, [c.id]: v }))} />
                  </div>
                  <span className="tiny muted" style={{ paddingBottom: 12, minWidth: 80, textAlign: 'right' }}>gasto {formatBRL(used(c.id))}</span>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn primary" onClick={save}>Salvar orçamento</button>
            </div>
          </div>
        ) : usage.lines.length ? (
          <div className="stack" style={{ gap: 16 }}>
            {usage.lines.map((l) => (
              <div key={l.categoryId} className="stack" style={{ gap: 6 }}>
                <div className="row between">
                  <strong>{l.icon} {l.name}</strong>
                  <span className="small">
                    {l.percent > 100 ? <span className="chip overdue">! acima do limite</span> : l.percent >= 80 ? <span className="chip pending">quase no limite</span> : null}
                  </span>
                </div>
                <Progress value={l.percent} tone={tone(l.percent)} label={`Uso do orçamento de ${l.name}`} />
                <div className="row between small muted">
                  <span>Utilizado {formatBRL(l.used)} de {formatBRL(l.planned)}</span>
                  <span className={l.remaining < 0 ? 'neg' : ''}>{l.remaining >= 0 ? `Restam ${formatBRL(l.remaining)}` : `Excedeu ${formatBRL(-l.remaining)}`}</span>
                </div>
              </div>
            ))}
            {spent.filter((s) => s.categoryId && !usage.lines.some((l) => l.categoryId === s.categoryId)).length > 0 && (
              <p className="small muted">
                Sem limite definido: {spent.filter((s) => !usage.lines.some((l) => l.categoryId === s.categoryId)).map((s) => `${s.name} (${formatBRL(s.total)})`).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div className="empty">
            <div className="art">🎀</div>
            <h3>Sem limites por categoria em {formatMonth(month)}</h3>
            <p>Defina quanto quer gastar com lazer, compras e outras categorias.</p>
          </div>
        )}
      </section>
    </>
  );
}
