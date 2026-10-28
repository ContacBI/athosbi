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
// com a chave de cada uma pra ler em ordem.
export const TABELAS = [
  ["portal_admins", "email"],
  ["colaboradores", "email"],
  ["access_grants", "id"],
  ["acesso_pessoas", "email"],
  ["app_storage", "key"],
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

async function lerTudo(banco, tabela, chave) {
  const linhas = [];
  for (let pagina = 0; ; pagina += 1) {
    let consulta = banco.from(tabela).select("*");
    chave.split(",").forEach((coluna) => {
      consulta = consulta.order(coluna, { ascending: true });
    });
    const { data, error } = await consulta.range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (error) throw new Error(`Leitura de ${tabela} no oficial: ${error.message}`);
    linhas.push(...data);
    if (data.length < POR_PAGINA) return linhas;
  }
}

export async function copiar() {
  const { OFICIAL_SUPABASE_URL, OFICIAL_SUPABASE_SERVICE_KEY, TESTE_SUPABASE_URL, TESTE_SUPABASE_SERVICE_KEY, FORCAR } = process.env;
  conferirEnderecos(OFICIAL_SUPABASE_URL, TESTE_SUPABASE_URL);
  if (!OFICIAL_SUPABASE_SERVICE_KEY || !TESTE_SUPABASE_SERVICE_KEY) throw new Error("Faltam as chaves de serviço (OFICIAL_/TESTE_SUPABASE_SERVICE_KEY).");
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  const oficial = createClient(OFICIAL_SUPABASE_URL, OFICIAL_SUPABASE_SERVICE_KEY, opcoes);
  const teste = createClient(TESTE_SUPABASE_URL, TESTE_SUPABASE_SERVICE_KEY, opcoes);

  // O banco de teste precisa ter a área de espera (só existe no teste).
  const preparo = await teste.from("copia_lotes").delete().gt("id", 0);
  if (preparo.error) throw new Error(`O banco de teste não está preparado (rode supabase/teste/copia_do_oficial.sql nele): ${preparo.error.message}`);

  for (const [tabela, chave] of TABELAS) {
    const linhas = await lerTudo(oficial, tabela, chave);
    const lotes = emLotes(linhas);
    for (const lote of lotes) {
      const { error } = await teste.from("copia_lotes").insert({ tabela, linhas: lote });
      if (error) throw new Error(`Envio de ${tabela} pro teste: ${error.message}`);
    }
    console.log(`${tabela}: ${linhas.length} linha(s) em ${lotes.length} lote(s)`);
  }

  const { data, error } = await teste.rpc("aplicar_copia", { forcar: FORCAR === "sim" || FORCAR === "true" });
  if (error) throw new Error(error.message);
  console.log("Cópia aplicada no teste:", JSON.stringify(data));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  copiar().catch((error) => {
    console.error(`Cópia NÃO aplicada: ${error.message}`);
    process.exit(1);
  });
}
