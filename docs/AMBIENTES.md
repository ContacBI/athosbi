# Ambientes: oficial e teste

Melhoria nova não vai direto para quem usa o portal. Ela passa primeiro pelo **site de teste**, com banco próprio e só empresas fictícias, e só sobe para o **oficial** depois de testada.

| | Oficial | Teste (homologação) |
|---|---|---|
| Endereço | bi.athosconsultoriaempresarial.com | teste.bi.athosconsultoriaempresarial.com |
| Código (branch) | `main` | `homologacao` |
| Banco (Supabase) | **AthosBI** (organização Athosbi, plano Pro) | **AthosBI Teste** (organização AthosBI Teste, plano Free) |
| Dados | clientes reais | cópia do oficial, atualizada 2 vezes por dia |
| Quem usa | clientes e equipe | só a equipe, testando as novidades |

O site de teste mostra o selo **"Ambiente de teste · cópia do oficial de dd/mm hh:mm"** em todas as telas e "[TESTE]" no título da aba. Isso vem de `src/lib/ambiente.js`: é teste sempre que o banco não for o oficial, ou quando `VITE_AMBIENTE=teste`.

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

### Cópia automática do oficial

Duas vezes por dia, às 6h17 e às 13h17 (horário de Brasília), o robô `.github/workflows/copia-oficial-para-teste.yml` (`scripts/copiar-oficial-para-teste.mjs`) deixa o banco de teste igual ao oficial.

**O que ele faz:**
- É só de ida: o oficial só é lido. O que se muda no teste some na cópia seguinte.
- Primeiro manda tudo para a área de espera do banco de teste. Depois o banco troca tudo **de uma vez**: se der erro no meio, o teste fica como estava, nunca pela metade.

**O que entra e o que fica de fora:**
- **Vai:** empresas, razão, De/Para, apresentações, orçamentos, plano, grupos, acessos e fichas, dados da Domínio (sincronizador) e da Reforma.
- **Não vai:** o histórico de versões, o uso do portal (Central) e as apresentações compartilhadas por link. Os logins também não vão: no teste, cada pessoa da equipe tem o seu, criado no Supabase de teste.

**Trava de segurança:** se o oficial vier com menos de 80% das empresas que o teste tem, a cópia **não** é aplicada. O teste continua com a última cópia boa, que serve de cópia de segurança, e a tarefa fica vermelha no GitHub (Actions). Para aplicar mesmo assim: Actions › "Cópia do oficial para o teste" › Run workflow › marcar "forçar".

**Isto não substitui o backup do oficial.** O banco oficial tem o backup diário do Supabase (plano Pro) e o histórico de versões de cada registro (`app_storage_history`).

**Montar (uma vez):**
1. No **SQL Editor do banco de TESTE**, rodar `supabase/teste/copia_do_oficial.sql`. Esse arquivo **nunca** vai no oficial. Ele também dá à chave de serviço do teste até 10 minutos por pedido (a troca de tudo passa dos 8 s padrão). Quando o arquivo mudar, o robô avisa "rode a versão nova" e é só rodar de novo.
2. Em **GitHub › Settings › Secrets and variables › Actions › New repository secret**, criar estes quatro segredos (as chaves de serviço ficam em Supabase › Project Settings › API Keys › *Secret keys*):

   | Segredo | Valor |
   |---|---|
   | `OFICIAL_SUPABASE_URL` | `https://ijmkvxtdlthyxpawncbs.supabase.co` |
   | `OFICIAL_SUPABASE_SERVICE_KEY` | chave *secret* do projeto **AthosBI** |
   | `TESTE_SUPABASE_URL` | `https://sbpmstnfdojrsfksakhy.supabase.co` |
   | `TESTE_SUPABASE_SERVICE_KEY` | chave *secret* do projeto **AthosBI Teste** |

3. Rodar uma vez à mão: Actions › "Cópia do oficial para o teste" › Run workflow.

Com dados reais no teste, só a equipe deve ter login lá.

### Dados fictícios (opcional)

Para testar sem dados de cliente, o arquivo de empresas fictícias continua disponível. Ele é apagado na próxima cópia automática.

1. Gerar o arquivo:

   ```
   node --import ./tests/register.mjs scripts/gerar-base-de-teste.mjs base_teste_athosbi.zip
   ```

2. Entrar no site de teste e restaurar o arquivo em **Parâmetros › Empresas › Restaurar backup**.

O arquivo traz três empresas (Comercial Modelo, Serviços Exemplo e Indústria Fictícia), de jan a set/2026, e o Grupo Modelo.

## O que ainda não existe no teste

- **Convite por e-mail**: a função `invite-user` só está publicada no banco oficial. No teste, crie os logins direto no Supabase (passo 2 acima).
- **Sincronizador da Domínio**: grava só no banco oficial. As telas que dependem dele (balancete da Domínio, carga tributária) ficam vazias no teste.
