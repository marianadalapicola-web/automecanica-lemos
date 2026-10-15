-- Testes de isolamento entre usuários (fluxo 12). Cada bloco falha com exceção se a regra for violada.
\set ON_ERROR_STOP on
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bia@example.com');

-- Ana cria seus dados
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.glossy_user_data (user_id, data) values (auth.uid(), '{"segredo": "da Ana"}');

-- Ana não consegue criar linha em nome da Bia
do $$ begin
  begin
    insert into public.glossy_user_data (user_id, data) values ('22222222-2222-2222-2222-222222222222', '{}');
    raise exception 'FALHA: Ana inseriu dados da Bia';
  exception when insufficient_privilege then raise notice 'ok: insert em nome de outro bloqueado';
  end;
end $$;

-- Bia entra
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.glossy_user_data (user_id, data) values (auth.uid(), '{"segredo": "da Bia"}');

do $$ declare n int; begin
  select count(*) into n from public.glossy_user_data;
  if n <> 1 then raise exception 'FALHA: Bia vê % linhas', n; end if;
  select count(*) into n from public.glossy_user_data where user_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FALHA: Bia leu a linha da Ana'; end if;
  raise notice 'ok: Bia só enxerga a própria linha';
end $$;

do $$ declare n int; begin
  update public.glossy_user_data set data = '{"hack": true}', version = version + 1
    where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: Bia alterou dados da Ana'; end if;
  delete from public.glossy_user_data where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: Bia apagou dados da Ana'; end if;
  raise notice 'ok: Bia não altera nem apaga dados da Ana';
end $$;

-- Bia não pode "transferir" a própria linha para a Ana
do $$ begin
  begin
    update public.glossy_user_data set user_id = '11111111-1111-1111-1111-111111111111', version = version + 1 where user_id = auth.uid();
    raise exception 'FALHA: troca de dono permitida';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FALHA%' then raise; end if;
    raise notice 'ok: troca de dono bloqueada (%)', sqlerrm;
  end;
end $$;

-- Concorrência otimista: gravação com versão antiga não afeta linhas
do $$ declare n int; begin
  update public.glossy_user_data set data = '{"v": 2}', version = 2 where user_id = auth.uid() and version = 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHA: update válido não aplicado'; end if;
  update public.glossy_user_data set data = '{"v": "velho"}', version = 2 where user_id = auth.uid() and version = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: update com versão antiga aplicado'; end if;
  raise notice 'ok: controle de versão impede sobrescrita';
end $$;

-- Visitante anônimo não lê nada
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform * from public.glossy_user_data;
    raise exception 'FALHA: anon conseguiu ler';
  exception when insufficient_privilege then raise notice 'ok: anônimo sem acesso';
  end;
end $$;

-- Ana exclui a própria conta: some do auth.users e os dados vão junto; Bia continua intacta
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.delete_my_account();
reset role;
do $$ declare n int; begin
  select count(*) into n from auth.users where id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FALHA: usuário não excluído'; end if;
  select count(*) into n from public.glossy_user_data;
  if n <> 1 then raise exception 'FALHA: esperado 1 linha restante, há %', n; end if;
  raise notice 'ok: delete_my_account remove só a própria conta';
end $$;

-- anon não pode chamar delete_my_account
set role anon;
do $$ begin
  begin
    perform public.delete_my_account();
    raise exception 'FALHA: anon executou delete_my_account';
  exception when insufficient_privilege then raise notice 'ok: anon não executa delete_my_account';
  end;
end $$;
reset role;
\echo 'TODOS OS TESTES RLS PASSARAM'
