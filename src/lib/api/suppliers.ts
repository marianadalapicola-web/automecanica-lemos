import { supabase } from "@/lib/supabaseClient";
import type { Supplier } from "@/types/database";

export async function listSuppliers(search?: string): Promise<Supplier[]> {
  let query = supabase.from("suppliers").select("*").order("nome");
  if (search) {
    const like = `%${search}%`;
    query = query.or(`nome.ilike.${like},cnpj.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Supplier[];
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Supplier | null;
}

export type SupplierInput = Omit<Supplier, "id" | "created_at">;

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function updateSupplier(
  id: string,
  input: Partial<SupplierInput>
): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}
