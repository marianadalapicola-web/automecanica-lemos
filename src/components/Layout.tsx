import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, Sparkle } from './Icon';
import { useApp } from '../store/AppContext';
import { TransactionForm, type TxPreset } from './TransactionForm';
import { Modal } from './ui';
import type { Transaction } from '../data/types';
import { cloudConfigured } from '../store/supabaseClient';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Início', icon: 'home' },
  { to: '/transacoes', label: 'Transações', short: 'Lançamentos', icon: 'list' },
  { to: '/orcamento', label: 'Orçamento', short: 'Orçamento', icon: 'pie' },
  { to: '/contas', label: 'Contas e cartões', short: 'Contas', icon: 'wallet' },
  { to: '/parcelamentos', label: 'Parcelamentos', short: 'Parcelas', icon: 'layers' },
  { to: '/metas', label: 'Metas', short: 'Metas', icon: 'star' },
  { to: '/relatorios', label: 'Relatórios', short: 'Relatórios', icon: 'chart' },
  { to: '/configuracoes', label: 'Configurações', short: 'Ajustes', icon: 'gear' },
];

interface QuickCtx {
  openNew: (preset?: TxPreset) => void;
  openEdit: (t: Transaction) => void;
}
const Quick = createContext<QuickCtx>({ openNew: () => {}, openEdit: () => {} });
export const useQuickAdd = () => useContext(Quick);

export function Logo({ withSlogan }: { withSlogan?: boolean }) {
  return (
    <NavLink to="/" className="logo" aria-label="Glossy Money — início">
      <span className="logo-mark"><Sparkle size={22} className="" /></span>
      <span>
        <span className="logo-text">Glossy <span>Money</span></span>
        {withSlogan && <div className="slogan">your money, your dreams ♡</div>}
      </span>
    </NavLink>
  );
}

export function SyncBadge() {
  const { mode, sync, online, retrySync } = useApp();
  if (mode === 'demo' && !cloudConfigured)
    return (
      <span className="sync ok" title="Os dados ficam salvos neste navegador. Use o backup em Configurações para guardar uma cópia.">
        <Icon name="check" size={14} /> Salvo neste aparelho
      </span>
    );
  if (mode === 'demo')
    return (
      <span className="sync demo" title="Os dados ficam salvos apenas neste navegador">
        <Icon name="alert" size={14} /> Modo demonstração
      </span>
    );
  if (!online || sync === 'offline')
    return (
      <span className="sync err" role="status">
        <Icon name="cloud" size={14} /> Offline{sync === 'offline' ? ' · alterações pendentes' : ''}
      </span>
    );
  if (sync === 'saving') return <span className="sync" role="status"><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Salvando…</span>;
  if (sync === 'error')
    return (
      <button className="sync err" onClick={retrySync} style={{ cursor: 'pointer' }}>
        <Icon name="alert" size={14} /> Erro ao salvar · tentar de novo
      </button>
    );
  if (sync === 'conflict') return <span className="sync err"><Icon name="alert" size={14} /> Conflito de sincronização</span>;
  return (
    <span className="sync ok" role="status">
      <Icon name="cloud" size={14} /> {sync === 'saved' ? 'Sincronizado' : 'Conectado'}
    </span>
  );
}

function ConflictBanner() {
  const { sync, resolveConflict } = useApp();
  if (sync !== 'conflict') return null;
  return (
    <div className="banner err" role="alert">
      <span className="grow">
        Seus dados foram alterados em outro dispositivo enquanto este tinha alterações não enviadas. Qual versão deseja manter?
      </span>
      <button className="btn sm" onClick={() => resolveConflict('cloud')}>Usar a da nuvem</button>
      <button className="btn sm danger" onClick={() => resolveConflict('local')}>Manter a deste aparelho</button>
    </div>
  );
}

export function Layout({ children }: { children?: ReactNode }) {
  const { mode, data } = useApp();
  const [form, setForm] = useState<{ preset?: TxPreset; initial?: Transaction } | null>(null);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const openNew = useCallback((preset?: TxPreset) => setForm({ preset }), []);
  const openEdit = useCallback((t: Transaction) => setForm({ initial: t }), []);
  const name = data.settings.displayName;

  return (
    <Quick.Provider value={{ openNew, openEdit }}>
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <div className="app">
        <aside className="sidebar" aria-label="Navegação principal">
          <Logo withSlogan />
          <button className="btn primary" onClick={() => openNew()}>
            <Icon name="plus" /> Novo lançamento
          </button>
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                <Icon name={n.icon} /> {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <SyncBadge />
            {name && <span className="small muted">Olá, {name} ♡</span>}
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <Logo />
            <span className="grow" />
            <SyncBadge />
          </header>
          <main className="content" id="conteudo">
            {mode === 'demo' && cloudConfigured && (
              <div className="banner demo" role="note">
                <Icon name="alert" />
                <span className="grow">
                  Modo demonstração: os dados ficam salvos <strong>apenas neste navegador</strong> e não são sincronizados.
                </span>
                <NavLink to="/configuracoes#conta" className="btn sm">Saiba mais</NavLink>
              </div>
            )}
            <ConflictBanner />
            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      <nav className="bottom-nav" aria-label="Navegação">
        <NavLink to="/" end><Icon name="home" /> Início</NavLink>
        <NavLink to="/transacoes"><Icon name="list" /> Lançamentos</NavLink>
        <div className="fab-slot">
          <button className="fab" onClick={() => openNew()} aria-label="Adicionar receita ou despesa">
            <Icon name="plus" size={26} />
          </button>
        </div>
        <NavLink to="/contas"><Icon name="wallet" /> Contas</NavLink>
        <button
          className="navbtn"
          onClick={() => setMore(true)}
          aria-label="Mais seções"
          style={['/orcamento', '/parcelamentos', '/metas', '/relatorios', '/configuracoes'].includes(loc.pathname) ? { color: 'var(--accent)' } : undefined}
        >
          <Icon name="more" /> Mais
        </button>
      </nav>

      {more && (
        <Modal title="Mais seções" onClose={() => setMore(false)}>
          <div className="sheet-links">
            {NAV.filter((n) => !['/', '/transacoes', '/contas'].includes(n.to)).map((n) => (
              <NavLink key={n.to} to={n.to} onClick={() => setMore(false)}>
                <Icon name={n.icon} /> {n.short}
              </NavLink>
            ))}
          </div>
        </Modal>
      )}

      {form && <TransactionForm initial={form.initial} preset={form.preset} onClose={() => setForm(null)} />}
    </Quick.Provider>
  );
}
