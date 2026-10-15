import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { supabase, cloudConfigured } from '../store/supabaseClient';
import { Sparkle } from '../components/Icon';

type View = 'signin' | 'signup' | 'reset';

function translate(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(msg)) return 'Este e-mail já está cadastrado. Tente entrar.';
  if (/Password should be at least/i.test(msg)) return 'A senha deve ter pelo menos 8 caracteres.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (/fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return msg;
}

export default function Auth() {
  const { startDemo } = useApp();
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setInfo(null);
    if (view === 'signup') {
      if (password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.');
      if (password !== password2) return setError('As senhas não conferem.');
    }
    setLoading(true);
    try {
      if (view === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (view === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
        if (!data.session) setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar ♡');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        if (error) throw error;
        setInfo('Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
      }
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="hero-logo">
          <span className="logo-mark"><Sparkle size={34} className="" /></span>
          <span className="logo-text">Glossy <span>Money</span></span>
          <span className="slogan" style={{ fontSize: '0.95rem' }}>your money, your dreams ♡</span>
        </div>
        <section className="card glossy stack">
          {cloudConfigured ? (
            <>
              <div className="segmented" role="tablist">
                <button role="tab" aria-pressed={view === 'signin'} aria-selected={view === 'signin'} onClick={() => setView('signin')}>Entrar</button>
                <button role="tab" aria-pressed={view === 'signup'} aria-selected={view === 'signup'} onClick={() => setView('signup')}>Criar conta</button>
              </div>
              <form className="stack" onSubmit={submit}>
                <label className="field"><span>E-mail</span><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                {view !== 'reset' && (
                  <label className="field"><span>Senha</span><input className="input" type="password" autoComplete={view === 'signup' ? 'new-password' : 'current-password'} required minLength={view === 'signup' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
                )}
                {view === 'signup' && (
                  <label className="field"><span>Confirme a senha</span><input className="input" type="password" autoComplete="new-password" required value={password2} onChange={(e) => setPassword2(e.target.value)} /></label>
                )}
                {error && <div className="form-error" role="alert">{error}</div>}
                {info && <div className="form-note" role="status">{info}</div>}
                <button className="btn primary" disabled={loading} type="submit">
                  {loading ? 'Aguarde…' : view === 'signin' ? 'Entrar' : view === 'signup' ? 'Criar minha conta' : 'Enviar link'}
                </button>
                {view === 'signin' && <button type="button" className="btn ghost sm" onClick={() => setView('reset')}>Esqueci minha senha</button>}
                {view === 'reset' && <button type="button" className="btn ghost sm" onClick={() => setView('signin')}>Voltar</button>}
              </form>
              <p className="tiny muted">Seus dados ficam associados à sua conta e protegidos por regras de acesso no banco: nenhum outro usuário consegue lê-los.</p>
            </>
          ) : (
            <div className="stack">
              <h2>Sincronização ainda não configurada</h2>
              <p className="small muted">
                Esta instalação do Glossy Money ainda não está conectada a um banco de dados (Supabase). Você pode usar o modo demonstração agora —
                os dados ficarão salvos <strong>apenas neste navegador</strong>. Para ter login e sincronização entre dispositivos, siga o guia do README.
              </p>
            </div>
          )}
          <hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%' }} />
          <button className="btn chrome" onClick={startDemo}>✧ Experimentar no modo demonstração</button>
          <p className="tiny muted" style={{ textAlign: 'center' }}>No modo demonstração nada é enviado para a nuvem.</p>
        </section>
      </div>
    </div>
  );
}
