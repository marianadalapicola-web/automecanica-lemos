import { supabase } from "@/lib/supabaseClient";
import { calcTotals, itemTotal } from "@/lib/calc";
import type { Note, NoteStatus } from "@/types/database";
import { getQuote } from "@/lib/api/quotes";

const NOTE_SELECT =
  "*, client:clients(*), vehicle:vehicles(*), items:note_items(*)";

export interface NoteItemDraft {
  id?: string;
  codigo: string;
  descricao: string;
  tipo: "peca" | "servico";
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  desconto: number;
}

export interface NoteHeaderInput {
  numero: string;
  serie: string;
  data: string;
  chave_acesso: string | null;
  status: NoteStatus;
  observacoes: string | null;
  client_id: string;
  vehicle_id: string | null;
  forma_pagamento: string | null;
  condicao_pagamento: string | null;
  parcelas: number | null;
  valor_pago: number;
  origin_quote_id?: string | null;
}

export async function listNotes(search?: string): Promise<Note[]> {
  let query = supabase
    .from("notes")
    .select("*, client:clients(*), vehicle:vehicles(*)")
    .order("created_at", { ascending: false });
  if (search) {
    const like = `%${search}%`;
    query = query.or(`numero.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Note[];
}

export async function listNotesByClient(clientId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function listNotesByVehicle(vehicleId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function getNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Note | null;
}

export async function suggestNextNoteNumber(): Promise<string> {
  const { data, error } = await supabase
    .from("notes")
    .select("numero")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0]?.numero;
  const lastNum = last ? parseInt(last.replace(/\D/g, ""), 10) : 0;
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return String(next).padStart(4, "0");
}

export async function createNote(
  header: NoteHeaderInput,
  items: NoteItemDraft[]
): Promise<Note> {
  const totals = calcTotals(
    items.map((i) => ({
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      desconto: i.desconto,
    }))
  );

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      ...header,
      ...totals,
    })
    .select("*")
    .single();
  if (error) throw error;

  await saveNoteItems((note as Note).id, items);
  return (await getNote((note as Note).id)) as Note;
}

export async function updateNote(
  id: string,
  header: NoteHeaderInput,
  items: NoteItemDraft[]
): Promise<Note> {
  const totals = calcTotals(
    items.map((i) => ({
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      desconto: i.desconto,
    }))
  );

  const { error } = await supabase
    .from("notes")
    .update({ ...header, ...totals })
    .eq("id", id);
  if (error) throw error;

  const { error: delErr } = await supabase
    .from("note_items")
    .delete()
    .eq("note_id", id);
  if (delErr) throw delErr;

  await saveNoteItems(id, items);
  return (await getNote(id)) as Note;
}

async function saveNoteItems(noteId: string, items: NoteItemDraft[]) {
  if (items.length === 0) return;
  const payload = items.map((item, idx) => ({
    note_id: noteId,
    codigo: item.codigo || null,
    descricao: item.descricao,
    tipo: item.tipo,
    quantidade: item.quantidade,
    unidade: item.unidade || "un",
    valor_unitario: item.valor_unitario,
    desconto: item.desconto,
    total: itemTotal(item),
    ordem: idx,
  }));
  const { error } = await supabase.from("note_items").insert(payload);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function updateNoteStatus(
  id: string,
  status: NoteStatus
): Promise<void> {
  const { error } = await supabase.from("notes").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Converte uma cotação aprovada em uma nova nota fiscal, copiando cliente,
 * veículo, itens, quantidades, valores e descontos. A cotação original é
 * preservada e vinculada à nota gerada (converted_note_id / origin_quote_id).
 */
export async function convertQuoteToNote(quoteId: string): Promise<Note> {
  const quote = await getQuote(quoteId);
  if (!quote) throw new Error("Cotação não encontrada");
  if (quote.status !== "aprovada") {
    throw new Error("Apenas cotações aprovadas podem ser convertidas em nota.");
  }
  if (quote.converted_note_id) {
    throw new Error("Esta cotação já foi convertida em nota.");
  }

  const numero = await suggestNextNoteNumber();

  const items: NoteItemDraft[] = (quote.items || []).map((item) => ({
    codigo: item.codigo || "",
    descricao: item.descricao,
    tipo: item.tipo,
    quantidade: item.quantidade,
    unidade: item.unidade,
    valor_unitario: item.valor_unitario,
    desconto: item.desconto,
  }));

  const note = await createNote(
    {
      numero,
      serie: "1",
      data: new Date().toISOString().slice(0, 10),
      chave_acesso: null,
      status: "aberta",
      observacoes: quote.observacoes,
      client_id: quote.client_id,
      vehicle_id: quote.vehicle_id,
      forma_pagamento: null,
      condicao_pagamento: null,
      parcelas: 1,
      valor_pago: 0,
      origin_quote_id: quote.id,
    },
    items
  );

  const { error } = await supabase
    .from("quotes")
    .update({ converted_note_id: note.id })
    .eq("id", quoteId);
  if (error) throw error;

  return note;
}
