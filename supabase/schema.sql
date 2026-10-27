-- BIperformance — schema do banco (Supabase / Postgres)
--
-- Como aplicar: abra seu projeto em supabase.com > SQL Editor > New query,
-- cole este arquivo inteiro e clique em Run. É seguro rodar de novo (usa
-- "if not exists" / "or replace" em tudo).
--
-- O app hoje guarda cada "gaveta" de dado (empresas, plano gerencial,
-- indicadores, grupos, representantes) como um blob JSON — era assim já no
-- IndexedDB do navegador, então a tabela abaixo só muda ONDE esse blob mora,
-- não o formato. Isso mantém a migração de baixo risco: o código que lê e
-- escreve esses dados (lib/companies.js, planoStore.js, indicators.js,
-- groups.js, representantes.js) não precisa saber que trocou de banco.

create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_storage enable row level security;

-- Bucket pra anexos "outro" dos Relatórios mensais (lib/companies.js
-- attachMonthlyReport) — o único dado do app que é um arquivo binário de
-- verdade em vez de JSON, então não cabe na tabela acima. Privado: só
-- quem estiver logado consegue subir/baixar.
insert into storage.buckets (id, name, public)
values ('monthly-reports', 'monthly-reports', false)
on conflict (id) do nothing;

-- ============================================================================
-- Controle de acessos (ago/2026) — dono da conta vê e edita tudo; qualquer
-- outro e-mail cadastrado só ENXERGA (nunca edita) as empresas/grupos que o
-- dono liberar explicitamente na tela Parâmetros > Acessos. Antes disso,
-- qualquer login autenticado tinha leitura E escrita totais em app_storage —
-- as políticas "_authenticated" acima ficavam abertas de propósito porque só
-- o dono tinha conta. Agora que outras pessoas vão logar, isso trocou pelas
-- políticas com escopo abaixo.
-- ============================================================================

create extension if not exists pgcrypto;

-- Quem é dono/administrador (acesso total, inclusive editar) — cadastre o(s)
-- seu(s) e-mail(s) aqui. Adicionar/remover outro admin é uma ação sensível
-- de mais pra deixar numa tela do app; faça direto aqui no SQL Editor:
--   insert into portal_admins (email) values ('outraconta@dominio.com');
create table if not exists portal_admins (
  email text primary key
);
insert into portal_admins (email)
values ('contac@gmail.com'), ('izaiascontac@gmail.com')
on conflict (email) do nothing;

-- Quem tem acesso (somente leitura) a quê. scope_type='company' aponta pro id
-- de uma empresa (portalGerencial.company.<id>); scope_type='group' aponta
-- pro id de um grupo e libera automaticamente TODAS as empresas que hoje são
-- (ou vierem a ser) membro dele — ver allowed_company_ids() abaixo, que
-- resolve isso lendo a lista de grupos na hora, não uma cópia congelada.
create table if not exists access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  scope_type text not null check (scope_type in ('company', 'group')),
  scope_id text not null,
  created_at timestamptz not null default now(),
  unique (email, scope_type, scope_id)
);

alter table portal_admins enable row level security;
alter table access_grants enable row level security;

-- security definer: a política de app_storage chama essas funções pra
-- decidir o que liberar, então elas mesmas precisam poder ler
-- portal_admins/access_grants/app_storage por baixo da RLS, senão vira
-- referência circular (a política depende da função, a função esbarra na
-- própria política pra se resolver).
create or replace function is_portal_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from portal_admins where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

create or replace function allowed_company_ids()
returns text[]
language sql stable security definer set search_path = public as $$
  select array(
    select scope_id from access_grants
      where email = lower(coalesce(auth.jwt()->>'email', '')) and scope_type = 'company'
    union
    select comp_id from app_storage grp_row,
      jsonb_array_elements(grp_row.value) as g,
      jsonb_array_elements_text(coalesce(g->'companyIds', '[]'::jsonb)) as comp_id
      where grp_row.key = 'portalGerencial.groups.v1'
        and (g->>'id') in (
          select scope_id from access_grants
            where email = lower(coalesce(auth.jwt()->>'email', '')) and scope_type = 'group'
        )
  );
$$;

-- ============================================================================
-- Colaboradores internos (ago/2026) — dois níveis, além do dono (Total é na
-- prática só um apelido pra portal_admins, já existente):
--   Total    — mesma coisa que já era: acesso e edição de tudo, sem crivo
--              nenhum. contac@gmail.com e izaiascontac@gmail.com já estão
--              seedados ali em cima; a tela Parâmetros > Colaborar deixa
--              adicionar mais.
--   Restrito — enxerga a carteira INTEIRA (como um Total, só que sem poder
--              editar por padrão) e só consegue de fato criar/editar/apagar
--              o registro/razão das empresas onde está listado como
--              responsável (campo `responsaveis` dentro do próprio registro
--              da empresa — não é tabela separada). Nunca vê Sistema,
--              Colaborar ou B.I., mesmo enxergando o resto de Parâmetros.
-- ============================================================================

alter table portal_admins add column if not exists nome text;
-- portal_admins é de antes de existir tela de Colaborar — nunca teve
-- created_at (só email, depois nome). ColaborarAdmin.jsx ordena a lista
-- por essa coluna, igual já fazia com colaboradores; sem ela, a consulta
-- falhava com "column portal_admins.created_at does not exist" (42703) e
-- a tela ficava sempre vazia, mesmo com o cadastro em si funcionando.
alter table portal_admins add column if not exists created_at timestamptz not null default now();

create table if not exists colaboradores (
  email text primary key,
  nome text,
  created_at timestamptz not null default now()
);
alter table colaboradores enable row level security;

