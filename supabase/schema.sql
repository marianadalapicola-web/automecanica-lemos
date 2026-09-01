-- =====================================================================
-- AUTOMECÂNICA LEMOS — Schema completo (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no SQL Editor do seu projeto Supabase.
-- Idempotente: pode ser executado novamente sem duplicar objetos.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- PERFIS DE USUÁRIO (admin / funcionario)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null default '',
  role text not null default 'funcionario' check (role in ('admin', 'funcionario')),
  created_at timestamptz not null default now()
);

-- Cria automaticamente um profile quando um novo usuário se registra no Auth.
-- O primeiro usuário criado no sistema vira admin; os demais, funcionário.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'funcionario' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text not null default '',
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  created_at timestamptz not null default now()
);
create index if not exists clients_nome_idx on public.clients using gin (to_tsvector('simple', nome));
create index if not exists clients_documento_idx on public.clients (documento);

-- ---------------------------------------------------------------------
-- VEÍCULOS
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  placa text not null,
  marca text not null default '',
  modelo text not null default '',
  ano text,
  cor text,
  km numeric,
  observacoes text,
  created_at timestamptz not null default now()
);
create index if not exists vehicles_placa_idx on public.vehicles (placa);
create index if not exists vehicles_client_idx on public.vehicles (client_id);

-- ---------------------------------------------------------------------
-- FORNECEDORES
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  telefone text,
  whatsapp text,
  email text,
  contato text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CONFIGURAÇÕES (linha única)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id boolean primary key default true constraint settings_singleton check (id),
  nome_oficina text not null default 'AUTOMECÂNICA LEMOS',
  razao_social text,
  cnpj text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  cep text,
  cidade text,
  estado text,
  logo_url text
);
insert into public.settings (id, nome_oficina)
values (true, 'AUTOMECÂNICA LEMOS')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- CONTADORES (numeração automática de cotações)
-- ---------------------------------------------------------------------
create table if not exists public.counters (
  id text primary key,
  value integer not null default 0
);

create or replace function public.next_document_number(counter_key text, prefix text, pad int default 4)
returns text
language plpgsql
as $$
declare
  new_value integer;
begin
  insert into public.counters (id, value) values (counter_key, 1)
  on conflict (id) do update set value = public.counters.value + 1
  returning value into new_value;
  return prefix || lpad(new_value::text, pad, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- COTAÇÕES
-- ---------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  data date not null default current_date,
  validade date,
  client_id uuid not null references public.clients(id),
  vehicle_id uuid references public.vehicles(id),
  responsavel text,
  observacoes text,
  forma_pagamento text,
  prazo_entrega text,
  status text not null default 'rascunho' check (status in ('rascunho','enviada','aprovada','recusada','expirada')),
  subtotal numeric not null default 0,
  desconto numeric not null default 0,
  total numeric not null default 0,
  converted_note_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_quote_numero()
returns trigger
language plpgsql
as $$
begin
  if new.numero is null then
    new.numero := public.next_document_number(
      'quote_' || extract(year from coalesce(new.data, current_date))::text,
      'COT-' || extract(year from coalesce(new.data, current_date))::text || '-',
      4
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_quote_numero on public.quotes;
create trigger trg_set_quote_numero
  before insert on public.quotes
  for each row execute function public.set_quote_numero();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create index if not exists quotes_client_idx on public.quotes (client_id);
create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_numero_idx on public.quotes (numero);

-- ---------------------------------------------------------------------
-- ITENS DA COTAÇÃO
-- ---------------------------------------------------------------------
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  codigo text,
  descricao text not null,
  tipo text not null default 'peca' check (tipo in ('peca','servico')),
  marca text,
  quantidade numeric not null default 1,
  unidade text not null default 'un',
  valor_unitario numeric not null default 0,
  desconto numeric not null default 0,
  total numeric not null default 0,
  fornecedor_id uuid references public.suppliers(id),
  fornecedor_nome text,
  ordem integer not null default 0
);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);

-- ---------------------------------------------------------------------
-- OPÇÕES DE FORNECEDORES (comparação de preços por item)
-- ---------------------------------------------------------------------
create table if not exists public.supplier_options (
  id uuid primary key default gen_random_uuid(),
  quote_item_id uuid not null references public.quote_items(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  supplier_nome_livre text,
  preco numeric not null default 0,
  selecionado boolean not null default false
);
create index if not exists supplier_options_item_idx on public.supplier_options (quote_item_id);

-- ---------------------------------------------------------------------
-- NOTAS FISCAIS
-- ---------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  serie text not null default '1',
  data date not null default current_date,
  chave_acesso text,
  status text not null default 'aberta' check (status in ('aberta','paga','cancelada')),
  observacoes text,
  client_id uuid not null references public.clients(id),
  vehicle_id uuid references public.vehicles(id),
  forma_pagamento text,
  condicao_pagamento text,
  parcelas integer default 1,
  valor_pago numeric not null default 0,
  subtotal numeric not null default 0,
  desconto numeric not null default 0,
  total numeric not null default 0,
  origin_quote_id uuid references public.quotes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (numero, serie)
);

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create index if not exists notes_client_idx on public.notes (client_id);
create index if not exists notes_numero_idx on public.notes (numero);
create index if not exists notes_status_idx on public.notes (status);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_converted_note_fk'
  ) then
    alter table public.quotes
      add constraint quotes_converted_note_fk foreign key (converted_note_id) references public.notes(id) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- ITENS DA NOTA
