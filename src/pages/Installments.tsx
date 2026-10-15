import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { useQuickAdd } from '../components/Layout';
import { Empty, Modal, MoneyInput, Progress, StatusChip, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import * as ops from '../data/ops';
import type { Installment } from '../data/types';
import { futureInstallments, installmentProgress, invoiceDates, invoiceMonthFor } from '../lib/finance';
import { addMonths, formatDate, formatMonth } from '../lib/dates';
import { formatBRL, pct, splitInstallments } from '../lib/money';

export default function Installments() {
  const { data, today, update } = useApp();
  const { openEdit } = useQuickAdd();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<Installment | 'new' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active');
  const future = futureInstallments(data, today);
  const futureTotal = future.reduce((a, f) => a + f.total, 0);

  const items = data.installments
    .map((i) => ({ inst: i, prog: installmentProgress(data, i, today) }))
    .filter(({ prog }) => (filter === 'all' ? true : filter === 'done' ? prog.pendingCount === 0 : prog.pendingCount > 0))
    .sort((a, b) => b.inst.purchaseDate.localeCompare(a.inst.purchaseDate));

  const remove = async (i: Installment) => {
    const yes = await confirm({
      title: 'Excluir parcelamento?',
      message: `Todas as ${i.count} parcelas de “${i.description}” serão removidas das faturas e relatórios.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (yes) update((d) => ops.deleteInstallment(d, i.id), 'Parcelamento excluído');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Parcelamentos</h1>
          <p className="sub">{formatBRL(futureTotal)} em parcelas a partir das faturas atuais</p>
        </div>
        <button className="btn primary" onClick={() => setEdit('new')} disabled={!data.cards.length}><Icon name="plus" /> Nova compra parcelada</button>
      </div>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>✧ Como as parcelas são contabilizadas</summary>
        <ul className="small muted" style={{ marginTop: 10, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li><strong>Competência:</strong> cada parcela é uma despesa no mês correspondente — a 1ª na data da compra, a 2ª um mês depois, e assim por diante. A compra nunca é contada duas vezes.</li>
          <li><strong>Fatura:</strong> a 1ª parcela entra na fatura definida pela data de fechamento do cartão; as seguintes, nas faturas dos meses subsequentes.</li>
          <li><strong>Limite:</strong> o valor total (todas as parcelas não pagas) ocupa o limite do cartão até as faturas serem pagas.</li>
          <li><strong>Pagamento da fatura</strong> liquida a dívida e não gera nova despesa.</li>
          <li><strong>Divergência de datas?</strong> Ajuste a “Fatura da 1ª parcela” no parcelamento, ou mova uma parcela específica clicando nela.</li>
          <li>Diferenças de centavos da divisão ficam na 1ª parcela.</li>
        </ul>
      </details>

      {!data.cards.length ? (
        <section className="card"><Empty art="💳" title="Cadastre um cartão primeiro" action={<Link className="btn primary" to="/contas?aba=cartoes&nova=cartao">Adicionar cartão</Link>} /></section>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Filtrar" style={{ maxWidth: 380 }}>
            <button aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Em andamento</button>
            <button aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>Quitados</button>
            <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button>
          </div>
          {items.length ? (
            <div className="stack">
              {items.map(({ inst, prog }) => {
                const card = data.cards.find((c) => c.id === inst.cardId);
                const isOpen = open === inst.id;
                return (
                  <article key={inst.id} className="card stack">
                    <div className="row wrap between">
                      <div className="grow">
                        <h3>{inst.description}</h3>
                        <div className="small muted">
                          💳 {card?.nickname || card?.name} · compra em {formatDate(inst.purchaseDate)} · {inst.count}x de {formatBRL(prog.parcels[1]?.amount ?? prog.parcels[0]?.amount ?? 0)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800 }} className="num">{formatBRL(inst.total)}</div>
                        <div className="small muted">Parcela {prog.currentNumber}/{inst.count}</div>
                      </div>
                    </div>
                    <Progress value={pct(prog.paidCount, inst.count)} tone={prog.pendingCount === 0 ? 'mint' : 'lilac'} label="Parcelas pagas" />
                    <div className="row wrap between small">
                      <span><span className="chip paid">{prog.paidCount} paga(s)</span> <span className="chip pending">{prog.pendingCount} pendente(s)</span></span>
                      <span className="muted">Falta {formatBRL(prog.remainingAmount)}</span>
                    </div>
                    <div className="row wrap">
                      <button className="btn sm" onClick={() => setOpen(isOpen ? null : inst.id)} aria-expanded={isOpen}>{isOpen ? 'Ocultar parcelas' : 'Ver parcelas'}</button>
                      <button className="btn sm ghost" onClick={() => setEdit(inst)}><Icon name="edit" size={16} /> Editar</button>
                      <button className="btn sm ghost danger" onClick={() => remove(inst)}><Icon name="trash" size={16} /> Excluir</button>
                    </div>
                    {isOpen && (
                      <div className="table-wrap">
                        <table className="table">
                          <thead><tr><th>#</th><th>Competência</th><th>Fatura</th><th>Vencimento</th><th>Status</th><th className="r">Valor</th></tr></thead>
                          <tbody>
                            {prog.parcels.map((p) => (
                              <tr key={p.id} onClick={() => openEdit(p)} style={{ cursor: 'pointer' }} title="Corrigir fatura desta parcela">
                                <td>{p.installmentNumber}/{inst.count}</td>
                                <td>{formatDate(p.competenceDate)}</td>
                                <td>{p.invoiceMonth ? formatMonth(p.invoiceMonth, true) : '—'}{p.invoiceMonth !== addMonths(inst.firstInvoiceMonth, (p.installmentNumber ?? 1) - 1) && <span className="chip info" style={{ marginLeft: 6 }}>manual</span>}</td>
                                <td>{card && p.invoiceMonth ? formatDate(invoiceDates(card, p.invoiceMonth).due) : '—'}</td>
                                <td><StatusChip status={p.effStatus} /></td>
                                <td className="r">{formatBRL(p.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="card">
              <Empty art="🧁" title={filter === 'done' ? 'Nenhum parcelamento quitado' : 'Nenhum parcelamento'} text="Compras parceladas no cartão aparecem aqui com o andamento de cada parcela." action={<button className="btn primary" onClick={() => setEdit('new')}>Registrar compra parcelada</button>} />
            </section>
          )}
        </>
      )}
      {edit && <InstallmentForm inst={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function InstallmentForm({ inst, onClose }: { inst?: Installment; onClose: () => void }) {
  const { data, update, today } = useApp();
  const [description, setDesc] = useState(inst?.description ?? '');
  const [total, setTotal] = useState<number | null>(inst?.total ?? null);
  const [count, setCount] = useState(inst?.count ?? 3);
  const [purchaseDate, setDate] = useState(inst?.purchaseDate ?? today);
  const [cardId, setCard] = useState(inst?.cardId ?? data.cards.find((c) => !c.archived)?.id ?? '');
  const [categoryId, setCat] = useState(inst?.categoryId ?? '');
  const [notes, setNotes] = useState(inst?.notes ?? '');
  const card = data.cards.find((c) => c.id === cardId);
  const auto = card ? invoiceMonthFor(card, purchaseDate) : '';
  const [first, setFirst] = useState(inst && card && inst.firstInvoiceMonth !== invoiceMonthFor(card, inst.purchaseDate) ? inst.firstInvoiceMonth : '');
  const firstMonth = first || auto;
  const parts = total && count ? splitInstallments(total, count) : null;

  const save = () => {
    const ok = update(
      (d) => ops.saveInstallment(d, { id: inst?.id, description, total: total ?? NaN, count, purchaseDate, firstInvoiceMonth: first, cardId, categoryId: categoryId || null, notes }),
      inst ? 'Parcelamento atualizado ✧' : 'Compra parcelada registrada ✧',
    );
    if (ok) onClose();
  };

  return (
    <Modal title={inst ? 'Editar parcelamento' : 'Nova compra parcelada'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <form className="form-grid cols" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field span2"><span>Descrição da compra</span><input className="input" value={description} onChange={(e) => setDesc(e.target.value)} maxLength={100} placeholder="Ex.: Notebook" /></label>
        <MoneyInput label="Valor total" value={total} onChange={setTotal} />
        <label className="field"><span>Quantidade de parcelas</span>
          <input type="number" min={1} max={72} className="input" value={count} onChange={(e) => setCount(Math.max(1, Math.min(72, Number(e.target.value) || 1)))} />
        </label>
        <label className="field"><span>Data da compra</span><input type="date" className="input" value={purchaseDate} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Cartão</span>
          <select className="input" value={cardId} onChange={(e) => { setCard(e.target.value); setFirst(''); }}>
            {data.cards.filter((c) => !c.archived || c.id === cardId).map((c) => <option key={c.id} value={c.id}>{c.nickname || c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Categoria</span>
          <select className="input" value={categoryId} onChange={(e) => setCat(e.target.value)}>
            <option value="">Sem categoria</option>
            {data.categories.filter((c) => c.kind === 'expense').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Fatura da 1ª parcela</span>
          <select className="input" value={firstMonth} onChange={(e) => setFirst(e.target.value === auto ? '' : e.target.value)}>
            {auto && [-1, 0, 1, 2].map((n) => addMonths(auto, n)).map((m) => <option key={m} value={m}>{formatMonth(m)} {m === auto ? '(automática)' : '(manual)'}</option>)}
          </select>
        </label>
        {parts && card && (
          <div className="form-note span2">
            {count}x de <strong>{formatBRL(parts[count > 1 ? 1 : 0])}</strong>{parts[0] !== parts[count - 1] && <> (1ª: {formatBRL(parts[0])})</>}.
            1º vencimento: <strong>{formatDate(invoiceDates(card, firstMonth).due)}</strong>; última parcela na fatura de {formatMonth(addMonths(firstMonth, count - 1))}.
            {inst && ' Ao salvar, as parcelas são regeneradas (correções manuais de parcelas individuais são desfeitas).'}
          </div>
        )}
        <label className="field span2"><span>Observações</span><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></label>
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}
