-- Interno x Contábil (Grupo Concent, 27/11/2026): tabela que a função interno-contabil grava e o módulo "Interno x Contábil" lê.
-- Leitura: equipe sempre; cliente só com a empresa liberada E o módulo liberado (mesma regra do Revisa Nota, public.modulo_liberado).
-- Pode rodar de novo sem erro.
create table if not exists public.interno_contabil (
  company_id text not null,
  company_codigo text not null,
  cnpj text not null,
  mes text not null check (mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  regime text not null check (regime in ('caixa', 'competencia')),
  dados jsonb not null,
  assinatura text,
  synced_at timestamptz not null default now(),
  primary key (company_id, mes, regime)
);
alter table public.interno_contabil enable row level security;
drop policy if exists "interno_contabil_read_scoped" on public.interno_contabil;
create policy "interno_contabil_read_scoped" on public.interno_contabil for select to authenticated
  using (is_portal_admin() or is_colaborador() or (company_id = any (allowed_company_ids()) and public.modulo_liberado(company_id, 'interno-contabil')));

-- a ficha da pessoa aceita o módulo novo
alter table public.acesso_pessoas drop constraint if exists acesso_pessoas_modulos_validos;
alter table public.acesso_pessoas add constraint acesso_pessoas_modulos_validos
  check (modulos <@ array['orcamento', 'carga-tributaria', 'analise-desempenho', 'entradas-saidas', 'dre-gerencial', 'revisa-nota', 'interno-contabil']::text[]);

-- visualizador (login de demonstração) não grava
drop policy if exists "visualizador_sem_insert" on public.interno_contabil;
create policy "visualizador_sem_insert" on public.interno_contabil as restrictive for insert to authenticated with check (not public.is_visualizador());
drop policy if exists "visualizador_sem_update" on public.interno_contabil;
create policy "visualizador_sem_update" on public.interno_contabil as restrictive for update to authenticated using (not public.is_visualizador());
drop policy if exists "visualizador_sem_delete" on public.interno_contabil;
create policy "visualizador_sem_delete" on public.interno_contabil as restrictive for delete to authenticated using (not public.is_visualizador());
