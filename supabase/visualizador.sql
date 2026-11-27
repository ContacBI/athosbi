-- Login de visualização (pedido do Izaias, 23/11/2026): um e-mail que vê TODAS as empresas e grupos exatamente como o cliente vê (e, pelo "Ver como" do hub, como cada pessoa
-- dele), mas que NÃO consegue gravar nada. Serve pra mostrar o portal e pra conferir a tela do cliente sem risco de mexer em dado.
--
-- Como funciona:
--   1. O e-mail entra em `visualizadores` E em `colaboradores`: ser colaborador é o que faz as políticas já existentes liberarem a LEITURA da carteira inteira.
--   2. Políticas RESTRITIVAS (as restritivas valem sempre, junto com as demais) barram insert/update/delete de quem é visualizador em todas as tabelas do portal.
--   3. A leitura das concessões e das fichas (access_grants, acesso_pessoas) é liberada pro visualizador: é daí que sai a lista do "Ver como".
-- Idempotente: pode rodar de novo sem erro. A conta em si (e-mail e senha) se cria em Authentication › Users › Add user, com "Auto confirm".

create table if not exists public.visualizadores (
  email text primary key,
  nome text,
  created_at timestamptz not null default now()
);
alter table public.visualizadores enable row level security;

create or replace function public.is_visualizador()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.visualizadores where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

drop policy if exists "visualizadores_self_read" on public.visualizadores;
create policy "visualizadores_self_read"
  on public.visualizadores for select
  to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')) or is_portal_admin());

drop policy if exists "visualizadores_admin_all" on public.visualizadores;
create policy "visualizadores_admin_all"
  on public.visualizadores for all
  to authenticated
  using (is_portal_admin())
  with check (is_portal_admin());

-- Leitura das concessões e das fichas (pro "Ver como").
drop policy if exists "access_grants_visualizador_read" on public.access_grants;
create policy "access_grants_visualizador_read"
  on public.access_grants for select
  to authenticated
  using (is_visualizador());

drop policy if exists "acesso_pessoas_visualizador_read" on public.acesso_pessoas;
create policy "acesso_pessoas_visualizador_read"
  on public.acesso_pessoas for select
  to authenticated
  using (is_visualizador());

-- Nada de escrita pra quem só visualiza. Uma política restritiva por comando, em cada tabela do portal que existir.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_storage', 'app_storage_history', 'access_grants', 'acesso_pessoas', 'colaboradores', 'portal_admins', 'visualizadores',
    'dominio_sync', 'dominio_balancete', 'dominio_pedidos', 'dominio_fiscal', 'dominio_carga', 'dominio_notas', 'dominio_empresas', 'dominio_dfc_modelo',
    'gestaoclick_dre', 'interno_contabil', 'revisa_nota', 'revisa_nota_pedidos', 'revisa_nota_observacoes',
    'reforma_escritorio', 'reforma_empresas', 'reforma_acessos', 'reforma_parametros', 'reforma_simulacoes', 'shared_presentations'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "visualizador_sem_insert" on public.%I', t);
      execute format('create policy "visualizador_sem_insert" on public.%I as restrictive for insert to authenticated with check (not public.is_visualizador())', t);
      execute format('drop policy if exists "visualizador_sem_update" on public.%I', t);
      execute format('create policy "visualizador_sem_update" on public.%I as restrictive for update to authenticated using (not public.is_visualizador())', t);
      execute format('drop policy if exists "visualizador_sem_delete" on public.%I', t);
      execute format('create policy "visualizador_sem_delete" on public.%I as restrictive for delete to authenticated using (not public.is_visualizador())', t);
    end if;
  end loop;
end $$;

-- O login de visualização. A senha NÃO vai aqui: a conta é criada em Authentication › Users › Add user.
insert into public.colaboradores (email, nome) values ('testebi@gmail.com', 'Visualização (teste)') on conflict (email) do nothing;
insert into public.visualizadores (email, nome) values ('testebi@gmail.com', 'Visualização (teste)') on conflict (email) do nothing;
