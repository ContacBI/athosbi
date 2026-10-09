import { FONTE, ITENS, NBS, NCM, TRATAMENTOS } from "./anexosLc214.js";

// Em quais anexos da LC 214/2025 um NCM (produto, 8 dígitos) ou NBS
// (serviço, 9 dígitos) se enquadra, com a redução do IBS/CBS. Mesma regra da
// Calculadora da Reforma (RFB) — `ncmAplicavel`: por tratamento (cClassTrib),
// o código precisa começar por algum prefixo do anexo; se uma exceção também
// o cobre, só vale se houver um vínculo "limpo" (sem exceção) cobrindo.
//
// É SUGESTÃO: vários itens dos anexos ainda limitam pela descrição do
// produto (ex.: "Stent vascular" num NCM com outras coisas), por isso a tela
// mostra o texto do item pra conferir.

export { FONTE as FONTE_LC214 };

const CATEGORIA_DA_REDUCAO = { 100: "zero", 60: "red60" };

export function enquadramentosLc214(codigo, tipo = "mercadoria") {
  const digitos = String(codigo || "").replace(/\D/g, "");
  const servico = tipo === "servico";
  if (digitos.length !== (servico ? 9 : 8)) return [];
  const porTratamento = new Map();
  for (const [prefixo, cClassTrib, item, excecoes] of servico ? NBS : NCM) {
    if (!digitos.startsWith(prefixo)) continue;
    if (!porTratamento.has(cClassTrib)) porTratamento.set(cClassTrib, []);
    porTratamento.get(cClassTrib).push({ item, excecoes });
  }
  const resultado = [];
  for (const [cClassTrib, vinculos] of porTratamento) {
    const excluido = vinculos.some((vinculo) => vinculo.excecoes.some((excecao) => digitos.startsWith(excecao)));
    const limpo = vinculos.some((vinculo) => vinculo.excecoes.length === 0);
    if (excluido && !limpo) continue;
    const tratamento = TRATAMENTOS[cClassTrib];
    const numero = (item) => Number(item.split("/")[1]) || 0;
    const itens = [...new Set(vinculos.map((vinculo) => vinculo.item).filter(Boolean))]
      .sort((a, b) => numero(a) - numero(b))
      .map((item) => ({ item, texto: ITENS[item] || "" }));
    resultado.push({ cClassTrib, ...tratamento, categoria: CATEGORIA_DA_REDUCAO[tratamento.reducao], itens });
  }
  // Sem condição antes (vale pra qualquer comprador); dentro disso, maior redução.
  return resultado.sort((a, b) => Number(Boolean(a.condicao)) - Number(Boolean(b.condicao)) || b.reducao - a.reducao);
}

// { principal, alternativas }: `principal` é o enquadramento que vale pra
// qualquer venda (null se só houver casos condicionados, ex.: venda ao SUS).
export function sugestaoLc214(codigo, tipo) {
  const lista = enquadramentosLc214(codigo, tipo);
  const principal = lista.find((item) => !item.condicao) || null;
  return { principal, alternativas: lista.filter((item) => item !== principal) };
}

// Categoria sugerida ("padrao" quando o código não está em anexo nenhum),
// ou null quando o código está incompleto/ausente (não dá pra dizer).
export function categoriaSugerida(codigo, tipo) {
  const digitos = String(codigo || "").replace(/\D/g, "");
  if (digitos.length !== (tipo === "servico" ? 9 : 8)) return null;
  return sugestaoLc214(codigo, tipo).principal?.categoria || "padrao";
}

export const rotuloAnexo = (enquadramento) => `Anexo ${enquadramento.anexo}${enquadramento.itens.length ? `, ${enquadramento.itens.length === 1 ? "item" : "itens"} ${enquadramento.itens.map((item) => item.item.split("/")[1]).join(", ")}` : ""}`;
