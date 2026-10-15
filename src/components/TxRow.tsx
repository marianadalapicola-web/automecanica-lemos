import type { Transaction } from '../data/types';
import { useApp } from '../store/AppContext';
import { effectiveStatus } from '../lib/finance';
import { formatDate } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { StatusChip } from './ui';

export function TxRow({ t, onClick }: { t: Transaction; onClick: () => void }) {
  const { data, today } = useApp();
  const cat = data.categories.find((c) => c.id === t.categoryId);
  const acc = data.accounts.find((a) => a.id === t.accountId);
  const to = data.accounts.find((a) => a.id === t.toAccountId);
  const card = data.cards.find((c) => c.id === t.cardId);
  const st = effectiveStatus(data, t, today);
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const where = t.type === 'transfer' ? `${acc?.name ?? '?'} → ${to?.name ?? '?'}` : card ? `💳 ${card.nickname || card.name}` : acc?.name;
  return (
    <button className="tx-row" onClick={onClick}>
      <span className="tx-icon" aria-hidden>{t.type === 'transfer' ? '⇄' : cat?.icon ?? '✧'}</span>
      <span className="tx-main">
        <span className="tx-title" style={{ display: 'block' }}>{t.description}</span>
        <span className="tx-meta">
          <span>{formatDate(t.competenceDate)}</span>
          {where && <span>· {where}</span>}
          {cat && <span>· {cat.name}</span>}
          {t.dueDate && st !== 'paid' && <span>· vence {formatDate(t.dueDate)}</span>}
        </span>
      </span>
      <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
        <span className={`tx-amount ${t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : ''}`}>
          <span className="sr-only">{t.type === 'income' ? 'Receita' : t.type === 'expense' ? 'Despesa' : 'Transferência'} </span>
          {sign} {formatBRL(t.amount)}
        </span>
        {t.type === 'transfer' ? <span className="chip info">Transferência</span> : <StatusChip status={st} />}
      </span>
    </button>
  );
}