-- Definida ANTES das políticas de `colaboradores` de propósito — a nova
-- policy de leitura logo abaixo chama essa função, e `create policy`
-- valida que ela já existe no momento da criação (senão dá "function
-- is_colaborador() does not exist" rodando o script do zero).
create or replace function is_colaborador()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from colaboradores where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

-- Mesma lógica do portal_admins acima: qualquer colaborador enxerga a
-- lista inteira de colaboradores (não só o próprio e-mail), pro seletor
-- de "Responsáveis" poder oferecer todo mundo, não só quem está logado.
drop policy if exists "colaboradores_self_read" on colaboradores;
drop policy if exists "colaboradores_colaborador_read" on colaboradores;
create policy "colaboradores_colaborador_read"
  on colaboradores for select
  to authenticated
  using (is_portal_admin() or is_colaborador());

drop policy if exists "colaboradores_admin_all" on colaboradores;
create policy "colaboradores_admin_all"
  on colaboradores for all
  to authenticated
  using (is_portal_admin())
  with check (is_portal_admin());

-- Lê o registro da PRÓPRIA empresa (security definer — não importa se quem
-- chama teria permissão de ver essa linha ou não) e confere se o e-mail de
-- quem está logado está no array `responsaveis` dela. NULL (empresa antiga,
-- campo nem existe ainda) vira `false` — sem responsável definido, ninguém
-- Restrito edita, só o dono.
create or replace function is_responsavel(company_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select (value->'responsaveis') ? lower(coalesce(auth.jwt()->>'email', ''))
      from app_storage
      where key = 'portalGerencial.company.' || company_id
    ),
    false
  );
$$;

drop policy if exists "app_storage_select_authenticated" on app_storage;
drop policy if exists "app_storage_select_scoped" on app_storage;
create policy "app_storage_select_scoped"
  on app_storage for select
  to authenticated
  using (
    is_portal_admin()
    -- Restrito enxerga a carteira inteira igual o dono — só a ESCRITA que
    -- fica limitada mais abaixo.
    or is_colaborador()
    -- Gavetas que não são o razão/registro de uma empresa específica (lista
    -- de grupos, plano gerencial, representantes, indicadores...) continuam
    -- visíveis pra qualquer e-mail com acesso a ALGUMA empresa — são dados
    -- de referência compartilhados, não o financeiro de ninguém. A única
    -- ressalva conhecida: a lista de grupos traz nome de TODOS os grupos
    -- (mesmo os que a pessoa não tem acesso), não só os números. Ver
    -- conversa/README se algum dia isso precisar ficar mais estrito.
    or (
      key not like 'portalGerencial.company.%'
      and key not like 'portalGerencial.companyJournal.%'
    )
    or (
      (key like 'portalGerencial.company.%' or key like 'portalGerencial.companyJournal.%')
      and split_part(key, '.', 3) = any (allowed_company_ids())
    )
  );

-- Se o colaborador é responsável por QUALQUER empresa — usado como o
-- crivo de confiança de plano padrão/representantes (gavetas de linha
-- única, não dá pra travar por item individual dentro do array; ver
-- comentário grande abaixo).
create or replace function has_any_responsibility()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_storage
    where key like 'portalGerencial.company.%'
      and (value->'responsaveis') ? lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

-- Escrita (insert/update) — regras por gaveta, pedidas explicitamente:
--   • Empresa NOVA: qualquer colaborador pode criar (o registro ainda nem
--     existe, não tem responsável nenhum pra checar ainda — só depois de
--     criada, com os responsáveis já escolhidos no formulário, que o
--     UPDATE seguinte fica restrito a quem estiver nessa lista).
--   • Razão de uma empresa (o UPDATE do cadastro dela, De/Para, imports):
--     só quem está em `responsaveis` DAQUELA empresa.
--   • Grupo: qualquer colaborador, sem crivo — não existe "responsável de
--     grupo".
--   • Biblioteca do escritório (pedidos salvos do assistente e slides
--     prontos, lib/officeLibrary.js): qualquer colaborador — não tem dado
--     financeiro de empresa nenhuma.
--   • Plano padrão / Representantes: só quem é responsável por ALGUMA
--     empresa (has_any_responsibility) — essas duas gavetas guardam TUDO
--     numa linha só (um array), não dá pra travar por item individual
--     dentro dela como dá com empresa/razão (linhas separadas por id).
-- Acessos (access_grants) tem regra própria mais abaixo — é uma tabela de
-- verdade (uma linha por concessão), dá pra escopar por empresa/grupo.
drop policy if exists "app_storage_insert_authenticated" on app_storage;
drop policy if exists "app_storage_insert_admin_only" on app_storage;
drop policy if exists "app_storage_insert_scoped" on app_storage;
create policy "app_storage_insert_scoped"
  on app_storage for insert
  to authenticated
  with check (
    is_portal_admin()
    or (
      is_colaborador()
      and (
        key like 'portalGerencial.company.%'
        or (key like 'portalGerencial.companyJournal.%' and is_responsavel(split_part(key, '.', 3)))
        or key = 'portalGerencial.groups.v1'
        or key in ('portalGerencial.assistantFavorites.v1', 'portalGerencial.slideLibrary.v1')
        or (key in ('portalGerencial.planosPadrao.v1', 'portalGerencial.representantes.v1') and has_any_responsibility())
      )
    )
  );

