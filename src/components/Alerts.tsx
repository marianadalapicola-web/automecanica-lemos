import { useEffect } from 'react';
import type { AppData, ISODate, MonthKey } from '../data/types';
import { budgetUsage, upcoming } from '../lib/finance';
import { addDays, formatDate } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { useApp } from '../store/AppContext';

export interface AlertItem {
  tone: 'warn' | 'info';
  text: string;
}

/** Alertas conforme as preferências de notificação do usuário. */
export function computeAlerts(data: AppData, today: ISODate, month: MonthKey): AlertItem[] {
  const n = data.settings.notifications;
  const out: AlertItem[] = [];
  const list = upcoming(data, today, n.daysBefore);
  if (n.overdue) {
    const overdue = list.filter((u) => u.overdue && u.kind !== 'income');
    if (overdue.length)
      out.push({ tone: 'warn', text: `${overdue.length} conta(s)/fatura(s) vencida(s): ${overdue.slice(0, 3).map((u) => u.label).join(', ')}${overdue.length > 3 ? '…' : ''}` });
  }
  if (n.dueSoon) {
    const limit = addDays(today, n.daysBefore);
    const soon = list.filter((u) => !u.overdue && u.kind !== 'income' && u.date <= limit);
    for (const u of soon.slice(0, 3)) out.push({ tone: 'info', text: `${u.label} vence ${u.date === today ? 'hoje' : `em ${formatDate(u.date)}`} (${formatBRL(u.amount)})` });
  }
  if (n.budgetAlerts) {
    const b = budgetUsage(data, month);
    for (const l of b.lines) {
      if (l.percent >= 100) out.push({ tone: 'warn', text: `Orçamento de ${l.name} ultrapassado (${Math.round(l.percent)}%).` });
      else if (l.percent >= 80) out.push({ tone: 'info', text: `Orçamento de ${l.name} em ${Math.round(l.percent)}%.` });
    }
  }
  return out;
}

export function AlertsBanner() {
  const { data, today, month } = useApp();
  const alerts = computeAlerts(data, today, month);
  if (!alerts.length) return null;
  return (
    <section className="card" aria-label="Alertas" style={{ padding: 14 }}>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
        {alerts.map((a, i) => (
          <li key={i} className="row small" style={{ fontWeight: 700 }}>
            <span className={`chip ${a.tone === 'warn' ? 'overdue' : 'info'}`} aria-hidden>{a.tone === 'warn' ? '!' : '◷'}</span>
            <span>{a.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mostra uma notificação do navegador no máximo uma vez por dia, se permitido. */
export function useBrowserNotifications() {
  const { data, today, month, ready } = useApp();
  useEffect(() => {
    if (!ready || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const key = 'glossy-money:notified';
    try {
      if (localStorage.getItem(key) === today) return;
      const alerts = computeAlerts(data, today, month).filter((a) => a.tone === 'warn' || /vence/.test(a.text));
      if (!alerts.length) return;
      new Notification('Glossy Money ✧', { body: alerts.slice(0, 3).map((a) => a.text).join('\n') });
      localStorage.setItem(key, today);
    } catch {
      /* ignorar */
    }
  }, [ready, today]); // eslint-disable-line react-hooks/exhaustive-deps
}
