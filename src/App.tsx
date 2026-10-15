import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import { ConfirmProvider, Modal, Spinner, ToastProvider, useToast } from './components/ui';
import { Layout } from './components/Layout';
import { useBrowserNotifications } from './components/Alerts';
import { supabase } from './store/supabaseClient';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';

const Transactions = lazy(() => import('./pages/Transactions'));
const Budget = lazy(() => import('./pages/Budget'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Installments = lazy(() => import('./pages/Installments'));
const Goals = lazy(() => import('./pages/Goals'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

function Shell() {
  const { mode, ready, loadError, reload } = useApp();
  useBrowserNotifications();

  if (mode === 'loading') return <div className="center-screen"><Spinner label="Abrindo seu Glossy Money…" /></div>;
  if (mode === 'signed-out') return <Auth />;
  if (loadError)
    return (
      <div className="center-screen">
        <div className="card stack" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>☁️</div>
          <h2>Não foi possível carregar seus dados</h2>
          <p className="muted">{loadError}</p>
          <button className="btn primary" onClick={() => void reload()}>Tentar novamente</button>
        </div>
      </div>
    );
  if (!ready) return <div className="center-screen"><Spinner label="Carregando seus dados…" /></div>;

  return (
    <Layout>
      <Suspense fallback={<div style={{ padding: 40, display: 'grid', placeItems: 'center' }}><Spinner /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transacoes" element={<Transactions />} />
          <Route path="/orcamento" element={<Budget />} />
          <Route path="/contas" element={<Accounts />} />
          <Route path="/parcelamentos" element={<Installments />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

/** Após clicar no link de redefinição de senha, o Supabase abre uma sessão de recuperação. */
function PasswordRecovery() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evt) => evt === 'PASSWORD_RECOVERY' && setOpen(true));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!open) return null;
  const save = async () => {
    if (pw.length < 8) return setErr('A senha deve ter pelo menos 8 caracteres.');
    const { error } = await supabase!.auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    toast('Senha atualizada ✧');
    setOpen(false);
  };
  return (
    <Modal title="Defina uma nova senha" onClose={() => setOpen(false)} footer={<button className="btn primary" onClick={save}>Salvar senha</button>}>
      <label className="field"><span>Nova senha</span><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <div className="form-error" style={{ marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppProvider>
          <HashRouter>
            <Shell />
            <PasswordRecovery />
          </HashRouter>
        </AppProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
