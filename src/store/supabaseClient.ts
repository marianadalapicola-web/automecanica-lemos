import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Apenas a URL e a chave pública (anon). A segurança dos dados é garantida pelas
// políticas RLS no banco — veja supabase/schema.sql.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes('SEU-PROJETO')
    ? createClient(url, anonKey, {
        // PKCE devolve ?code= na URL, compatível com o roteamento por hash (#/rota).
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
    : null;

export const cloudConfigured = supabase !== null;
