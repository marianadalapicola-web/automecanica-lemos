import { supabase } from "@/lib/supabaseClient";
import type { Vehicle } from "@/types/database";

export async function listVehicles(search?: string): Promise<Vehicle[]> {
  let query = supabase
    .from("vehicles")
    .select("*, client:clients(*)")
    .order("placa");
  if (search) {
    const like = `%${search}%`;
    query = query.or(`placa.ilike.${like},marca.ilike.${like},modelo.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Vehicle[];
}

export async function listVehiclesByClient(clientId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("client_id", clientId)
    .order("placa");
  if (error) throw error;
  return data as Vehicle[];
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, client:clients(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Vehicle | null;
}

export type VehicleInput = Omit<Vehicle, "id" | "created_at" | "client">;

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export async function updateVehicle(
  id: string,
  input: Partial<VehicleInput>
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}
