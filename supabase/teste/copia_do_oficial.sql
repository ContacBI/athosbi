-- ============================================================================
-- SÓ NO BANCO DE TESTE ("AthosBI Teste") — nunca no oficial.
--
-- Cópia automática do oficial para o teste (docs/AMBIENTES.md): duas vezes
-- por dia o robô do GitHub (.github/workflows/copia-oficial-para-teste.yml,
-- scripts/copiar-oficial-para-teste.mjs) lê as tabelas do oficial e manda
-- para `copia_lotes`; no fim, `aplicar_copia()` troca tudo DE UMA VEZ (uma
-- transação só — se der erro no meio, o teste fica como estava, nunca pela
-- metade). Só a chave de serviço (o robô) mexe nisso.
--
-- Trava de segurança: se o oficial vier com bem menos empresas do que o
-- teste tem hoje (menos de 80%), a cópia NÃO é aplicada — o teste continua
-- com a última cópia boa e o robô avisa o erro. Pra passar mesmo assim,
-- rodar o robô à mão com "forçar".
--
-- Pode rodar de novo sem erro; o robô avisa quando precisa da versão nova.
-- ============================================================================

-- A troca de tudo numa transação só leva minutos, e a API do Supabase dá 8 s
-- por pedido à chave de serviço. Só neste banco de teste.
alter role service_role set statement_timeout = '10min';
alter role service_role set lock_timeout = '2min';
notify pgrst, 'reload config';

create or replace function public.versao_da_copia()
returns integer language sql immutable as $$ select 2 $$;
grant execute on function public.versao_da_copia() to service_role;

create table if not exists public.copia_lotes (
  id bigint generated always as identity primary key,
  tabela text not null,
  linhas jsonb not null,
  criado_em timestamptz not null default now()
);
alter table public.copia_lotes enable row level security;
revoke all on public.copia_lotes from anon, authenticated;

create table if not exists public.copia_do_oficial (
  id bigint generated always as identity primary key,
  feita_em timestamptz not null default now(),
  forcada boolean not null default false,
  resumo jsonb not null default '{}'::jsonb
);
alter table public.copia_do_oficial enable row level security;
revoke all on public.copia_do_oficial from anon;
-- O selo do site de teste mostra de quando é a cópia.
drop policy if exists "copia_do_oficial_leitura" on public.copia_do_oficial;
create policy "copia_do_oficial_leitura" on public.copia_do_oficial for select to authenticated using (true);

-- Tabelas copiadas, na ordem de inserção (as "mães" antes das "filhas").
-- Fora da cópia: histórico de versões, uso do portal (Central) e
-- apresentações compartilhadas por link.
create or replace function public.tabelas_da_copia()
returns text[] language sql immutable as $$
  select array[
    'portal_admins', 'colaboradores', 'access_grants', 'acesso_pessoas',
    'app_storage',
    'dominio_sync', 'dominio_balancete', 'dominio_carga', 'dominio_fiscal', 'dominio_dfc_modelo', 'dominio_pedidos',
    'reforma_escritorio', 'reforma_parametros', 'reforma_empresas', 'reforma_acessos', 'reforma_simulacoes'
  ]::text[];
$$;

create or replace function public.aplicar_copia(forcar boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tabelas text[] := tabelas_da_copia();
  t text;
  n integer;
  empresas_antes integer;
  empresas_depois integer;
  resumo jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from copia_lotes where tabela = 'app_storage') then
    raise exception 'Cópia vazia: nada chegou do oficial — nada foi alterado.';
  end if;
  select count(*) into empresas_antes from app_storage where key like 'portalGerencial.company.%';
  select count(*) into empresas_depois
    from copia_lotes l, jsonb_array_elements(l.linhas) e
   where l.tabela = 'app_storage' and e->>'key' like 'portalGerencial.company.%';
  if not forcar and empresas_antes >= 5 and empresas_depois < empresas_antes * 0.8 then
    raise exception 'Trava de segurança: o oficial veio com % empresas e o teste tem % — a cópia não foi aplicada (o teste continua com a última cópia boa).', empresas_depois, empresas_antes;
  end if;

  foreach t in array tabelas loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;
  -- truncate (e não delete): libera o espaço na hora — o banco de teste é o
  -- plano grátis, de 500 MB — e a API do Supabase barra delete sem where.
  -- Dentro da transação: se der erro adiante, volta tudo.
  execute (select 'truncate table ' || string_agg(format('public.%I', nome), ', ') from unnest(tabelas) nome);
  foreach t in array tabelas loop
    execute format('insert into public.%I select r.* from public.copia_lotes l, jsonb_populate_recordset(null::public.%I, l.linhas) r where l.tabela = %L', t, t, t);
    get diagnostics n = row_count;
    resumo := resumo || jsonb_build_object(t, n);
  end loop;
  foreach t in array tabelas loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  truncate table copia_lotes;
  insert into copia_do_oficial (forcada, resumo) values (forcar, resumo);
  return resumo;
end;
$$;
revoke all on function public.aplicar_copia(boolean) from public, anon, authenticated;
-- O robô usa a chave de serviço (papel service_role).
grant execute on function public.aplicar_copia(boolean) to service_role;
