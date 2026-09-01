import { supabase } from "@/lib/supabaseClient";
import { calcTotals, itemTotal } from "@/lib/calc";
import type { Quote, QuoteItem, QuoteStatus } from "@/types/database";

const QUOTE_SELECT =
  "*, client:clients(*), vehicle:vehicles(*), items:quote_items(*, supplier_options(*, supplier:suppliers(*)))";

export interface QuoteItemDraft {
  id?: string;
  codigo: string;
  descricao: string;
  tipo: "peca" | "servico";
  marca: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  desconto: number;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  supplier_options: SupplierOptionDraft[];
}

export interface SupplierOptionDraft {
  id?: string;
  supplier_id: string | null;
  supplier_nome_livre: string | null;
  preco: number;
  selecionado: boolean;
}

export interface QuoteHeaderInput {
  data: string;
  validade: string | null;
  client_id: string;
  vehicle_id: string | null;
  responsavel: string | null;
  observacoes: string | null;
  forma_pagamento: string | null;
  prazo_entrega: string | null;
  status: QuoteStatus;
}

export async function listQuotes(search?: string): Promise<Quote[]> {
  let query = supabase
    .from("quotes")
    .select("*, client:clients(*), vehicle:vehicles(*)")
    .order("created_at", { ascending: false });
  if (search) {
    const like = `%${search}%`;
    query = query.or(`numero.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Quote[];
}

export async function listQuotesByClient(clientId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function listQuotesByVehicle(vehicleId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function getQuote(id: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Quote | null;
}

export async function createQuote(
  header: QuoteHeaderInput,
  items: QuoteItemDraft[]
): Promise<Quote> {
  const totals = calcTotals(
    items.map((i) => ({
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      desconto: i.desconto,
    }))
  );

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({ ...header, ...totals })
    .select("*")
    .single();
  if (error) throw error;

  await saveQuoteItems((quote as Quote).id, items);
  return (await getQuote((quote as Quote).id)) as Quote;
}

export async function updateQuote(
  id: string,
  header: QuoteHeaderInput,
  items: QuoteItemDraft[]
): Promise<Quote> {
  const totals = calcTotals(
    items.map((i) => ({
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      desconto: i.desconto,
    }))
  );

  const { error } = await supabase
    .from("quotes")
    .update({ ...header, ...totals })
    .eq("id", id);
  if (error) throw error;

  // Replace items wholesale — simplest consistent strategy for a form-driven editor.
  const { error: delErr } = await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", id);
  if (delErr) throw delErr;

  await saveQuoteItems(id, items);
  return (await getQuote(id)) as Quote;
}

async function saveQuoteItems(quoteId: string, items: QuoteItemDraft[]) {
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const total = itemTotal({
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      desconto: item.desconto,
    });
    const { data: savedItem, error } = await supabase
      .from("quote_items")
      .insert({
        quote_id: quoteId,
        codigo: item.codigo || null,
        descricao: item.descricao,
        tipo: item.tipo,
        marca: item.marca || null,
        quantidade: item.quantidade,
        unidade: item.unidade || "un",
        valor_unitario: item.valor_unitario,
        desconto: item.desconto,
        total,
        fornecedor_id: item.fornecedor_id,
        fornecedor_nome: item.fornecedor_nome,
        ordem: idx,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (item.supplier_options.length > 0) {
      const optionsPayload = item.supplier_options.map((opt) => ({
        quote_item_id: (savedItem as { id: string }).id,
        supplier_id: opt.supplier_id,
        supplier_nome_livre: opt.supplier_nome_livre,
        preco: opt.preco,
        selecionado: opt.selecionado,
      }));
      const { error: optErr } = await supabase
        .from("supplier_options")
        .insert(optionsPayload);
      if (optErr) throw optErr;
    }
  }
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw error;
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus
): Promise<void> {
  const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function duplicateQuote(id: string): Promise<Quote> {
  const original = await getQuote(id);
  if (!original) throw new Error("Cotação não encontrada");

  const items: QuoteItemDraft[] = (original.items || []).map((item) => ({
    codigo: item.codigo || "",
    descricao: item.descricao,
    tipo: item.tipo,
    marca: item.marca || "",
    quantidade: item.quantidade,
    unidade: item.unidade,
    valor_unitario: item.valor_unitario,
    desconto: item.desconto,
    fornecedor_id: (item as unknown as { fornecedor_id: string | null }).fornecedor_id ?? null,
    fornecedor_nome: (item as unknown as { fornecedor_nome: string | null }).fornecedor_nome ?? null,
    supplier_options: (item.supplier_options || []).map((opt) => ({
      supplier_id: opt.supplier_id,
      supplier_nome_livre: opt.supplier_nome_livre,
      preco: opt.preco,
      selecionado: opt.selecionado,
    })),
  }));

  return createQuote(
    {
      data: new Date().toISOString().slice(0, 10),
      validade: original.validade,
      client_id: original.client_id,
      vehicle_id: original.vehicle_id,
      responsavel: original.responsavel,
      observacoes: original.observacoes,
      forma_pagamento: original.forma_pagamento,
      prazo_entrega: original.prazo_entrega,
      status: "rascunho",
    },
    items
  );
}

export function nextQuoteItem(): QuoteItemDraft {
  return {
    codigo: "",
    descricao: "",
    tipo: "peca",
    marca: "",
    quantidade: 1,
    unidade: "un",
    valor_unitario: 0,
    desconto: 0,
    fornecedor_id: null,
    fornecedor_nome: null,
    supplier_options: [],
  };
}

export type { QuoteItem };
