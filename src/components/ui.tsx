import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { addMonths, formatMonth } from '../lib/dates';
import { centsToInput, formatBRL, parseBRL } from '../lib/money';
import type { Cents, MonthKey } from '../data/types';

// ───────────── Toasts ─────────────

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; text: string }
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span aria-hidden>{t.kind === 'success' ? '✧' : t.kind === 'error' ? '!' : '♡'}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ───────────── Modal ─────────────

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.icon-btn)');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Só o modal mais acima reage ao teclado
      const all = document.querySelectorAll('.modal');
      if (all[all.length - 1] !== ref.current) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const els = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const list = [...els].filter((x) => !x.hasAttribute('disabled'));
        if (!list.length) return;
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list[list.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === list[list.length - 1]) {
          e.preventDefault();
          list[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ───────────── Confirmação ─────────────

interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Exige digitar esta palavra para confirmar (ações irreversíveis). */
  typeToConfirm?: string;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setState({ ...o, resolve });
      }),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const ok = !state?.typeToConfirm || typed.trim().toUpperCase() === state.typeToConfirm;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn" onClick={() => close(false)}>Cancelar</button>
              <button className={`btn ${state.danger ? 'danger solid' : 'primary'}`} disabled={!ok} onClick={() => close(true)}>
                {state.confirmLabel ?? 'Confirmar'}
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="muted">{state.message}</div>
            {state.typeToConfirm && (
              <label className="field">
                <span>Digite {state.typeToConfirm} para confirmar</span>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </label>
            )}
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ───────────── Inputs ─────────────

export function MoneyInput({
  value,
  onChange,
  label,
  allowNegative,
  required,
  id,
}: {
  value: Cents | null;
  onChange: (v: Cents | null) => void;
  label: string;
  allowNegative?: boolean;
  required?: boolean;
  id?: string;
}) {
  const [text, setText] = useState(value != null ? centsToInput(value) : '');
  const [invalid, setInvalid] = useState(false);
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value != null ? centsToInput(value) : '');
      last.current = value;
    }
  }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        id={id}
        className="input money"
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        required={required}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseBRL(e.target.value);
          const bad = e.target.value.trim() !== '' && (v == null || (!allowNegative && v < 0));
          setInvalid(bad);
          const out = bad ? null : v;
          last.current = out;
          onChange(out);
        }}
        onBlur={() => {
          const v = parseBRL(text);
          if (v != null && (allowNegative || v >= 0)) setText(centsToInput(v));
        }}
      />
    </label>
  );
}

export function MonthPicker({ value, onChange }: { value: MonthKey; onChange: (m: MonthKey) => void }) {
  return (
    <div className="month-picker" role="group" aria-label="Selecionar mês">
      <button className="icon-btn" onClick={() => onChange(addMonths(value, -1))} aria-label="Mês anterior">
        <Icon name="left" />
      </button>
      <label className="label">
        <span className="sr-only">Mês</span>
        <input
          type="month"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="sr-only"
          id="month-input"
        />
        <span aria-live="polite">{formatMonth(value)}</span>
      </label>
      <button className="icon-btn" onClick={() => onChange(addMonths(value, 1))} aria-label="Próximo mês">
        <Icon name="right" />
      </button>
    </div>
  );
}

// ───────────── Pequenos componentes ─────────────

export function Money({ cents, signed, className = '' }: { cents: Cents; signed?: boolean; className?: string }) {
  const cls = signed ? (cents > 0 ? 'pos' : cents < 0 ? 'neg' : '') : '';
  return <span className={`num ${cls} ${className}`}>{signed && cents > 0 ? '+' : ''}{formatBRL(cents)}</span>;
}

export function Progress({ value, tone = '' , label }: { value: number; tone?: string; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress ${tone}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${v}%` }} />
    </div>
  );
}

export function Empty({ art = '✧', title, text, action }: { art?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="art" aria-hidden>{art}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function StatusChip({ status }: { status: 'paid' | 'pending' | 'overdue' }) {
  const label = { paid: 'Pago', pending: 'Pendente', overdue: 'Vencido' }[status];
  const ic = { paid: '✓', pending: '◷', overdue: '!' }[status];
  return (
    <span className={`chip ${status}`}>
      <span aria-hidden>{ic}</span> {label}
    </span>
  );
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="stack" style={{ alignItems: 'center' }} role="status">
      <div className="spinner" aria-hidden />
      <span className="muted small">{label}</span>
    </div>
  );
}
