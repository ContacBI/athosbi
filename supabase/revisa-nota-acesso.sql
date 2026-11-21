-- Revisa Nota: o módulo só abre pra quem a equipe liberou, e isso passa a valer NO BANCO (antes só a tela escondia).
-- Mesma regra da tela (src/lib/modulos.js + src/lib/visibilidade.js):
--   1) equipe (admin/colaborador) sempre pode;
--   2) a configuração da empresa (`visibilidade` no cadastro) — ou, sem configuração própria, a do grupo mais recente que a contém;
--   3) se a pessoa tem perfil nessa configuração (`perfilPorPessoa`), vale a lista de módulos do perfil;
--   4) senão, se a configuração tem lista `modulos`, vale ela;
--   5) senão vale a ficha da pessoa (acesso_pessoas.modulos).
-- Além disso a empresa precisa estar liberada pra pessoa (allowed_company_ids), como já era.

-- A ficha da pessoa aceita o módulo novo (antes a lista fixa do banco não tinha 'revisa-nota').
alter table public.acesso_pessoas drop constraint if exists acesso_pessoas_modulos_validos;
alter table public.acesso_pessoas add constraint acesso_pessoas_modulos_validos
  check (modulos <@ array['orcamento', 'carga-tributaria', 'analise-desempenho', 'entradas-saidas', 'dre-gerencial', 'revisa-nota']::text[]);

