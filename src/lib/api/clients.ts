import { supabase } from "@/lib/supabaseClient";
import type { Client } from "@/types/database";

export async function listClients(search?: string): Promise<Client[]> {
  let query = supabase.from("clients").select("*").order("nome");
  if (search) {
    const like = `%${search}%`;
    query = query.or(`nome.ilike.${like},documento.ilike.${like},email.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Client | null;
}

export type ClientInput = Omit<Client, "id" | "created_at">;

export async function createClient(input: ClientInput): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export async function updateClient(
  id: string,
  input: Partial<ClientInput>
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}
