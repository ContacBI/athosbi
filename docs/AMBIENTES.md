# Ambientes: oficial e teste

Melhoria nova não vai direto para quem usa o portal. Ela passa primeiro pelo **site de teste**, com banco próprio e só empresas fictícias, e só sobe para o **oficial** depois de testada.

| | Oficial | Teste (homologação) |
|---|---|---|
| Endereço | bi.athosconsultoriaempresarial.com | teste.bi.athosconsultoriaempresarial.com |
| Código (branch) | `main` | `homologacao` |
| Banco (Supabase) | **AthosBI** (organização Athosbi, plano Pro) | **AthosBI Teste** (organização AthosBI Teste, plano Free) |
| Dados | clientes reais | empresas fictícias (`scripts/gerar-base-de-teste.mjs`) |
| Quem usa | clientes e equipe | quem testa as novidades |

O site de teste mostra o selo **"Ambiente de teste · dados fictícios"** em todas as telas e "[TESTE]" no título da aba. Isso vem de `src/lib/ambiente.js`: é teste sempre que o banco não for o oficial, ou quando `VITE_AMBIENTE=teste`.

## Fluxo de uma melhoria

1. A mudança é feita num branch de trabalho. Os testes automáticos rodam a cada envio (`.github/workflows/testes.yml`).
2. **"Publica no teste"**: pull request do branch de trabalho para `homologacao`. Mesclado, a Vercel atualiza o site de teste.
3. Quem testa confere no site de teste.
4. **"Sobe pra produção"**: pull request de `homologacao` para `main`. Mesclado, a Vercel atualiza o oficial.
5. Se algo escapar, a Vercel volta a versão anterior do oficial em um clique (Deployments › versão anterior › *Instant Rollback*). Depois corrige-se pelo mesmo fluxo.

Mudança no banco (tabela nova, política nova) segue a mesma ordem: primeiro no banco de teste, depois no oficial. Toda estrutura do banco fica em `supabase/schema.sql`, que roda do zero num projeto vazio e pode rodar de novo sem erro.

## Montar o ambiente de teste (uma vez)

### Supabase — projeto "AthosBI Teste"

1. **SQL Editor**: colar o `supabase/schema.sql` inteiro e rodar.
2. **Authentication › Users › Add user**: criar o login de quem vai testar (com "Auto confirm"). `izaiascontac@gmail.com` e `contac@gmail.com` já entram como administradores pelo próprio script.
3. **Authentication › URL Configuration**:
   - Site URL: `https://teste.bi.athosconsultoriaempresarial.com`
   - Redirect URLs: `https://teste.bi.athosconsultoriaempresarial.com/**`
4. **Project Settings › API**: copiar a *Project URL* e a chave pública (*anon* / *publishable*). São as duas que vão para a Vercel (a chave pública pode aparecer no navegador; a *service_role* nunca).

### Vercel — projeto do portal

1. **Settings › Environment Variables**: nas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, deixar os valores do banco **oficial** só em *Production* e colocar os do banco **de teste** em *Preview*. Assim, todo site que não é o oficial (o de teste e as prévias de cada mudança) usa o banco de teste.
2. **Settings › Domains › Add**: `teste.bi.athosconsultoriaempresarial.com`, ligado ao branch `homologacao`.
3. No provedor do domínio (onde está o DNS de athosconsultoriaempresarial.com): criar o registro que a Vercel mostrar, em geral um **CNAME** `teste.bi` apontando para `cname.vercel-dns.com`.
4. Fazer um novo deploy do branch `homologacao` (Deployments › ⋯ › Redeploy) para pegar as variáveis.

### Dados fictícios

1. Gerar o arquivo:

   ```
   node --import ./tests/register.mjs scripts/gerar-base-de-teste.mjs base_teste_athosbi.zip
   ```

2. Entrar no site de teste e restaurar o arquivo em **Parâmetros › Empresas › Restaurar backup**.

O arquivo traz três empresas (Comercial Modelo, Serviços Exemplo e Indústria Fictícia), de jan a set/2026, e o Grupo Modelo.

## O que ainda não existe no teste

- **Convite por e-mail**: a função `invite-user` só está publicada no banco oficial. No teste, crie os logins direto no Supabase (passo 2 acima).
- **Sincronizador da Domínio**: grava só no banco oficial. As telas que dependem dele (balancete da Domínio, carga tributária) ficam vazias no teste.
