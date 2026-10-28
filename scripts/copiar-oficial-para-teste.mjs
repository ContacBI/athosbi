// Cópia automática do OFICIAL para o TESTE (docs/AMBIENTES.md) — roda no
// GitHub duas vezes por dia (.github/workflows/copia-oficial-para-teste.yml)
// ou à mão. Só de ida: lê o banco oficial (nunca grava nele) e manda tudo
// para a área de espera do banco de teste (copia_lotes); no fim, o próprio
// banco de teste troca tudo de uma vez (aplicar_copia, em
// supabase/teste/copia_do_oficial.sql) — com a trava de segurança.
//
// Variáveis (segredos do GitHub): OFICIAL_SUPABASE_URL,
// OFICIAL_SUPABASE_SERVICE_KEY, TESTE_SUPABASE_URL,
// TESTE_SUPABASE_SERVICE_KEY; FORCAR=sim passa por cima da trava.
// Não imprime dado nenhum — só contagens.

import { createClient } from "@supabase/supabase-js";

const BANCO_OFICIAL = "ijmkvxtdlthyxpawncbs";
// Mesmas tabelas de tabelas_da_copia() (supabase/teste/copia_do_oficial.sql),
// com a chave de cada uma pra ler em ordem e, nas pesadas, quantas linhas
// por página (o app_storage tem partes do razão de até ~8 MB cada).
export const TABELAS = [
  ["portal_admins", "email"],
  ["colaboradores", "email"],
  ["access_grants", "id"],
  ["acesso_pessoas", "email"],
  ["app_storage", "key", 10],
  ["dominio_sync", "company_codigo,competencia,lote,parte"],
  ["dominio_balancete", "company_codigo,lote,parte"],
  ["dominio_carga", "company_id,ano"],
  ["dominio_fiscal", "cnpj"],
  ["dominio_dfc_modelo", "company_codigo,cnpj"],
  ["dominio_pedidos", "id"],
  ["reforma_escritorio", "email"],
  ["reforma_parametros", "id"],
  ["reforma_empresas", "id"],
  ["reforma_acessos", "id"],
  ["reforma_simulacoes", "id"],
];
// Versão de supabase/teste/copia_do_oficial.sql que este robô espera
// (versao_da_copia() no banco de teste).
export const VERSAO_DA_COPIA = 2;
const POR_PAGINA = 100;
const TAMANHO_DO_LOTE = 3.5 * 1024 * 1024;

// Nunca grava no oficial: o destino não pode ser o banco oficial, e a
// origem tem que ser.
export function conferirEnderecos(oficial, teste) {
  if (!oficial || !teste) throw new Error("Faltam OFICIAL_SUPABASE_URL / TESTE_SUPABASE_URL.");
  if (!oficial.includes(BANCO_OFICIAL)) throw new Error("OFICIAL_SUPABASE_URL não é o banco oficial.");
  if (teste.includes(BANCO_OFICIAL) || teste === oficial) throw new Error("TESTE_SUPABASE_URL aponta pro banco oficial — cópia cancelada.");
}

// Linhas em lotes de até `limite` caracteres de JSON (uma linha maior que
// o limite vai sozinha).
export function emLotes(linhas, limite = TAMANHO_DO_LOTE) {
  const lotes = [];
  let atual = [];
  let tamanho = 0;
  linhas.forEach((linha) => {
    const t = JSON.stringify(linha).length;
    if (atual.length && tamanho + t > limite) {
      lotes.push(atual);
      atual = [];
      tamanho = 0;
    }
    atual.push(linha);
    tamanho += t;
  });
  if (atual.length) lotes.push(atual);
  return lotes;
}

const chaveRecusada = ({ error, status }) => status === 401 || /Invalid API key|JWS|JWT/i.test(error?.message || "");
// Pedido que não coube no tempo da API (8 s por pedido no Supabase), erro do
// servidor ou conexão caída.
const pedidoPesado = ({ error, status }) => error?.code === "57014" || status >= 500 || /statement timeout|fetch failed/i.test(error?.message || "");

function explicar(resposta, segredo) {
  if (chaveRecusada(resposta)) return `chave recusada — confira o segredo ${segredo}_SUPABASE_SERVICE_KEY`;
  return resposta.error?.message || `erro ${resposta.status}`;
}