drop policy if exists "app_storage_update_authenticated" on app_storage;
drop policy if exists "app_storage_update_admin_only" on app_storage;
drop policy if exists "app_storage_update_scoped" on app_storage;
create policy "app_storage_update_scoped"
  on app_storage for update
  to authenticated
  using (
    is_portal_admin()
    or (
      is_colaborador()
      and (
        (key like 'portalGerencial.company.%' and is_responsavel(split_part(key, '.', 3)))
        or (key like 'portalGerencial.companyJournal.%' and is_responsavel(split_part(key, '.', 3)))
        or key = 'portalGerencial.groups.v1'
        or key in ('portalGerencial.assistantFavorites.v1', 'portalGerencial.slideLibrary.v1')
        or (key in ('portalGerencial.planosPadrao.v1', 'portalGerencial.representantes.v1') and has_any_responsibility())
      )
    )
  )
  with check (
    is_portal_admin()
    or (
      is_colaborador()
      and (
        (key like 'portalGerencial.company.%' and is_responsavel(split_part(key, '.', 3)))
        or (key like 'portalGerencial.companyJournal.%' and is_responsavel(split_part(key, '.', 3)))
        or key = 'portalGerencial.groups.v1'
        or key in ('portalGerencial.assistantFavorites.v1', 'portalGerencial.slideLibrary.v1')
        or (key in ('portalGerencial.planosPadrao.v1', 'portalGerencial.representantes.v1') and has_any_responsibility())
      )
    )
  );

-- Apagar continua só do dono — excluir empresa/razão é destrutivo demais
-- pra delegar pra um colaborador Restrito.
drop policy if exists "app_storage_delete_authenticated" on app_storage;
drop policy if exists "app_storage_delete_admin_only" on app_storage;
create policy "app_storage_delete_admin_only"
  on app_storage for delete
  to authenticated
  using (is_portal_admin());

-- portal_admins: qualquer colaborador (Total ou Restrito) enxerga a lista
-- inteira — precisa pra escolher "Responsáveis" no cadastro da empresa
-- (CompanyModal.jsx/ResponsaveisAdmin.jsx), que tem que oferecer TODO
-- mundo cadastrado, não só quem já está logado. Antes só dava pra ver o
-- próprio e-mail, e um Restrito só via a si mesmo na lista de responsável
-- possível — a troca pra outra pessoa ficava impossível. Só um admin
-- ainda cria/edita/apaga a tabela em si (ver policy abaixo).
drop policy if exists "portal_admins_self_read" on portal_admins;
drop policy if exists "portal_admins_colaborador_read" on portal_admins;
create policy "portal_admins_colaborador_read"
  on portal_admins for select
  to authenticated
  using (is_portal_admin() or is_colaborador());

drop policy if exists "portal_admins_admin_all" on portal_admins;
create policy "portal_admins_admin_all"
  on portal_admins for all
  to authenticated
  using (is_portal_admin())
  with check (is_portal_admin());

-- access_grants: qualquer logado pode ver os PRÓPRIOS acessos liberados
-- (não os de outra pessoa); só um admin cria/edita/apaga concessões.
drop policy if exists "access_grants_self_read" on access_grants;
create policy "access_grants_self_read"
  on access_grants for select
  to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "access_grants_admin_all" on access_grants;
create policy "access_grants_admin_all"
  on access_grants for all
  to authenticated
  using (is_portal_admin())
  with check (is_portal_admin());

-- Se o colaborador é responsável por PELO MENOS UMA das empresas de um
-- grupo — usado só pra liberar/revogar acesso de cliente (access_grants)
-- num grupo inteiro; não precisa ser responsável por todas.
create or replace function is_responsavel_for_group(target_group_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    bool_or((value->'responsaveis') ? lower(coalesce(auth.jwt()->>'email', ''))),
    false
  )
  from app_storage
  where key like 'portalGerencial.company.%'
    and split_part(key, '.', 3) in (
      select jsonb_array_elements_text(coalesce(g->'companyIds', '[]'::jsonb))
      from app_storage grp, jsonb_array_elements(grp.value) as g
      where grp.key = 'portalGerencial.groups.v1' and g->>'id' = target_group_id
    );
$$;

-- Colaborador pode liberar/revogar acesso de CLIENTE externo, mas só nas
-- empresas/grupos onde ele mesmo é responsável — pedido explícito: "os
-- responsáveis podem modificar isso, mas somente as suas empresas".
drop policy if exists "access_grants_colaborador_scoped" on access_grants;
create policy "access_grants_colaborador_scoped"
  on access_grants for all
  to authenticated
  using (
    is_colaborador()
    and (
      (scope_type = 'company' and is_responsavel(scope_id))
      or (scope_type = 'group' and is_responsavel_for_group(scope_id))
    )
  )
  with check (
    is_colaborador()
    and (
      (scope_type = 'company' and is_responsavel(scope_id))
      or (scope_type = 'group' and is_responsavel_for_group(scope_id))
    )
  );

-- Bucket de anexos: qualquer logado ainda pode BAIXAR (é preciso saber o
-- caminho exato do arquivo pra isso, e a UI só mostra o link pra quem tem
-- acesso à empresa); só admin pode subir/trocar/apagar anexo.
drop policy if exists "monthly_reports_all_authenticated" on storage.objects;
drop policy if exists "monthly_reports_read_authenticated" on storage.objects;
create policy "monthly_reports_read_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'monthly-reports');

drop policy if exists "monthly_reports_write_admin_only" on storage.objects;
create policy "monthly_reports_write_admin_only"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'monthly-reports' and is_portal_admin());

drop policy if exists "monthly_reports_update_admin_only" on storage.objects;
create policy "monthly_reports_update_admin_only"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'monthly-reports' and is_portal_admin())
  with check (bucket_id = 'monthly-reports' and is_portal_admin());

drop policy if exists "monthly_reports_delete_admin_only" on storage.objects;
create policy "monthly_reports_delete_admin_only"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'monthly-reports' and is_portal_admin());