-- ---------------------------------------------------------------------
create table if not exists public.note_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  codigo text,
  descricao text not null,
  tipo text not null default 'peca' check (tipo in ('peca','servico')),
  quantidade numeric not null default 1,
  unidade text not null default 'un',
  valor_unitario numeric not null default 0,
  desconto numeric not null default 0,
  total numeric not null default 0,
  ordem integer not null default 0
);
create index if not exists note_items_note_idx on public.note_items (note_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.suppliers enable row level security;
alter table public.settings enable row level security;
alter table public.counters enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.supplier_options enable row level security;
alter table public.notes enable row level security;
alter table public.note_items enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- PROFILES
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- CLIENTS / VEHICLES / SUPPLIERS — leitura e escrita para qualquer usuário autenticado,
-- exclusão apenas para admin.
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients for select using (public.is_staff());
drop policy if exists "clients_insert" on public.clients;
create policy "clients_insert" on public.clients for insert with check (public.is_staff());
drop policy if exists "clients_update" on public.clients;
create policy "clients_update" on public.clients for update using (public.is_staff());
drop policy if exists "clients_delete" on public.clients;
create policy "clients_delete" on public.clients for delete using (public.is_admin());

drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select" on public.vehicles for select using (public.is_staff());
drop policy if exists "vehicles_insert" on public.vehicles;
create policy "vehicles_insert" on public.vehicles for insert with check (public.is_staff());
drop policy if exists "vehicles_update" on public.vehicles;
create policy "vehicles_update" on public.vehicles for update using (public.is_staff());
drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete" on public.vehicles for delete using (public.is_admin());

drop policy if exists "suppliers_select" on public.suppliers;
create policy "suppliers_select" on public.suppliers for select using (public.is_staff());
drop policy if exists "suppliers_insert" on public.suppliers;
create policy "suppliers_insert" on public.suppliers for insert with check (public.is_staff());
drop policy if exists "suppliers_update" on public.suppliers;
create policy "suppliers_update" on public.suppliers for update using (public.is_staff());
drop policy if exists "suppliers_delete" on public.suppliers;
create policy "suppliers_delete" on public.suppliers for delete using (public.is_admin());

-- QUOTES
drop policy if exists "quotes_select" on public.quotes;
create policy "quotes_select" on public.quotes for select using (public.is_staff());
drop policy if exists "quotes_insert" on public.quotes;
create policy "quotes_insert" on public.quotes for insert with check (public.is_staff());
drop policy if exists "quotes_update" on public.quotes;
create policy "quotes_update" on public.quotes for update using (public.is_staff());
drop policy if exists "quotes_delete" on public.quotes;
create policy "quotes_delete" on public.quotes for delete using (public.is_admin());

drop policy if exists "quote_items_all" on public.quote_items;
create policy "quote_items_all" on public.quote_items for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "supplier_options_all" on public.supplier_options;
create policy "supplier_options_all" on public.supplier_options for all using (public.is_staff()) with check (public.is_staff());

-- NOTES
drop policy if exists "notes_select" on public.notes;
create policy "notes_select" on public.notes for select using (public.is_staff());
drop policy if exists "notes_insert" on public.notes;
create policy "notes_insert" on public.notes for insert with check (public.is_staff());
drop policy if exists "notes_update" on public.notes;
create policy "notes_update" on public.notes for update using (public.is_staff());
drop policy if exists "notes_delete" on public.notes;
create policy "notes_delete" on public.notes for delete using (public.is_admin());

drop policy if exists "note_items_all" on public.note_items;
create policy "note_items_all" on public.note_items for all using (public.is_staff()) with check (public.is_staff());

-- SETTINGS
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings for select using (public.is_staff());
drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings for update using (public.is_admin());
drop policy if exists "settings_insert" on public.settings;
create policy "settings_insert" on public.settings for insert with check (public.is_admin());

-- COUNTERS (usado apenas internamente pelo trigger de numeração)
drop policy if exists "counters_all" on public.counters;
create policy "counters_all" on public.counters for all using (public.is_staff()) with check (public.is_staff());

-- =====================================================================
-- FIM DO SCRIPT
-- =====================================================================