// Lê a tabela inteira, página por página. Uma página que não cabe no tempo
// da API (linhas enormes, como o razão das empresas) é pedida de novo com
// metade das linhas, até uma só.
export async function* lerEmPaginas(banco, tabela, chave, porPagina = POR_PAGINA) {
  let inicio = 0;
  let tamanho = porPagina;
  for (;;) {
    let consulta = banco.from(tabela).select("*");
    chave.split(",").forEach((coluna) => {
      consulta = consulta.order(coluna, { ascending: true });
    });
    const resposta = await consulta.range(inicio, inicio + tamanho - 1);
    if (resposta.error) {
      if (tamanho > 1 && pedidoPesado(resposta)) {
        tamanho = Math.ceil(tamanho / 2);
        continue;
      }
      throw new Error(`Leitura de ${tabela} no oficial: ${explicar(resposta, "OFICIAL")}`);
    }
    if (resposta.data.length) yield resposta.data;
    if (resposta.data.length < tamanho) return;
    inicio += resposta.data.length;
  }
}

export async function copiar() {
  const { OFICIAL_SUPABASE_URL, OFICIAL_SUPABASE_SERVICE_KEY, TESTE_SUPABASE_URL, TESTE_SUPABASE_SERVICE_KEY, FORCAR } = process.env;
  conferirEnderecos(OFICIAL_SUPABASE_URL, TESTE_SUPABASE_URL);
  if (!OFICIAL_SUPABASE_SERVICE_KEY || !TESTE_SUPABASE_SERVICE_KEY) throw new Error("Faltam as chaves de serviço (OFICIAL_/TESTE_SUPABASE_SERVICE_KEY).");
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  const oficial = createClient(OFICIAL_SUPABASE_URL, OFICIAL_SUPABASE_SERVICE_KEY, opcoes);
  const teste = createClient(TESTE_SUPABASE_URL, TESTE_SUPABASE_SERVICE_KEY, opcoes);
  const comeco = new Date().toISOString();

  // O banco de teste precisa da versão certa do SQL da cópia (só existe no teste).
  const versao = await teste.rpc("versao_da_copia");
  if (chaveRecusada(versao)) throw new Error(`Banco de teste: ${explicar(versao, "TESTE")}.`);
  if (versao.error || !(versao.data >= VERSAO_DA_COPIA)) throw new Error("O banco de teste não está preparado: rode a versão nova de supabase/teste/copia_do_oficial.sql no SQL Editor do teste.");
  const preparo = await teste.from("copia_lotes").delete().gt("id", 0);
  if (preparo.error) throw new Error(`Limpeza da área de espera do teste: ${explicar(preparo, "TESTE")}`);

  for (const [tabela, chave, porPagina] of TABELAS) {
    let linhas = 0;
    let lotes = 0;
    let pendentes = [];
    const enviar = async (lote) => {
      const resposta = await teste.from("copia_lotes").insert({ tabela, linhas: lote });
      if (resposta.error) throw new Error(`Envio de ${tabela} pro teste: ${explicar(resposta, "TESTE")}`);
      lotes += 1;
    };
    // Manda os lotes conforme lê — a tabela inteira não fica na memória.
    for await (const pagina of lerEmPaginas(oficial, tabela, chave, porPagina)) {
      linhas += pagina.length;
      const prontos = emLotes(pendentes.concat(pagina));
      pendentes = prontos.pop();
      for (const lote of prontos) await enviar(lote);
    }
    if (pendentes.length) await enviar(pendentes);
    console.log(`${tabela}: ${linhas} linha(s) em ${lotes} lote(s)`);
  }

  const aplicada = await teste.rpc("aplicar_copia", { forcar: FORCAR === "sim" || FORCAR === "true" });
  if (!aplicada.error) {
    console.log("Cópia aplicada no teste:", JSON.stringify(aplicada.data));
    return;
  }
  if (!pedidoPesado(aplicada)) throw new Error(explicar(aplicada, "TESTE"));
  // A resposta pode cair antes de o banco terminar a troca: espera o
  // registro da cópia aparecer (até 10 min).
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    await new Promise((resolver) => setTimeout(resolver, 15000));
    const { data } = await teste.from("copia_do_oficial").select("feita_em, resumo").gte("feita_em", comeco).limit(1);
    if (data?.length) {
      console.log("Cópia aplicada no teste:", JSON.stringify(data[0].resumo));
      return;
    }
  }
  throw new Error(`A troca no teste não confirmou (${explicar(aplicada, "TESTE")}).`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  copiar().catch((error) => {
    console.error(`Cópia NÃO aplicada: ${error.message}`);
    process.exit(1);
  });
}
