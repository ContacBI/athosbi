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

drop policy if exists "app_storage_select_authenticated" on app_storage;
create policy "app_storage_select_authenticated"
  on app_storage for select
  to authenticated
  using (true);

drop policy if exists "app_storage_insert_authenticated" on app_storage;
create policy "app_storage_insert_authenticated"
  on app_storage for insert
  to authenticated
  with check (true);

drop policy if exists "app_storage_update_authenticated" on app_storage;
create policy "app_storage_update_authenticated"
  on app_storage for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "app_storage_delete_authenticated" on app_storage;
create policy "app_storage_delete_authenticated"
  on app_storage for delete
  to authenticated
  using (true);

-- Bucket pra anexos "outro" dos Relatórios mensais (lib/companies.js
-- attachMonthlyReport) — o único dado do app que é um arquivo binário de
-- verdade em vez de JSON, então não cabe na tabela acima. Privado: só
-- quem estiver logado consegue subir/baixar.
insert into storage.buckets (id, name, public)
values ('monthly-reports', 'monthly-reports', false)
on conflict (id) do nothing;

drop policy if exists "monthly_reports_all_authenticated" on storage.objects;
create policy "monthly_reports_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'monthly-reports')
  with check (bucket_id = 'monthly-reports');

-- Depois de rodar isso, crie seu login em:
-- Authentication > Users > Add user (email + senha) — é por aí, não por
-- aqui, que a conta de acesso ao portal é criada.