create or replace function public.modulo_liberado(p_company text, p_modulo text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  emp jsonb;
  vis jsonb;
  perfil_id text;
  perfil jsonb;
  lista jsonb;
begin
  if auth.uid() is null then return false; end if;
  if public.is_portal_admin() or public.is_colaborador() then return true; end if;
  if not (p_company = any (public.allowed_company_ids())) then return false; end if;

  select value into emp from public.app_storage where key = 'portalGerencial.company.' || p_company;
  vis := emp -> 'visibilidade';
  -- "tem configuração" = modo marcados, lista de ocultos, lista de módulos ou algum perfil
  if not (vis is not null and jsonb_typeof(vis) = 'object' and (
       vis ->> 'modo' = 'marcados'
    or jsonb_typeof(vis -> 'ocultos') = 'array'
    or jsonb_typeof(vis -> 'modulos') = 'array'
    or (jsonb_typeof(vis -> 'perfis') = 'array' and jsonb_array_length(vis -> 'perfis') > 0))) then
    -- sem configuração própria: herda a do grupo mais recente que tem a empresa e tem configuração
    select g -> 'visibilidade' into vis
      from public.app_storage s, jsonb_array_elements(s.value) as g
      where s.key = 'portalGerencial.groups.v1'
        and coalesce(g -> 'companyIds', '[]'::jsonb) ? p_company
        and jsonb_typeof(g -> 'visibilidade') = 'object'
        and (
             g -> 'visibilidade' ->> 'modo' = 'marcados'
          or jsonb_typeof(g -> 'visibilidade' -> 'ocultos') = 'array'
          or jsonb_typeof(g -> 'visibilidade' -> 'modulos') = 'array'
          or (jsonb_typeof(g -> 'visibilidade' -> 'perfis') = 'array' and jsonb_array_length(g -> 'visibilidade' -> 'perfis') > 0))
      order by coalesce(g ->> 'updatedAt', '') desc
      limit 1;
  end if;

  if vis is not null and jsonb_typeof(vis) = 'object' then
    perfil_id := vis -> 'perfilPorPessoa' ->> email;
    if perfil_id is not null then
      select p into perfil from jsonb_array_elements(coalesce(vis -> 'perfis', '[]'::jsonb)) p where p ->> 'id' = perfil_id limit 1;
      if perfil is not null then
        return coalesce(perfil -> 'modulos', '[]'::jsonb) ? p_modulo;
      end if;
    end if;
    lista := vis -> 'modulos';
    if jsonb_typeof(lista) = 'array' then return lista ? p_modulo; end if;
  end if;

  return exists (select 1 from public.acesso_pessoas a where lower(a.email) = email and p_modulo = any (a.modulos));
end;
$$;
revoke all on function public.modulo_liberado(text, text) from public, anon;
grant execute on function public.modulo_liberado(text, text) to authenticated;

-- Leitura das três tabelas do Revisa Nota: equipe, ou cliente com a empresa E o módulo liberados.
drop policy if exists "revisa_nota_read_scoped" on public.revisa_nota;
create policy "revisa_nota_read_scoped" on public.revisa_nota for select to authenticated
  using (is_portal_admin() or is_colaborador() or (company_id = any (allowed_company_ids()) and public.modulo_liberado(company_id, 'revisa-nota')));
drop policy if exists "revisa_nota_pedidos_read_scoped" on public.revisa_nota_pedidos;
create policy "revisa_nota_pedidos_read_scoped" on public.revisa_nota_pedidos for select to authenticated
  using (is_portal_admin() or is_colaborador() or (company_id = any (allowed_company_ids()) and public.modulo_liberado(company_id, 'revisa-nota')));
drop policy if exists "revisa_nota_observacoes_read_scoped" on public.revisa_nota_observacoes;
create policy "revisa_nota_observacoes_read_scoped" on public.revisa_nota_observacoes for select to authenticated
  using (is_portal_admin() or is_colaborador() or (company_id = any (allowed_company_ids()) and public.modulo_liberado(company_id, 'revisa-nota')));

-- Criar pedido e escrever na conversa: mesma exigência.
create or replace function public.revisa_nota_criar_pedido(p_company text, p_tipo text, p_alvo text, p_descricao text, p_ncm text, p_unidade text, p_proposta jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  novo uuid;
  raiz text;
  email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  ncm_limpo text := regexp_replace(coalesce(p_ncm, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Entre para fazer o pedido'; end if;
  if not (public.is_portal_admin() or public.is_colaborador() or (p_company = any (public.allowed_company_ids()) and public.modulo_liberado(p_company, 'revisa-nota'))) then raise exception 'Empresa indisponível'; end if;
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
  values (p_company, raiz, p_tipo, trim(p_alvo), left(coalesce(p_descricao, ''), 200), ncm_limpo, coalesce(nullif(trim(p_unidade), ''), 'UN'), p_proposta, email)
  returning id into novo;
  return novo;
end;
$$;

create or replace function public.revisa_nota_observar(p_pedido uuid, p_texto text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  comp text;
  novo uuid;
  email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  texto text := trim(coalesce(p_texto, ''));
  quem text;
begin
  if auth.uid() is null then raise exception 'Entre para escrever'; end if;
  select company_id into comp from public.revisa_nota_pedidos where id = p_pedido;
  if comp is null then raise exception 'Pedido indisponível'; end if;
  if not (public.is_portal_admin() or public.is_colaborador() or (comp = any (public.allowed_company_ids()) and public.modulo_liberado(comp, 'revisa-nota'))) then raise exception 'Pedido indisponível'; end if;
  if length(texto) < 1 or length(texto) > 1000 then raise exception 'Escreva de 1 a 1000 caracteres'; end if;
  select coalesce(nullif(trim(p.nome), ''), split_part(email, '@', 1)) into quem from public.acesso_pessoas p where lower(p.email) = email;
  insert into public.revisa_nota_observacoes (pedido_id, company_id, autor, autor_nome, texto)
  values (p_pedido, comp, case when public.is_portal_admin() or public.is_colaborador() then 'escritorio' else 'cliente' end, left(coalesce(quem, split_part(email, '@', 1)), 80), texto)
  returning id into novo;
  update public.revisa_nota_pedidos set atualizado_em = now() where id = p_pedido;
  return novo;
end;
$$;
revoke all on function public.revisa_nota_criar_pedido(text, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.revisa_nota_observar(uuid, text) from public, anon;
grant execute on function public.revisa_nota_criar_pedido(text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.revisa_nota_observar(uuid, text) to authenticated;