-- Depois de rodar isso, crie seu próprio login (se ainda não tiver) em:
-- Authentication > Users > Add user (email + senha). Qualquer outra pessoa
-- entra por convite: Parâmetros > Acessos, no app, dispara um e-mail (via
-- supabase/functions/invite-user) com um link pra ela criar a senha —
-- ninguém mais se auto-cadastra pela tela de login.

-- ============================================================================
-- Integração com a Domínio sem arquivo (out/2026) — a Central (app no
-- computador do escritório, com acesso ao banco da Domínio) lê os
-- lançamentos e manda pra Edge Function dominio-sync
-- (supabase/functions/dominio-sync), que grava aqui. É uma ÁREA DE ESPERA:
-- nada entra no razão sozinho — a tela Dados do portal mostra o que chegou
-- e aplica por clique ("Atualizar com a Domínio", ver src/lib/dominioSync.js).
-- Um mês grande chega em várias partes (até 5000 linhas cada) de um mesmo
-- `lote`; o portal só considera lote completo, e a Edge Function apaga os
-- lotes anteriores do mês assim que um novo completa.
-- ============================================================================
create table if not exists public.dominio_sync (
  company_codigo text not null,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  lote text not null,
  parte integer not null check (parte >= 1),
  partes integer not null check (partes >= 1 and partes <= 1000),
  lancamentos jsonb not null,
  qtd integer not null,
  total_debito numeric(18, 2) not null default 0,
  total_credito numeric(18, 2) not null default 0,
  synced_at timestamptz not null default now(),
  primary key (company_codigo, competencia, lote, parte),
  check (parte <= partes)
);

-- CNPJ (só dígitos) da empresa NA DOMÍNIO, mandado pela Central. O código
-- sozinho é ambíguo ("001" e "01" no portal viram o mesmo "1"): o portal só
-- mostra um mês pra empresa com o mesmo CNPJ, e a Edge Function recusa um
-- envio cujo código+CNPJ não bate com nenhuma empresa do portal.
alter table public.dominio_sync add column if not exists cnpj text;

-- Assinatura do conteúdo de cada parte (soma de hashes de cada linha,
-- calculada pela Edge Function). O portal soma as partes e compara com a
-- mesma assinatura do razão: qualquer mudança — lançamento novo, valor,
-- reclassificação de conta, histórico editado — deixa o mês "pendente".
alter table public.dominio_sync add column if not exists assinatura text;

alter table public.dominio_sync enable row level security;

-- Leitura: só admin e colaboradores (quem aplica no razão). Sem política de
-- escrita de propósito: só a Edge Function (service role) grava.
drop policy if exists "dominio_sync_read_staff" on public.dominio_sync;
create policy "dominio_sync_read_staff"
  on public.dominio_sync for select
  to authenticated
  using (is_portal_admin() or is_colaborador());

-- Balancete direto da Domínio — mesma área de espera, mesma Central, mesma
-- Edge Function (POST com "tipo": "balancete"). Um balancete por empresa
-- (o lote completo mais recente; a Edge Function apaga os anteriores):
-- período `inicio`..`fim` e, em `contas`, as contas com saldo ou movimento
-- (sintéticas e analíticas), cada uma com saldo anterior, débitos, créditos
-- e saldo atual — o mesmo que o balancete exportado da Domínio. O portal
-- compara com o balancete atual da empresa, aplica por clique (trocando o
-- De/Para de conta renumerada pelo código reduzido) e confere saldo inicial
-- + lançamentos = saldo final.
create table if not exists public.dominio_balancete (
  company_codigo text not null,
  cnpj text not null,
  lote text not null,
  parte integer not null check (parte >= 1),
  partes integer not null check (partes >= 1 and partes <= 100),
  inicio date not null,
  fim date not null,
  contas jsonb not null,
  qtd integer not null,
  synced_at timestamptz not null default now(),
  primary key (company_codigo, lote, parte),
  check (parte <= partes),
  check (inicio <= fim)
);

alter table public.dominio_balancete enable row level security;

-- Mesmo acesso de dominio_sync: leitura só admin e colaboradores; escrita só
-- pela Edge Function (service role).
drop policy if exists "dominio_balancete_read_staff" on public.dominio_balancete;
create policy "dominio_balancete_read_staff"
  on public.dominio_balancete for select
  to authenticated
  using (is_portal_admin() or is_colaborador());

