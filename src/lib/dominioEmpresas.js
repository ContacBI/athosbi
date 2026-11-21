import { supabase } from "./supabaseClient.js";

// Lista das empresas cadastradas na DOMÍNIO (tabela dominio_empresas; a Central manda 1x por dia, só leitura da Domínio). Usada no cadastro de empresa do console:
// digita o código da Domínio e já vêm o nome e o CNPJ; também avisa quando o código/CNPJ digitado não bate com a Domínio (a Central recusa o envio nesse caso).
// Só a equipe lê (RLS): cliente nunca chega aqui.

const norm = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

/** "0002" -> "2", "001" -> "1" (a Domínio guarda o código como número). */
export const semZeros = (valor) => String(valor ?? "").trim().replace(/^0+(?=\d)/, "");

let memoria = null; // { lista, quando } — a lista tem ~500 linhas; vale reaproveitar entre aberturas do editor

export async function carregarEmpresasDominio({ forcar = false } = {}) {
  if (memoria && !forcar && Date.now() - memoria.quando < 10 * 60_000) return memoria.lista;
  const lista = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from("dominio_empresas").select("codigo, nome, cnpj, cidade, uf, situacao").order("codigo").range(de, de + 999);
    if (error) throw error;
    lista.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  memoria = { lista, quando: Date.now() };
  return lista;
}

export function limparListaDominio() {
  memoria = null;
}

/** A empresa da Domínio com esse código (ou null). */
export function acharPorCodigo(lista, codigo) {
  const c = semZeros(codigo);
  return c && lista ? lista.find((empresa) => empresa.codigo === c) || null : null;
}

/** Empresas da Domínio com esse CNPJ (matriz e filiais compartilham a raiz, mas o CNPJ completo costuma ser único; pode vir mais de uma). */
export function acharPorCnpj(lista, cnpj) {
  const d = soDigitos(cnpj);
  return d.length === 14 && lista ? lista.filter((empresa) => empresa.cnpj === d) : [];
}

/**
 * Sugestões enquanto digita: código exato primeiro, depois código começando com o digitado, nome começando com, nome contendo e CNPJ contendo (a partir de 4 dígitos).
 * Ativas antes das inativas; no empate, pelo código.
 */
export function sugerirEmpresas(lista, termo, { limite = 8 } = {}) {
  const texto = norm(termo).trim();
  if (!texto || !lista) return [];
  const digitos = soDigitos(texto);
  const codigo = semZeros(digitos);
  const pontos = (empresa) => {
    const nome = norm(empresa.nome);
    if (codigo && empresa.codigo === codigo) return 0;
    if (codigo && texto === digitos && empresa.codigo.startsWith(codigo)) return 1;
    if (nome.startsWith(texto)) return 2;
    if (nome.includes(texto)) return 3;
    if (digitos.length >= 4 && (empresa.cnpj || "").includes(digitos)) return 3;
    return -1;
  };
  return lista
    .map((empresa) => ({ empresa, p: pontos(empresa) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => a.p - b.p || (a.empresa.situacao === "I") - (b.empresa.situacao === "I") || Number(a.empresa.codigo) - Number(b.empresa.codigo))
    .slice(0, limite)
    .map((x) => x.empresa);
}

/**
 * Compara o que está digitado no cadastro (código e CNPJ) com a Domínio. Resultado:
 *  { tipo: "sem-lista" }                        — a Central ainda não mandou a lista;
 *  { tipo: "vazio" }                            — sem código digitado;
 *  { tipo: "ok", empresa }                      — o código existe e o CNPJ confere (ou o CNPJ ainda não foi digitado);
 *  { tipo: "cnpj-diferente", empresa }          — o código existe, mas com outro CNPJ (a Central vai recusar o envio dessa empresa);
 *  { tipo: "codigo-inexistente" }               — nenhum cadastro da Domínio com esse código.
 */
export function conferirComDominio(lista, { codigo, cnpj }) {
  if (!lista || !lista.length) return { tipo: "sem-lista" };
  if (!semZeros(codigo)) return { tipo: "vazio" };
  const empresa = acharPorCodigo(lista, codigo);
  if (!empresa) return { tipo: "codigo-inexistente" };
  const digitos = soDigitos(cnpj);
  if (digitos.length === 14 && empresa.cnpj && empresa.cnpj !== digitos) return { tipo: "cnpj-diferente", empresa };
  return { tipo: "ok", empresa };
}

/** Empresas do portal que já usam esse código ou esse CNPJ (pra avisar de cadastro duplicado), fora a que está sendo editada. */
export function jaCadastradas(companies, { codigo, cnpj, idAtual }) {
  const c = semZeros(codigo);
  const d = soDigitos(cnpj);
  return (companies || []).filter((empresa) => empresa.id !== idAtual && ((c && semZeros(empresa.codigo) === c) || (d.length === 14 && soDigitos(empresa.cnpj) === d)));
}
