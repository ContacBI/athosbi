-- Revisa Nota no Athos, etapa 2: pedidos do cliente (produto novo, mudança de classificação, perfil de comprador) e a conversa de observações de cada pedido.
-- O cliente só cria pedido/observação pelas funções abaixo (checam o acesso à empresa); o escritório responde pela função revisa-nota (token) ou pelo próprio Athos.

create table if not exists public.revisa_nota_pedidos (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  cnpj_raiz text not null,
  tipo text not null check (tipo in ('novo', 'alteracao', 'perfil')),
  alvo text not null,
  descricao text not null default '',
  ncm text not null default '',
  unidade text not null default 'UN',
  proposta jsonb not null,
  status text not null default 'enviado' check (status in ('enviado', 'em_analise', 'cadastrado', 'recusado')),
  resposta text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists revisa_nota_pedidos_empresa_idx on public.revisa_nota_pedidos (company_id, criado_em desc);
create index if not exists revisa_nota_pedidos_raiz_idx on public.revisa_nota_pedidos (cnpj_raiz, status);

create table if not exists public.revisa_nota_observacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.revisa_nota_pedidos (id) on delete cascade,
  company_id text not null,
  autor text not null check (autor in ('cliente', 'escritorio')),
  autor_nome text not null default '',
  texto text not null check (length(texto) between 1 and 1000),
  criado_em timestamptz not null default now()
);
create index if not exists revisa_nota_observacoes_pedido_idx on public.revisa_nota_observacoes (pedido_id, criado_em);

alter table public.revisa_nota_pedidos enable row level security;
alter table public.revisa_nota_observacoes enable row level security;
drop policy if exists "revisa_nota_pedidos_read_scoped" on public.revisa_nota_pedidos;
create policy "revisa_nota_pedidos_read_scoped" on public.revisa_nota_pedidos for select to authenticated
  using (is_portal_admin() or is_colaborador() or company_id = any (allowed_company_ids()));
drop policy if exists "revisa_nota_observacoes_read_scoped" on public.revisa_nota_observacoes;
create policy "revisa_nota_observacoes_read_scoped" on public.revisa_nota_observacoes for select to authenticated
  using (is_portal_admin() or is_colaborador() or company_id = any (allowed_company_ids()));

create or replace function public.revisa_nota_criar_pedido(p_company text, p_tipo text, p_alvo text, p_descricao text, p_ncm text, p_unidade text, p_proposta jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  novo uuid;
  raiz text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  ncm_limpo text := regexp_replace(coalesce(p_ncm, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Entre para fazer o pedido'; end if;
  if not (public.is_portal_admin() or public.is_colaborador() or p_company = any (public.allowed_company_ids())) then raise exception 'Empresa indisponível'; end if;
  select cnpj_raiz into raiz from public.revisa_nota where company_id = p_company limit 1;
  if raiz is null then raise exception 'Esta empresa ainda não usa o Revisa Nota'; end if;
  if p_tipo not in ('novo', 'alteracao', 'perfil') then raise exception 'Tipo de pedido inválido'; end if;
  if coalesce(trim(p_alvo), '') = '' or length(p_alvo) > 120 then raise exception 'Pedido sem produto ou comprador'; end if;
  if length(coalesce(p_descricao, '')) > 200 then raise exception 'Descrição grande demais'; end if;
  if p_proposta is null or jsonb_typeof(p_proposta) <> 'object' or length(p_proposta::text) > 3000 then raise exception 'Pedido inválido'; end if;
  if p_tipo = 'novo' and (length(ncm_limpo) <> 8 or coalesce(trim(p_descricao), '') = '') then raise exception 'Produto novo precisa de descrição e NCM com 8 dígitos'; end if;
  if exists (select 1 from public.revisa_nota_pedidos x where x.company_id = p_company and x.tipo = p_tipo and x.alvo = p_alvo and x.status in ('enviado', 'em_analise')) then
    raise exception 'Já existe um pedido aberto para este item: continue a conversa nele';
  end if;
  insert into public.revisa_nota_pedidos (company_id, cnpj_raiz, tipo, alvo, descricao, ncm, unidade, proposta, criado_por)
  values (p_company, raiz, p_tipo, trim(p_alvo), left(coalesce(p_descricao, ''), 200), ncm_limpo, coalesce(nullif(trim(p_unidade), ''), 'UN'), p_proposta, v_email)
  returning id into novo;
  return novo;
end;
$$;

-- O portal é o lado do CLIENTE: o que se escreve aqui entra como 'cliente' mesmo quando quem escreve é da equipe testando (o escritório responde pelo app interno, que grava como 'escritorio').
create or replace function public.revisa_nota_observar(p_pedido uuid, p_texto text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  comp text;
  novo uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  texto text := trim(coalesce(p_texto, ''));
  quem text;
begin
  if auth.uid() is null then raise exception 'Entre para escrever'; end if;
  select company_id into comp from public.revisa_nota_pedidos where id = p_pedido;
  if comp is null then raise exception 'Pedido indisponível'; end if;
  if not (public.is_portal_admin() or public.is_colaborador() or comp = any (public.allowed_company_ids())) then raise exception 'Pedido indisponível'; end if;
  if length(texto) < 1 or length(texto) > 1000 then raise exception 'Escreva de 1 a 1000 caracteres'; end if;
  select coalesce(nullif(trim(p.nome), ''), split_part(v_email, '@', 1)) into quem from public.acesso_pessoas p where lower(p.email) = v_email;
  insert into public.revisa_nota_observacoes (pedido_id, company_id, autor, autor_nome, texto)
  values (p_pedido, comp, 'cliente', left(coalesce(quem, split_part(v_email, '@', 1)), 80), texto)
  returning id into novo;
  update public.revisa_nota_pedidos set atualizado_em = now() where id = p_pedido;
  return novo;
end;
$$;

revoke all on function public.revisa_nota_criar_pedido(text, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.revisa_nota_observar(uuid, text) from public, anon;
grant execute on function public.revisa_nota_criar_pedido(text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.revisa_nota_observar(uuid, text) to authenticated;