-- Pedido de período à Central: a tela Dados pede "traga da Domínio os
-- lançamentos de jan/2025 a dez/2025" (meses que a Central não manda nas
-- rodadas normais) e a Central, que consulta o GET da dominio-sync a cada
-- poucos minutos, pega o pedido, manda os meses pelo caminho de sempre
-- (área de espera, aplica por clique) e marca feito/erro pela Edge Function.
-- Só lançamentos — o balancete continua o da rodada normal. Um pedido aberto
-- por empresa de cada vez (índice abaixo); até 36 meses por pedido.
create table if not exists public.dominio_pedidos (
  id uuid primary key default gen_random_uuid(),
  company_codigo text not null check (company_codigo ~ '^[0-9]{1,10}$'),
  cnpj text not null check (cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  inicio text not null check (inicio ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  fim text not null check (fim ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'pendente' check (status in ('pendente', 'andamento', 'feito', 'erro')),
  meses integer,
  mensagem text,
  pedido_por text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inicio <= fim),
  check ((left(fim, 4)::int * 12 + right(fim, 2)::int) - (left(inicio, 4)::int * 12 + right(inicio, 2)::int) < 36)
);

create unique index if not exists dominio_pedidos_um_aberto
  on public.dominio_pedidos (company_codigo, cnpj)
  where status in ('pendente', 'andamento');

alter table public.dominio_pedidos enable row level security;

-- Quem lê a área de espera (admin e colaboradores) pede e acompanha; só a
-- Edge Function (service role) muda o status. Cancelar = apagar o pedido
-- ainda pendente, ou um "andamento" parado há mais de 15 minutos.
drop policy if exists "dominio_pedidos_read_staff" on public.dominio_pedidos;
create policy "dominio_pedidos_read_staff"
  on public.dominio_pedidos for select
  to authenticated
  using (is_portal_admin() or is_colaborador());

drop policy if exists "dominio_pedidos_insert_staff" on public.dominio_pedidos;
create policy "dominio_pedidos_insert_staff"
  on public.dominio_pedidos for insert
  to authenticated
  with check (
    (is_portal_admin() or is_colaborador())
    and status = 'pendente' and meses is null and mensagem is null
    and pedido_por is not distinct from (auth.jwt() ->> 'email')
  );

drop policy if exists "dominio_pedidos_cancel_staff" on public.dominio_pedidos;
create policy "dominio_pedidos_cancel_staff"
  on public.dominio_pedidos for delete
  to authenticated
  using (
    (is_portal_admin() or is_colaborador())
    and (status = 'pendente' or (status = 'andamento' and updated_at < now() - interval '15 minutes'))
  );

-- ============================================================================
-- Acesso de clientes externos + módulo Reforma Tributária (out/2026)
-- ============================================================================

-- Gavetas compartilhadas: cliente (quem não é admin nem colaborador) só lê
-- o que o B.I. dele precisa pra montar os relatórios. Fica de fora o que é
-- interno: a gaveta antiga companies.v2 (cadastro + balancetes de várias
-- empresas, só usada na migração de formato), representantes (CPFs) e o
-- backup do plano. Gaveta nova também nasce fechada até entrar nesta lista.
alter policy "app_storage_select_scoped" on app_storage
  using (
    is_portal_admin()
    or is_colaborador()
    or key in (
      'portalGerencial.groups.v1',
      'portalGerencial.planoSnapshot.v1',
      'portalGerencial.planoOverrides.v1',
      'portalGerencial.planosPadrao.v1',
      'portalGerencial.indicatorOverrides.v1'
    )
    or (
      (key like 'portalGerencial.company.%' or key like 'portalGerencial.companyJournal.%')
      and split_part(key, '.', 3) = any (allowed_company_ids())
    )
  );

-- Anexos (relatórios mensais em PDF): o caminho começa pelo id da empresa
-- (`<empresa>/<mês>/<arquivo>`, ver companies.js). Antes qualquer logado
-- baixava de qualquer empresa sabendo o caminho.
alter policy "monthly_reports_read_authenticated" on storage.objects
  using (
    bucket_id = 'monthly-reports'
    and (is_portal_admin() or is_colaborador() or split_part(name, '/', 1) = any (allowed_company_ids()))
  );

-- Limpeza de uma primeira versão (nunca usada) em que a Reforma era um
-- "módulo" marcado na concessão do B.I. — a Reforma agora tem cadastro e
-- acessos próprios (abaixo), e access_grants volta a ser só do B.I.
alter table access_grants drop constraint if exists access_grants_modulos_validos;
alter table access_grants drop column if exists modulos;
drop function if exists allowed_company_ids_for(text);

-- ── Reforma Tributária ──────────────────────────────────────────────────────
-- Módulo à parte do B.I.: o escritório cadastra a empresa DENTRO da Reforma
-- (reforma_empresas — não é a carteira do B.I.), configura caso a caso
-- (regime, Simples, produtos e compras de partida) e libera o dono por
-- e-mail (reforma_acessos). O dono entra direto na empresa dele, com a
-- configuração do escritório, e faz as simulações.

-- Quem do ESCRITÓRIO trabalha na Reforma (cadastra/configura empresas,
-- libera clientes, vê todas as simulações, mexe nos parâmetros). É à parte
-- de portal_admins de propósito: nem todo admin/colaborador vê. Quem já está
-- aqui liga/desliga os outros em Parâmetros > Colaborar (chave "Reforma
-- Tributária" em cada pessoa); quem não está nem vê a chave.
create table if not exists reforma_escritorio (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table reforma_escritorio enable row level security;
insert into reforma_escritorio (email) values ('izaiascontac@gmail.com') on conflict (email) do nothing;

create or replace function is_reforma_escritorio()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reforma_escritorio where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

drop policy if exists "reforma_escritorio_gestao" on reforma_escritorio;
create policy "reforma_escritorio_gestao" on reforma_escritorio for all to authenticated
  using (is_reforma_escritorio()) with check (is_reforma_escritorio());

-- Empresas da Reforma. `config` = configuração do escritório, no mesmo
-- formato de reforma_simulacoes.dados (toda simulação nova começa dela);
-- `bi_company_id` = empresa do B.I. ligada (opcional, só pra trazer os
-- números da contabilidade); `orientacao` = recado que o cliente vê.
create table if not exists reforma_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 160),
  cnpj text,
  bi_company_id text,
  config jsonb not null default '{}'::jsonb,
  orientacao text check (orientacao is null or length(orientacao) <= 4000),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table reforma_empresas enable row level security;

-- Quem do cliente entra em cada empresa (convidado por e-mail).
create table if not exists reforma_acessos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references reforma_empresas (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  created_by text,
  created_at timestamptz not null default now(),
  unique (empresa_id, email)
);
create index if not exists reforma_acessos_email_idx on reforma_acessos (email);
alter table reforma_acessos enable row level security;

create or replace function reforma_empresa_ids()
returns uuid[]
language sql stable security definer set search_path = public as $$
  select array(
    select empresa_id from reforma_acessos where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

-- Escritório faz tudo; cliente só LÊ a(s) empresa(s) dele — a configuração
-- é do escritório.
drop policy if exists "reforma_empresas_escritorio" on reforma_empresas;
create policy "reforma_empresas_escritorio" on reforma_empresas for all to authenticated
  using (is_reforma_escritorio()) with check (is_reforma_escritorio());
drop policy if exists "reforma_empresas_cliente_leitura" on reforma_empresas;
create policy "reforma_empresas_cliente_leitura" on reforma_empresas for select to authenticated
  using (id = any (reforma_empresa_ids()));

drop policy if exists "reforma_acessos_escritorio" on reforma_acessos;
create policy "reforma_acessos_escritorio" on reforma_acessos for all to authenticated
  using (is_reforma_escritorio()) with check (is_reforma_escritorio());
drop policy if exists "reforma_acessos_proprio_leitura" on reforma_acessos;
create policy "reforma_acessos_proprio_leitura" on reforma_acessos for select to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')));

-- Autor e data carimbados pelo banco (não dá pra forjar pelo navegador).
create or replace function reforma_empresas_carimbo()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := lower(coalesce(auth.jwt()->>'email', ''));
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := new.updated_by;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
drop trigger if exists reforma_empresas_carimbo on reforma_empresas;
create trigger reforma_empresas_carimbo before insert or update on reforma_empresas
  for each row execute function reforma_empresas_carimbo();

create or replace function reforma_acessos_carimbo()
returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := lower(coalesce(auth.jwt()->>'email', ''));
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.empresa_id := old.empresa_id;
  end if;
  return new;
end;
$$;
drop trigger if exists reforma_acessos_carimbo on reforma_acessos;
create trigger reforma_acessos_carimbo before insert or update on reforma_acessos
  for each row execute function reforma_acessos_carimbo();

-- Parâmetros da simulação (alíquotas de referência, transição, tabelas do
-- Simples) — uma linha só. Todo logado lê (o cliente precisa pra calcular);
-- só o escritório da Reforma altera. Sem linha = valores padrão do código
-- (src/lib/reforma/parametros.js).
create table if not exists reforma_parametros (
  id integer primary key default 1 check (id = 1),
  dados jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table reforma_parametros enable row level security;
drop policy if exists "reforma_parametros_read" on reforma_parametros;
create policy "reforma_parametros_read" on reforma_parametros for select to authenticated using (true);
drop policy if exists "reforma_parametros_write" on reforma_parametros;
create policy "reforma_parametros_write" on reforma_parametros for all to authenticated
  using (is_reforma_escritorio()) with check (is_reforma_escritorio());

-- Simulações, uma linha por simulação, sempre de uma empresa da Reforma.
-- `dados` = regime, itens de venda e de compra; `resumo` = números
-- principais já calculados, pro painel do escritório.
create table if not exists reforma_simulacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references reforma_empresas (id) on delete cascade,
  nome text not null check (length(nome) between 1 and 120),
  dados jsonb not null default '{}'::jsonb,
  resumo jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reforma_simulacoes_empresa_idx on reforma_simulacoes (empresa_id);
alter table reforma_simulacoes enable row level security;

-- Escritório da Reforma: tudo. Cliente: vê todas as simulações da empresa
-- dele (inclusive os estudos do escritório), cria as dele e só altera/
-- exclui as que ele mesmo criou. Admin/colaborador comum NÃO enxerga nada.
drop policy if exists "reforma_simulacoes_escritorio" on reforma_simulacoes;
create policy "reforma_simulacoes_escritorio" on reforma_simulacoes for all to authenticated
  using (is_reforma_escritorio()) with check (is_reforma_escritorio());
drop policy if exists "reforma_simulacoes_cliente_leitura" on reforma_simulacoes;
create policy "reforma_simulacoes_cliente_leitura" on reforma_simulacoes for select to authenticated
  using (empresa_id = any (reforma_empresa_ids()));
drop policy if exists "reforma_simulacoes_cliente_criacao" on reforma_simulacoes;
create policy "reforma_simulacoes_cliente_criacao" on reforma_simulacoes for insert to authenticated
  with check (empresa_id = any (reforma_empresa_ids()));
drop policy if exists "reforma_simulacoes_cliente_edicao" on reforma_simulacoes;
create policy "reforma_simulacoes_cliente_edicao" on reforma_simulacoes for update to authenticated
  using (empresa_id = any (reforma_empresa_ids()) and created_by = lower(coalesce(auth.jwt()->>'email', '')))
  with check (empresa_id = any (reforma_empresa_ids()));
drop policy if exists "reforma_simulacoes_cliente_exclusao" on reforma_simulacoes;
create policy "reforma_simulacoes_cliente_exclusao" on reforma_simulacoes for delete to authenticated
  using (empresa_id = any (reforma_empresa_ids()) and created_by = lower(coalesce(auth.jwt()->>'email', '')));

-- Autor e data carimbados pelo banco; a empresa de uma simulação não muda.
create or replace function reforma_simulacoes_carimbo()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := lower(coalesce(auth.jwt()->>'email', ''));
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := new.updated_by;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.empresa_id := old.empresa_id;
  end if;
  return new;
end;
$$;
drop trigger if exists reforma_simulacoes_carimbo on reforma_simulacoes;
create trigger reforma_simulacoes_carimbo before insert or update on reforma_simulacoes
  for each row execute function reforma_simulacoes_carimbo();

-- Resumo das notas fiscais (Escrita Fiscal da Domínio) pra simulação da
-- Reforma por NCM — mandado pela Central (dominio-sync, POST "tipo":
-- "fiscal") pra cada empresa da Reforma com CNPJ. Um resumo por CNPJ (o
-- novo substitui o anterior): vendas por NCM/código de serviço e compras
-- por tipo (e por NCM nas mercadorias/insumos), do período `inicio`..`fim`.
-- Só o escritório da Reforma lê (é ele quem configura as empresas); só a
-- Edge Function (service role) grava.
create table if not exists public.dominio_fiscal (
  cnpj text primary key check (cnpj ~ '^[0-9]{14}$'),
  empresas text[] not null,
  inicio date not null,
  fim date not null,
  meses integer not null check (meses between 1 and 24),
  vendas jsonb not null,
  compras jsonb not null,
  total_vendas numeric(18, 2) not null default 0,
  total_compras numeric(18, 2) not null default 0,
  synced_at timestamptz not null default now(),
  check (inicio <= fim)
);
alter table public.dominio_fiscal enable row level security;
drop policy if exists "dominio_fiscal_read_reforma" on public.dominio_fiscal;
create policy "dominio_fiscal_read_reforma" on public.dominio_fiscal for select to authenticated
  using (is_reforma_escritorio());

-- ---------------------------------------------------------------------------
-- Apresentação compartilhada por link (Apresentações → Compartilhar por
-- link, ver src/lib/sharing.js e src/pages/SharedPresentation.jsx): uma
-- "foto" dos slides (imagens JPEG) no momento em que o link foi criado ou
-- atualizado. Quem abre não precisa de login e só recebe as imagens, pela
-- função open_shared_presentation (validade, revogação, senha em bcrypt e
-- registro de cada abertura). O escritório cria, lista, atualiza e revoga.
create table if not exists public.shared_presentations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (length(token) >= 20),
  workspace_kind text not null check (workspace_kind in ('company', 'group')),
  workspace_id text not null,
  workspace_name text not null default '',
  deck_id text not null,
  title text not null default '',
  period_label text not null default '',
  slides jsonb not null default '[]'::jsonb,
  slide_count integer not null default 0,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_presentations_deck_idx on public.shared_presentations (workspace_id, deck_id);

create table if not exists public.shared_presentation_views (
  id bigint generated always as identity primary key,
  share_id uuid not null references public.shared_presentations(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  outcome text not null default 'aberto' check (outcome in ('aberto', 'senha_errada')),
  device text not null default ''
);
create index if not exists shared_presentation_views_share_idx on public.shared_presentation_views (share_id, viewed_at desc);

alter table public.shared_presentations enable row level security;
alter table public.shared_presentation_views enable row level security;
revoke all on public.shared_presentations from anon;
revoke all on public.shared_presentation_views from anon;

drop policy if exists "shared_presentations_staff_select" on public.shared_presentations;
create policy "shared_presentations_staff_select" on public.shared_presentations
  for select to authenticated using (is_portal_admin() or is_colaborador());
drop policy if exists "shared_presentations_staff_insert" on public.shared_presentations;
create policy "shared_presentations_staff_insert" on public.shared_presentations
  for insert to authenticated with check (is_portal_admin() or is_colaborador());
drop policy if exists "shared_presentations_staff_update" on public.shared_presentations;
create policy "shared_presentations_staff_update" on public.shared_presentations
  for update to authenticated using (is_portal_admin() or is_colaborador()) with check (is_portal_admin() or is_colaborador());
drop policy if exists "shared_presentations_admin_delete" on public.shared_presentations;
create policy "shared_presentations_admin_delete" on public.shared_presentations
  for delete to authenticated using (is_portal_admin());
drop policy if exists "shared_presentation_views_staff_select" on public.shared_presentation_views;
create policy "shared_presentation_views_staff_select" on public.shared_presentation_views
  for select to authenticated using (is_portal_admin() or is_colaborador());

create or replace function public.set_shared_presentation_password(p_share_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not (is_portal_admin() or is_colaborador()) then
    raise exception 'sem permissão';
  end if;
  update public.shared_presentations
     set password_hash = case when coalesce(p_password, '') = '' then null else extensions.crypt(p_password, extensions.gen_salt('bf', 8)) end,
         updated_at = now()
   where id = p_share_id;
end;
$$;

create or replace function public.open_shared_presentation(p_token text, p_password text default null, p_device text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.shared_presentations%rowtype;
  recent_fails integer;
begin
  select * into s from public.shared_presentations where token = p_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if s.revoked_at is not null then
    return jsonb_build_object('status', 'revoked', 'title', s.title);
  end if;
  if s.expires_at is not null and s.expires_at < now() then
    return jsonb_build_object('status', 'expired', 'title', s.title, 'expires_at', s.expires_at);
  end if;
  if s.password_hash is not null then
    select count(*) into recent_fails
      from public.shared_presentation_views
     where share_id = s.id and outcome = 'senha_errada' and viewed_at > now() - interval '15 minutes';
    if recent_fails >= 10 then
      return jsonb_build_object('status', 'locked', 'title', s.title);
    end if;
    if coalesce(p_password, '') = '' then
      return jsonb_build_object('status', 'password', 'title', s.title, 'workspace_name', s.workspace_name);
    end if;
    if extensions.crypt(p_password, s.password_hash) <> s.password_hash then
      insert into public.shared_presentation_views (share_id, outcome, device) values (s.id, 'senha_errada', left(coalesce(p_device, ''), 40));
      return jsonb_build_object('status', 'wrong_password', 'title', s.title, 'workspace_name', s.workspace_name);
    end if;
  end if;
  insert into public.shared_presentation_views (share_id, outcome, device) values (s.id, 'aberto', left(coalesce(p_device, ''), 40));
  return jsonb_build_object(
    'status', 'ok',
    'title', s.title,
    'workspace_name', s.workspace_name,
    'period_label', s.period_label,
    'slides', s.slides,
    'slide_count', s.slide_count,
    'expires_at', s.expires_at,
    'updated_at', s.updated_at
  );
end;
$$;

revoke all on function public.open_shared_presentation(text, text, text) from public;
grant execute on function public.open_shared_presentation(text, text, text) to anon, authenticated;
revoke all on function public.set_shared_presentation_password(uuid, text) from public;
grant execute on function public.set_shared_presentation_password(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Backup automático (Parâmetros → Sistema → Histórico de versões, ver
-- src/pages/parametros/HistoricoVersoes.jsx): antes de qualquer gaveta do
-- app_storage ser substituída ou apagada, a versão anterior vai para
-- app_storage_history — no máximo uma cópia a cada 10 minutos por gaveta
-- (exclusão e restauração sempre guardam). O razão fica de fora: vem da
-- Domínio/importação e já mantém a versão anterior no outro "slot" (ver
-- writeCompanyJournal em src/lib/persistence.js). Limpeza diária via
-- pg_cron: 60 dias, e as 5 versões mais recentes de cada gaveta ficam
-- sempre.
create table if not exists public.app_storage_history (
  id bigint generated always as identity primary key,
  key text not null,
  value jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by text not null default lower(coalesce(auth.jwt()->>'email', '')),
  motivo text not null default 'alteracao' check (motivo in ('alteracao', 'exclusao', 'restauracao'))
);
create index if not exists app_storage_history_key_idx on public.app_storage_history (key, saved_at desc);

alter table public.app_storage_history enable row level security;
revoke all on public.app_storage_history from anon;
revoke insert, update, delete, truncate, references, trigger on public.app_storage_history from authenticated;
drop policy if exists "app_storage_history_admin_select" on public.app_storage_history;
create policy "app_storage_history_admin_select" on public.app_storage_history
  for select to authenticated using (is_portal_admin());

create or replace function public.app_storage_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.key like 'portalGerencial.companyJournal.%' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    if new.value is not distinct from old.value then
      return new;
    end if;
    if coalesce(current_setting('athos.restaurando', true), '') <> 'sim'
       and exists (select 1 from public.app_storage_history h where h.key = old.key and h.saved_at > now() - interval '10 minutes') then
      return new;
    end if;
  end if;
  insert into public.app_storage_history (key, value, motivo)
  values (
    old.key,
    old.value,
    case when tg_op = 'DELETE' then 'exclusao' when coalesce(current_setting('athos.restaurando', true), '') = 'sim' then 'restauracao' else 'alteracao' end
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.app_storage_keep_history() from public;

drop trigger if exists app_storage_history_trg on public.app_storage;
create trigger app_storage_history_trg
  before update or delete on public.app_storage
  for each row execute function public.app_storage_keep_history();

create or replace function public.restore_app_storage_version(p_history_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.app_storage_history%rowtype;
  restored jsonb;
begin
  if not is_portal_admin() then
    raise exception 'só o administrador pode restaurar versões';
  end if;
  select * into h from public.app_storage_history where id = p_history_id;
  if not found then
    raise exception 'versão não encontrada';
  end if;
  restored := h.value;
  if h.key like 'portalGerencial.company.%' and jsonb_typeof(restored) = 'object' then
    restored := jsonb_set(restored, '{updatedAt}', to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  end if;
  perform set_config('athos.restaurando', 'sim', true);
  insert into public.app_storage (key, value, updated_at) values (h.key, restored, now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  perform set_config('athos.restaurando', '', true);
  return h.key;
end;
$$;
revoke all on function public.restore_app_storage_version(bigint) from public;
grant execute on function public.restore_app_storage_version(bigint) to authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'athos-historico-limpeza';
select cron.schedule(
  'athos-historico-limpeza',
  '15 6 * * *',
  $job$
  delete from public.app_storage_history h
   where h.saved_at < now() - interval '60 days'
     and h.id not in (
       select id from (
         select id, row_number() over (partition by key order by saved_at desc) as rn
           from public.app_storage_history
       ) ranked
       where rn <= 5
     );
  $job$
);

-- ============================================================================
-- Ficha das pessoas liberadas em Parâmetros > Acessos (out/2026): nome,
-- telefone e observação de cada e-mail. As concessões continuam em
-- access_grants; aqui é só o cadastro (ver src/lib/access.js).
-- ============================================================================
create table if not exists public.acesso_pessoas (
  email text primary key check (email = lower(email)),
  nome text not null default '',
  telefone text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.acesso_pessoas enable row level security;

-- Equipe (admin/colaborador) vê todas as fichas; a pessoa vê a própria.
drop policy if exists "acesso_pessoas_select" on public.acesso_pessoas;
create policy "acesso_pessoas_select" on public.acesso_pessoas for select to authenticated
  using (is_portal_admin() or is_colaborador() or email = lower(coalesce(auth.jwt()->>'email', '')));

-- Quem libera acesso (admin ou colaborador) cadastra e edita a ficha.
drop policy if exists "acesso_pessoas_insert" on public.acesso_pessoas;
create policy "acesso_pessoas_insert" on public.acesso_pessoas for insert to authenticated
  with check (is_portal_admin() or is_colaborador());
drop policy if exists "acesso_pessoas_update" on public.acesso_pessoas;
create policy "acesso_pessoas_update" on public.acesso_pessoas for update to authenticated
  using (is_portal_admin() or is_colaborador())
  with check (is_portal_admin() or is_colaborador());

-- Apagar a ficha, só o dono (admin).
drop policy if exists "acesso_pessoas_delete" on public.acesso_pessoas;
create policy "acesso_pessoas_delete" on public.acesso_pessoas for delete to authenticated
  using (is_portal_admin());
