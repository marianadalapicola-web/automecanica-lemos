import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PaymentMethod, Transaction, TxType } from '../data/types';
import { useApp } from '../store/AppContext';
import { Modal, MoneyInput, useConfirm } from './ui';
import * as ops from '../data/ops';
import { invoiceDates, invoiceMonthFor } from '../lib/finance';
import { addMonths, formatDate, formatMonth } from '../lib/dates';
import { PAYMENT_METHOD_LABEL } from '../data/defaults';
import { formatBRL, splitInstallments } from '../lib/money';

export interface TxPreset {
  type?: TxType;
  cardId?: string;
  accountId?: string;
}

export function TransactionForm({
  initial,
  preset,
  onClose,
}: {
  initial?: Transaction;
  preset?: TxPreset;
  onClose: () => void;
}) {
  const { data, update, today } = useApp();
  const confirm = useConfirm();
  const accounts = data.accounts.filter((a) => !a.archived || a.id === initial?.accountId || a.id === initial?.toAccountId);
  const cards = data.cards.filter((c) => !c.archived || c.id === initial?.cardId);
  const isParcel = !!initial?.installmentId;

  const [type, setType] = useState<TxType>(initial?.type ?? preset?.type ?? 'expense');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '');
  const [competenceDate, setCompetence] = useState(initial?.competenceDate ?? today);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [paidDate, setPaidDate] = useState(initial?.paidDate ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'paid');
  // "source" = 'acc:<id>' | 'card:<id>'
  const [source, setSource] = useState<string>(() => {
    if (initial?.cardId) return `card:${initial.cardId}`;
    if (initial?.accountId) return `acc:${initial.accountId}`;
    if (preset?.cardId) return `card:${preset.cardId}`;
    const a = preset?.accountId ?? accounts[0]?.id;
    return a ? `acc:${a}` : '';
  });
  const [toAccountId, setTo] = useState(initial?.toAccountId ?? accounts.find((a) => `acc:${a.id}` !== source)?.id ?? '');
  const [paymentMethod, setPM] = useState<PaymentMethod>(initial?.paymentMethod ?? 'pix');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [invoiceOverride, setInvoiceOverride] = useState<string>(initial?.invoiceMonth ?? '');
  const [parcels, setParcels] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const cardId = source.startsWith('card:') ? source.slice(5) : null;
  const accountId = source.startsWith('acc:') ? source.slice(4) : null;
  const card = cards.find((c) => c.id === cardId);
  const autoInvoice = card ? invoiceMonthFor(card, competenceDate) : null;
  const invoiceMonth = invoiceOverride || autoInvoice;
  const cats = data.categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense'));

  const invoiceOptions = useMemo(() => {
    if (!autoInvoice) return [];
    return [-2, -1, 0, 1, 2, 3].map((n) => addMonths(autoInvoice, n));
  }, [autoInvoice]);

  if (!data.accounts.length) {
    return (
      <Modal title="Novo lançamento" onClose={onClose}>
        <div className="empty">
          <div className="art">🏦</div>
          <h3>Cadastre uma conta primeiro</h3>
          <p>Os lançamentos precisam de uma conta (corrente, digital, dinheiro…) para calcular seus saldos.</p>
          <Link className="btn primary" to="/contas?nova=conta" onClick={onClose}>Criar minha primeira conta</Link>
        </div>
      </Modal>
    );
  }

  const submit = () => {
    setError(null);
    if (isParcel && initial) {
      const ok = update((d) => ops.setInvoiceMonth(d, initial.id, invoiceOverride || initial.invoiceMonth!), 'Fatura da parcela atualizada ✧');
      if (ok) onClose();
      return;
    }
    if (amount == null || amount <= 0) return setError('Informe um valor maior que zero.');
    if (type === 'expense' && cardId && parcels > 1 && !initial) {
      const ok = update(
        (d) =>
          ops.saveInstallment(d, {
            description,
            total: amount,
            count: parcels,
            purchaseDate: competenceDate,
            firstInvoiceMonth: invoiceOverride || '',
            cardId,
            categoryId: categoryId || null,
            notes,
          }),
        `Compra parcelada em ${parcels}x registrada ✧`,
      );
      if (ok) onClose();
      return;
    }
    try {
      const input: ops.TxInput = {
        id: initial?.id,
        description,
        amount,
        type,
        categoryId: type === 'transfer' ? null : categoryId || null,
        competenceDate,
        dueDate: dueDate || null,
        paidDate: paidDate || null,
        accountId: type === 'expense' && cardId ? null : accountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        cardId: type === 'expense' ? cardId : null,
        invoiceMonth: type === 'expense' && cardId ? invoiceMonth : null,
        paymentMethod: type === 'expense' && cardId ? 'credit' : paymentMethod,
        status: status as 'paid' | 'pending',
        notes,
      };
      ops.normalizeTx(data, input); // valida antes de fechar
      const ok = update((d) => ops.saveTransaction(d, input), initial ? 'Lançamento atualizado ✧' : 'Lançamento salvo ✧');
      if (ok) onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const yes = await confirm({
      title: 'Excluir lançamento?',
      message: `“${initial.description}” (${formatBRL(initial.amount)}) será excluído permanentemente.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (yes && update((d) => ops.deleteTransaction(d, initial.id), 'Lançamento excluído')) onClose();
  };

  if (isParcel && initial) {
    const c = data.cards.find((x) => x.id === initial.cardId);
    const opts = initial.invoiceMonth ? [-2, -1, 0, 1, 2].map((n) => addMonths(initial.invoiceMonth!, n)) : [];
    return (
      <Modal
        title="Parcela de compra"
        onClose={onClose}
        footer={
          <>
            <Link className="btn" to="/parcelamentos" onClick={onClose}>Ver parcelamento</Link>
            <button className="btn primary" onClick={submit}>Salvar fatura</button>
          </>
        }
      >
        <div className="stack">
          <div className="form-note">
            <strong>{initial.description}</strong> · {formatBRL(initial.amount)} no cartão {c?.nickname || c?.name}.
            Para alterar valor, descrição ou número de parcelas, edite o parcelamento inteiro em Parcelamentos.
          </div>
          <label className="field">
            <span>Fatura em que esta parcela é cobrada (correção manual)</span>
            <select className="input" value={invoiceOverride || initial.invoiceMonth || ''} onChange={(e) => setInvoiceOverride(e.target.value)}>
              {opts.map((m) => (
                <option key={m} value={m}>Fatura de {formatMonth(m)}</option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    );
  }

  const parcelValues = amount && parcels > 1 ? splitInstallments(amount, parcels) : null;

  return (
    <Modal
      title={initial ? 'Editar lançamento' : 'Novo lançamento ✧'}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <button className="btn danger" onClick={remove} style={{ marginRight: 'auto' }}>Excluir</button>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit}>{initial ? 'Salvar alterações' : 'Salvar'}</button>
        </>
      }
    >
      <form
        className="form-grid cols"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="segmented span2" role="group" aria-label="Tipo de lançamento">
          {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
            <button
              type="button"
              key={t}
              className={t}
              aria-pressed={type === t}
              onClick={() => {
                setType(t);
                setCategoryId('');
                if (t !== 'expense' && source.startsWith('card:')) setSource(`acc:${accounts[0]?.id ?? ''}`);
              }}
            >
              {t === 'expense' ? 'Despesa' : t === 'income' ? 'Receita' : 'Transferência'}
            </button>
          ))}
        </div>

        <label className="field span2">
          <span>Descrição</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === 'income' ? 'Ex.: Salário de outubro' : type === 'transfer' ? 'Ex.: Guardar na poupança' : 'Ex.: Mercado'} required maxLength={120} />
        </label>

        <MoneyInput label={parcels > 1 ? 'Valor total da compra' : 'Valor (R$)'} value={amount} onChange={setAmount} required />

        <label className="field">
          <span>{type === 'expense' && cardId ? 'Data da compra' : 'Data de competência'}</span>
          <input type="date" className="input" value={competenceDate} onChange={(e) => setCompetence(e.target.value)} required />
        </label>

        {type !== 'transfer' && (
          <label className="field">
            <span>Categoria</span>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>{type === 'income' ? 'Recebido em' : type === 'transfer' ? 'De (origem)' : 'Pago com'}</span>
          <select className="input" value={source} onChange={(e) => { setSource(e.target.value); setInvoiceOverride(''); }}>
            <optgroup label="Contas">
              {accounts.map((a) => (
                <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>
              ))}
            </optgroup>
            {type === 'expense' && cards.length > 0 && (
              <optgroup label="Cartões de crédito">
                {cards.map((c) => (
                  <option key={c.id} value={`card:${c.id}`}>💳 {c.nickname || c.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {type === 'transfer' && (
          <label className="field">
            <span>Para (destino)</span>
            <select className="input" value={toAccountId} onChange={(e) => setTo(e.target.value)}>
              <option value="">Escolha…</option>
              {accounts.filter((a) => `acc:${a.id}` !== source).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        )}

        {type === 'expense' && card && autoInvoice && (
          <>
            {!initial && (
              <label className="field">
                <span>Parcelas</span>
                <select className="input" value={parcels} onChange={(e) => setParcels(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n === 1 ? 'À vista (1x)' : `${n}x`}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>{parcels > 1 ? 'Fatura da 1ª parcela' : 'Fatura'}</span>
              <select className="input" value={invoiceMonth ?? ''} onChange={(e) => setInvoiceOverride(e.target.value === autoInvoice ? '' : e.target.value)}>
                {invoiceOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)} {m === autoInvoice ? '(automática)' : '(manual)'}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-note span2">
              Fecha dia {card.closingDay}, vence dia {card.dueDay}. Pela regra de fechamento esta compra cai na fatura de{' '}
              <strong>{formatMonth(autoInvoice)}</strong> (vence {formatDate(invoiceDates(card, autoInvoice).due)}).
              {parcelValues && (
                <> {parcels}x de <strong>{formatBRL(parcelValues[1])}</strong>{parcelValues[0] !== parcelValues[1] && <> (1ª parcela {formatBRL(parcelValues[0])})</>}.</>
              )}
            </div>
          </>
        )}

        {!(type === 'expense' && cardId) && (
          <>
            <div className="field">
              <span>Status</span>
              <div className="segmented" role="group" aria-label="Status">
                <button type="button" aria-pressed={status === 'paid'} onClick={() => setStatus('paid')}>
                  {type === 'income' ? 'Recebido' : type === 'transfer' ? 'Efetivada' : 'Pago'}
                </button>
                <button type="button" aria-pressed={status === 'pending'} onClick={() => setStatus('pending')}>
                  {type === 'income' ? 'A receber' : type === 'transfer' ? 'Agendada' : 'A pagar'}
                </button>
              </div>
            </div>
            {type !== 'transfer' && (
              <label className="field">
                <span>Vencimento (opcional)</span>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            )}
            {status === 'paid' && (
              <label className="field">
                <span>{type === 'income' ? 'Data do recebimento' : 'Data do pagamento'}</span>
                <input type="date" className="input" value={paidDate || competenceDate} onChange={(e) => setPaidDate(e.target.value)} />
              </label>
            )}
            <label className="field">
              <span>Forma de pagamento</span>
              <select className="input" value={paymentMethod} onChange={(e) => setPM(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHOD_LABEL)
                  .filter(([k]) => k !== 'credit')
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
              </select>
            </label>
          </>
        )}

        <label className="field span2">
          <span>Observações (opcional)</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </label>
        {error && <div className="form-error span2" role="alert">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
