import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, UserRole } from "@/types/database";

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data as Profile[];
}

export async function updateProfileRole(id: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateProfileNome(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ nome }).eq("id", id);
  if (error) throw error;
}

/**
 * Cria um novo usuário sem afetar a sessão do administrador logado: usa uma
 * instância isolada do client (sem persistir sessão) apenas para o cadastro.
 */
export async function createUserAccount(input: {
  email: string;
  password: string;
  nome: string;
  role: UserRole;
}): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const isolatedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await isolatedClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { nome: input.nome } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Não foi possível criar o usuário.");

  if (input.role === "admin") {
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({ role: "admin", nome: input.nome })
      .eq("id", data.user.id);
    if (roleErr) throw roleErr;
  }
}
