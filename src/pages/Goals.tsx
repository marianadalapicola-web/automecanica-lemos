import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { Empty, Modal, MoneyInput, Progress, useConfirm } from '../components/ui';
import { Icon, Sparkle } from '../components/Icon';
import * as ops from '../data/ops';
import type { Goal } from '../data/types';
import { freeBalance, goalSaved, totalReserved, validateContribution } from '../lib/finance';
import { formatDate, monthDiff } from '../lib/dates';
import { formatBRL, pct } from '../lib/money';
import { GOAL_ICONS, SWATCHES } from '../data/defaults';

const PRIORITY = { high: 'Alta', medium: 'Média', low: 'Baixa' } as const;

export default function Goals() {
  const { data, today, update } = useApp();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  const [contrib, setContrib] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Goal | null>(null);
  const reserved = totalReserved(data);
  const order = { high: 0, medium: 1, low: 2 };
  const goals = [...data.goals].sort((a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name));

  const remove = async (g: Goal) => {
    const yes = await confirm({
      title: 'Excluir meta?',
      message: `A meta “${g.name}” e seu histórico serão excluídos. O valor reservado (${formatBRL(goalSaved(g))}) volta a ficar livre nas contas.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (yes) update((d) => ops.deleteGoal(d, g.id), 'Meta excluída');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Metas financeiras <Sparkle size={18} /></h1>
          <p className="sub">{formatBRL(reserved)} reservados para seus sonhos</p>
        </div>
        <button className="btn primary" onClick={() => setEdit('new')}><Icon name="plus" /> Nova meta</button>
      </div>

      {goals.length ? (
        <div className="grid three">
          {goals.map((g) => {
            const saved = goalSaved(g);
            const p = pct(saved, g.target);
            const left = Math.max(0, g.target - saved);
            const months = g.targetDate ? Math.max(1, monthDiff(today.slice(0, 7), g.targetDate.slice(0, 7))) : null;
            return (
              <article key={g.id} className="card glossy goal-card stack">
                <div className="row">
                  <span className="goal-icon" style={{ background: `linear-gradient(135deg, #fff, ${g.color})` }} aria-hidden>{g.icon}</span>
                  <div className="grow">
                    <h3>{g.name}</h3>
                    <span className="small muted">Prioridade {PRIORITY[g.priority].toLowerCase()}{g.targetDate ? ` · até ${formatDate(g.targetDate)}` : ''}</span>
                  </div>
                  {p >= 100 && <span className="chip paid">Concluída ♡</span>}
                </div>
                {g.description && <p className="small muted">{g.description}</p>}
                <div>
                  <div className="row between">
                    <strong className="num" style={{ fontSize: '1.25rem' }}>{formatBRL(saved)}</strong>
                    <span className="small muted num">de {formatBRL(g.target)}</span>
                  </div>
                  <Progress value={p} tone={p >= 100 ? 'mint' : ''} label={`Progresso de ${g.name}`} />
                  <div className="row between tiny muted" style={{ marginTop: 4 }}>
                    <span>{Math.round(p)}%</span>
                    {left > 0 && months && g.targetDate! >= today && <span>≈ {formatBRL(Math.ceil(left / months))}/mês para chegar lá</span>}
                    {left > 0 && g.targetDate && g.targetDate < today && <span className="neg">Prazo passou</span>}
                  </div>
                </div>
                <div className="row wrap">
                  <button className="btn sm primary" onClick={() => setContrib(g)}><Icon name="heart" size={16} /> Contribuir</button>
                  <button className="btn sm" onClick={() => setHistory(g)}>Histórico ({g.contributions.length})</button>
                  <button className="icon-btn" onClick={() => setEdit(g)} aria-label={`Editar ${g.name}`}><Icon name="edit" size={18} /></button>
                  <button className="icon-btn" onClick={() => remove(g)} aria-label={`Excluir ${g.name}`}><Icon name="trash" size={18} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty art="🦋" title="Sonhe grande, comece pequeno" text="Crie metas como uma viagem, um equipamento novo ou sua reserva de emergência." action={<button className="btn primary" onClick={() => setEdit('new')}>Criar primeira meta</button>} />
        </section>
      )}

      <p className="small muted">
        ✧ Contribuir para uma meta <strong>reserva</strong> parte do saldo de uma conta: o dinheiro continua na conta (o saldo total não muda) e
        não vira despesa. Só é possível reservar o que está livre na conta. Para separar fisicamente o dinheiro, faça também uma transferência
        para sua poupança.
      </p>

      {edit && <GoalForm goal={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {contrib && <ContributionForm goal={data.goals.find((g) => g.id === contrib.id)!} onClose={() => setContrib(null)} />}
      {history && <HistoryModal goalId={history.id} onClose={() => setHistory(null)} />}
    </>
  );
}

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { update } = useApp();
  const [name, setName] = useState(goal?.name ?? '');
  const [description, setDesc] = useState(goal?.description ?? '');
  const [target, setTarget] = useState<number | null>(goal?.target ?? null);
  const [targetDate, setDate] = useState(goal?.targetDate ?? '');
  const [priority, setPriority] = useState<Goal['priority']>(goal?.priority ?? 'medium');
  const [color, setColor] = useState(goal?.color ?? SWATCHES[0]);
  const [icon, setIcon] = useState(goal?.icon ?? GOAL_ICONS[0]);
  const save = () => {
    if (update((d) => ops.saveGoal(d, { id: goal?.id, name, description, target: target ?? NaN, targetDate: targetDate || null, priority, color, icon }), goal ? 'Meta atualizada ✧' : 'Meta criada ✧'))
      onClose();
  };
  return (
    <Modal title={goal ? 'Editar meta' : 'Nova meta ✧'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <form className="form-grid cols" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field span2"><span>Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Viagem para Paris" /></label>
        <label className="field span2"><span>Descrição</span><textarea className="input" value={description} onChange={(e) => setDesc(e.target.value)} maxLength={300} /></label>
        <MoneyInput label="Valor desejado" value={target} onChange={setTarget} />
        <label className="field"><span>Data prevista</span><input type="date" className="input" value={targetDate} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Prioridade</span>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Goal['priority'])}>
            <option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
          </select>
        </label>
        <div className="field"><span>Cor</span>
          <div className="row wrap" role="radiogroup" aria-label="Cor">
            {SWATCHES.map((c) => <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '2px solid #fff', cursor: 'pointer' }} />)}
          </div>
        </div>
        <div className="field span2"><span>Ícone</span>
          <div className="row wrap" role="radiogroup" aria-label="Ícone">
            {GOAL_ICONS.map((i) => <button type="button" key={i} role="radio" aria-checked={icon === i} onClick={() => setIcon(i)} className="icon-btn" style={{ fontSize: '1.3rem', border: icon === i ? '2px solid var(--pink-hot)' : '1px solid var(--border)' }}>{i}</button>)}
          </div>
        </div>
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}

function ContributionForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { data, update, today } = useApp();
  const accounts = data.accounts.filter((a) => !a.archived);
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState<number | null>(null);
  const [accountId, setAcc] = useState(accounts[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const acc = data.accounts.find((a) => a.id === accountId);
  const signed = amount ? (kind === 'in' ? amount : -amount) : 0;
  const err = amount ? validateContribution(data, goal, signed, accountId) : null;

  if (!accounts.length)
    return (
      <Modal title="Contribuir" onClose={onClose}>
        <Empty art="🏦" title="Cadastre uma conta primeiro" text="As contribuições reservam dinheiro de uma conta." action={<Link to="/contas?nova=conta" className="btn primary" onClick={onClose}>Criar conta</Link>} />
      </Modal>
    );

  const save = () => {
    if (update((d) => ops.addContribution(d, goal.id, { amount: signed, accountId, date, note: note.trim() }), kind === 'in' ? `${formatBRL(signed)} reservados para ${goal.name} ♡` : 'Resgate registrado'))
      onClose();
  };
  return (
    <Modal title={`${goal.icon} ${goal.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save} disabled={!amount || !!err}>Confirmar</button></>}>
      <div className="form-grid cols">
        <div className="segmented span2" role="group" aria-label="Tipo">
          <button aria-pressed={kind === 'in'} onClick={() => setKind('in')}>Reservar</button>
          <button aria-pressed={kind === 'out'} onClick={() => setKind('out')}>Resgatar</button>
        </div>
        <MoneyInput label="Valor" value={amount} onChange={setAmount} />
        <label className="field"><span>Conta</span>
          <select className="input" value={accountId} onChange={(e) => setAcc(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Data</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Observação</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></label>
        {acc && <p className="form-note span2">Saldo livre em {acc.name}: <strong>{formatBRL(freeBalance(data, acc))}</strong> · já reservado nesta meta: {formatBRL(goalSaved(goal))}</p>}
        {err && <div className="form-error span2" role="alert">{err}</div>}
      </div>
    </Modal>
  );
}

function HistoryModal({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { data, update } = useApp();
  const confirm = useConfirm();
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal) return null;
  const list = [...goal.contributions].sort((a, b) => b.date.localeCompare(a.date));
  const del = async (id: string) => {
    if (await confirm({ title: 'Excluir contribuição?', message: 'O valor deixa de estar reservado para a meta.', danger: true, confirmLabel: 'Excluir' }))
      update((d) => ops.deleteContribution(d, goal.id, id), 'Contribuição excluída');
  };
  return (
    <Modal title={`Histórico · ${goal.name}`} onClose={onClose}>
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Conta</th><th>Obs.</th><th className="r">Valor</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.date)}</td>
                  <td>{data.accounts.find((a) => a.id === c.accountId)?.name}</td>
                  <td className="small muted">{c.note}</td>
                  <td className={`r ${c.amount >= 0 ? 'pos' : 'neg'}`}>{formatBRL(c.amount)}</td>
                  <td><button className="icon-btn" onClick={() => del(c.id)} aria-label="Excluir contribuição"><Icon name="trash" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty art="💖" title="Nenhuma contribuição ainda" />}
    </Modal>
  );
}
