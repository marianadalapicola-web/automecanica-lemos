export type UserRole = "admin" | "funcionario";

export interface Profile {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  created_at: string;
}

export interface Client {
  id: string;
  nome: string;
  documento: string; // CPF/CNPJ
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  client_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: string | null;
  cor: string | null;
  km: number | null;
  observacoes: string | null;
  created_at: string;
  client?: Client;
}

export interface Supplier {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  contato: string | null;
  observacoes: string | null;
  created_at: string;
}

export type ItemTipo = "peca" | "servico";

export interface SupplierOption {
  id: string;
  quote_item_id: string;
  supplier_id: string | null;
  supplier_nome_livre: string | null;
  preco: number;
  selecionado: boolean;
  supplier?: Supplier;
}

export type QuoteStatus =
  | "rascunho"
  | "enviada"
  | "aprovada"
  | "recusada"
  | "expirada";

export interface Quote {
  id: string;
  numero: string; // COT-2026-0001
  data: string;
  validade: string | null;
  client_id: string;
  vehicle_id: string | null;
  responsavel: string | null;
  observacoes: string | null;
  forma_pagamento: string | null;
  prazo_entrega: string | null;
  status: QuoteStatus;
  subtotal: number;
  desconto: number;
  total: number;
  converted_note_id: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  codigo: string | null;
  descricao: string;
  tipo: ItemTipo;
  marca: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  desconto: number;
  total: number;
  ordem: number;
  supplier_options?: SupplierOption[];
}

export type NoteStatus = "aberta" | "paga" | "cancelada";

export interface Note {
  id: string;
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
  subtotal: number;
  desconto: number;
  total: number;
  origin_quote_id: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
  items?: NoteItem[];
}

export interface NoteItem {
  id: string;
  note_id: string;
  codigo: string | null;
  descricao: string;
  tipo: ItemTipo;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  desconto: number;
  total: number;
  ordem: number;
}

export interface Settings {
  id: string;
  nome_oficina: string;
  razao_social: string | null;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  cep: string | null;
  cidade: string | null;
  estado: string | null;
  logo_url: string | null;
}
