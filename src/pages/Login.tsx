import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Wrench, Lock, Mail, Loader2 } from "@/components/icons";

export default function Login() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-black px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(225,29,46,0.25), transparent 40%), radial-gradient(circle at 80% 80%, rgba(225,29,46,0.15), transparent 45%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-red shadow-[0_0_0_6px_rgba(225,29,46,0.15)]">
            <Wrench className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            AUTOMEC&Acirc;NICA <span className="text-brand-red">LEMOS</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Sistema de gest&atilde;o da oficina
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur"
        >
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Supabase n&atilde;o configurado. Defina as vari&aacute;veis
              VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).
            </div>
          )}

          <div className="field mb-4">
            <label className="label !text-neutral-400" htmlFor="email">
              E-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@automecanicalemos.com.br"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/25"
              />
            </div>
          </div>

          <div className="field mb-5">
            <label className="label !text-neutral-400" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/25"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-base"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Acesso restrito &agrave; equipe da Automec&acirc;nica Lemos.
        </p>
      </div>
    </div>
  );
}
