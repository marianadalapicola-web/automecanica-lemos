import { supabase } from "@/lib/supabaseClient";
import type { Settings } from "@/types/database";

const DEFAULT_SETTINGS: Settings = {
  id: "singleton" as unknown as Settings["id"],
  nome_oficina: "AUTOMECÂNICA LEMOS",
  razao_social: null,
  cnpj: null,
  telefone: null,
  whatsapp: null,
  email: null,
  endereco: null,
  cep: null,
  cidade: null,
  estado: null,
  logo_url: null,
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as Settings) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  input: Partial<Omit<Settings, "id">>
): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .update(input)
    .eq("id", true)
    .select("*")
    .single();
  if (error) throw error;
  return data as Settings;
}
