-- ✧ Glossy Money — esquema do banco (Supabase / PostgreSQL)
-- Execute no Supabase: SQL Editor → New query → cole este arquivo → Run.
-- É idempotente: pode ser executado mais de uma vez.

-- Uma linha por usuário com o documento financeiro completo (JSONB).
-- `version` implementa controle de concorrência otimista: o app só grava se a
-- versão no banco for a mesma que ele carregou, evitando que um dispositivo
-- sobrescreva sem querer as alterações feitas em outro.
create table if not exists public.glossy_user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  version    integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  constraint data_is_object check (jsonb_typeof(data) = 'object'),
  constraint data_size check (pg_column_size(data) < 5000000)
);

-- updated_at automático
create or replace function public.glossy_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists glossy_touch on public.glossy_user_data;
create trigger glossy_touch before update on public.glossy_user_data
for each row execute function public.glossy_touch_updated_at();

-- Impede alterar o dono da linha e exige que a versão avance exatamente 1.
create or replace function public.glossy_guard_update()
returns trigger language plpgsql as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id não pode ser alterado';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'versão inválida (esperado %)', old.version + 1;
  end if;
  return new;
end $$;

drop trigger if exists glossy_guard on public.glossy_user_data;
create trigger glossy_guard before update on public.glossy_user_data
for each row execute function public.glossy_guard_update();

-- ───── Row Level Security: cada usuário só enxerga e altera a própria linha ─────
alter table public.glossy_user_data enable row level security;
alter table public.glossy_user_data force row level security;

drop policy if exists "own row select" on public.glossy_user_data;
drop policy if exists "own row insert" on public.glossy_user_data;
drop policy if exists "own row update" on public.glossy_user_data;
drop policy if exists "own row delete" on public.glossy_user_data;

create policy "own row select" on public.glossy_user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row insert" on public.glossy_user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row update" on public.glossy_user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row delete" on public.glossy_user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Visitantes não autenticados não têm acesso algum.
revoke all on public.glossy_user_data from anon;
grant select, insert, update, delete on public.glossy_user_data to authenticated;

-- ───── Exclusão da própria conta ─────
-- SECURITY DEFINER para poder apagar de auth.users, mas restrita ao próprio usuário
-- (auth.uid()). Os dados financeiros são removidos em cascata.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;
  delete from public.glossy_user_data where user_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
