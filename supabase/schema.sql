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
