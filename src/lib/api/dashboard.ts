import { supabase } from "@/lib/supabaseClient";
import type { Note, Quote } from "@/types/database";

export interface DashboardStats {
  totalNotes: number;
  totalNotesValue: number;
  totalQuotes: number;
  openQuotes: number;
  approvedQuotes: number;
  totalClients: number;
  totalVehicles: number;
  latestNotes: Note[];
  latestQuotes: Quote[];
}

export async function loadDashboardStats(): Promise<DashboardStats> {
  const [
    notesCountRes,
    notesValueRes,
    quotesCountRes,
    openQuotesRes,
    approvedQuotesRes,
    clientsCountRes,
    vehiclesCountRes,
    latestNotesRes,
    latestQuotesRes,
  ] = await Promise.all([
    supabase.from("notes").select("id", { count: "exact", head: true }),
    supabase.from("notes").select("total"),
    supabase.from("quotes").select("id", { count: "exact", head: true }),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["rascunho", "enviada"]),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "aprovada"),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase
      .from("notes")
      .select("*, client:clients(*), vehicle:vehicles(*)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("quotes")
      .select("*, client:clients(*), vehicle:vehicles(*)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalNotesValue = (notesValueRes.data || []).reduce(
    (sum, n: { total: number }) => sum + (n.total || 0),
    0
  );

  return {
    totalNotes: notesCountRes.count || 0,
    totalNotesValue,
    totalQuotes: quotesCountRes.count || 0,
    openQuotes: openQuotesRes.count || 0,
    approvedQuotes: approvedQuotesRes.count || 0,
    totalClients: clientsCountRes.count || 0,
    totalVehicles: vehiclesCountRes.count || 0,
    latestNotes: (latestNotesRes.data || []) as unknown as Note[],
    latestQuotes: (latestQuotesRes.data || []) as unknown as Quote[],
  };
}
