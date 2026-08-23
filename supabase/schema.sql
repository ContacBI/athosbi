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

create table if not exists colaboradores (
  email text primary key,
  nome text,
  created_at timestamptz not null default now()
);
alter table colaboradores enable row level security;

drop policy if exists "colaboradores_self_read" on colaboradores;
create policy "colaboradores_self_read"
  on colaboradores for select
  to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "colaboradores_admin_all" on colaboradores;
create policy "colaboradores_admin_all"
  on colaboradores for all
  to authenticated
  using (is_portal_admin())
  with check (is_portal_admin());

create or replace function is_colaborador()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from colaboradores where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

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

-- Escrita (insert/update): o dono pode tudo; um colaborador Restrito só
-- pode mexer no registro/razão de uma empresa (nunca em outra gaveta —
-- grupo, plano padrão, representantes, acessos continuam só do dono) e só
-- se estiver listado em `responsaveis` dela. Quem é só liberado via
-- access_grants (cliente externo) continua sempre somente-leitura.
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
      and (key like 'portalGerencial.company.%' or key like 'portalGerencial.companyJournal.%')
      and is_responsavel(split_part(key, '.', 3))
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
      and (key like 'portalGerencial.company.%' or key like 'portalGerencial.companyJournal.%')
      and is_responsavel(split_part(key, '.', 3))
    )
  )
  with check (
    is_portal_admin()
    or (
      is_colaborador()
      and (key like 'portalGerencial.company.%' or key like 'portalGerencial.companyJournal.%')
      and is_responsavel(split_part(key, '.', 3))
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

-- portal_admins: qualquer logado pode checar SE ELE PRÓPRIO é admin (é assim
-- que o app decide se mostra o menu Parâmetros); só um admin pode listar
-- todos ou mexer na tabela.
drop policy if exists "portal_admins_self_read" on portal_admins;
create policy "portal_admins_self_read"
  on portal_admins for select
  to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')));

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
