import { supabase } from "./supabaseClient.js";

// Entradas x Saídas: resumo das notas fiscais (dominio_notas) por mês e acumulador, vindo da escrituração fiscal da Domínio. Cada linha:
// { m: "AAAA-MM", t: "S"|"E"|"V", a: código do acumulador, n: nome, notas, vcon (valor contábil), vprod (valor dos itens), itens (linhas), qtd (peças) }.
export async function fetchNotas(companyId) {
  if (!companyId) return [];
  const { data, error } = await supabase.from("dominio_notas").select("ano, dados, synced_at").eq("company_id", companyId).order("ano", { ascending: false });
  if (error) throw error;
  return data || [];
}

export const TIPOS = [
  { id: "S", nome: "Saídas", curto: "Saídas" },
  { id: "V", nome: "Serviços prestados", curto: "Serviços" },
  { id: "E", nome: "Entradas", curto: "Entradas" },
];

const norm = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Sugestão inicial de quais acumuladores contam (o usuário corrige): saídas = vendas; serviços = todos; entradas = compra de mercadoria/insumo.
// Fora: devolução, retorno, remessa, bonificação, demonstração, transferência, conserto, brinde, amostra, outras, inutilizada/cancelada.
const FORA = /devol|retorno|remessa|bonific|demonst|transfer|conserto|brinde|doac|amostra|outras|garantia|comodato|emprest|inutiliz|cancel/;
export function sugerirConsiderar(tipo, nome) {
  const n = norm(nome);
  if (/inutiliz|cancel/.test(n)) return false;
  if (tipo === "V") return true;
  if (FORA.test(n)) return false;
  if (tipo === "S") return /vend|(^|\s)v de /.test(n);
  return /compra|aquis/.test(n) && /merc|insumo|materia|revenda|produ|\bind\b/.test(n) && !/imobiliz|uso e cons|uso cons/.test(n);
}

// A escolha explícita do usuário (config.flags[tipo][codigo]) vence a sugestão.
export function considerado(config, tipo, codigo, nome) {
  const escolha = config?.flags?.[tipo]?.[String(codigo)];
  return typeof escolha === "boolean" ? escolha : sugerirConsiderar(tipo, nome);
}

export const CONFIG_PADRAO = { base: "nota", valor: "nota", flags: {} };

/**
 * Junta as notas de uma ou mais empresas (grupo) num período e devolve:
 *  - tabela: por tipo, uma linha por acumulador (empresa: pelo código; grupo: pelo nome), com os totais e se conta ("sim" | "nao" | "parcial");
 *  - meses: por mês, só o que conta (valor, nº de notas, nº de itens/peças) em saídas, serviços e entradas.
 * `base`: "nota" (ticket por nº de notas) | "item" (por peças); `valor`: "nota" (valor contábil) | "itens" (valor dos produtos/serviços).
 */
export function montarEntradasSaidas({ membros, brutos, ano, mesDe, mesAte, base = "nota", valor = "nota", ehGrupo = false }) {
  const valorDe = (l) => (valor === "itens" ? Number(l.vprod) || 0 : Number(l.vcon) || 0);
  const contagem = (l) => (base === "item" ? (l.qtd != null ? Number(l.qtd) : Number(l.itens)) || 0 : Number(l.notas) || 0);
  const meses = Array.from({ length: 12 }, (_, i) => ({ m: `${ano}-${String(i + 1).padStart(2, "0")}`, S: { v: 0, c: 0 }, V: { v: 0, c: 0 }, E: { v: 0, c: 0 } }));
  const tabela = { S: new Map(), V: new Map(), E: new Map() };
  for (const membro of membros) {
    const linhaAno = (brutos?.[membro.id] || []).find((item) => item.ano === ano);
    const config = membro.notasConfig || CONFIG_PADRAO;
    for (const l of linhaAno?.dados?.linhas || []) {
      const mesIdx = Number(String(l.m).slice(5, 7)) - 1;
      if (mesIdx + 1 < mesDe || mesIdx + 1 > mesAte || !tabela[l.t]) continue;
      const conta = considerado(config, l.t, l.a, l.n);
      const chave = ehGrupo ? norm(l.n).replace(/[^a-z0-9]+/g, " ").trim() : String(l.a);
      const linha = tabela[l.t].get(chave) || { chave, codigo: l.a, nome: l.n, notas: 0, itens: 0, qtd: 0, vcon: 0, vprod: 0, sim: 0, nao: 0, vInc: 0 };
      linha.notas += Number(l.notas) || 0;
      linha.itens += Number(l.itens) || 0;
      linha.qtd += l.qtd != null ? Number(l.qtd) || 0 : Number(l.itens) || 0;
      linha.vcon += Number(l.vcon) || 0;
      linha.vprod += Number(l.vprod) || 0;
      if (conta) linha.sim += 1;
      else linha.nao += 1;
      tabela[l.t].set(chave, linha);
      if (conta) {
        meses[mesIdx][l.t].v += valorDe(l);
        meses[mesIdx][l.t].c += contagem(l);
      }
    }
  }
  const linhas = {};
  for (const t of Object.keys(tabela)) {
    linhas[t] = [...tabela[t].values()]
      .map((linha) => ({ ...linha, conta: linha.sim && linha.nao ? "parcial" : linha.sim ? "sim" : "nao" }))
      .sort((a, b) => (valor === "itens" ? b.vprod - a.vprod : b.vcon - a.vcon));
  }
  const soma = (t, campo) => meses.reduce((s, m) => s + m[t][campo], 0);
  const totais = { S: { v: soma("S", "v"), c: soma("S", "c") }, V: { v: soma("V", "v"), c: soma("V", "c") }, E: { v: soma("E", "v"), c: soma("E", "c") } };
  const fat = totais.S.v + totais.V.v;
  const cont = totais.S.c + totais.V.c;
  return { linhas, meses, totais, faturamento: fat, vendas: cont, ticket: cont ? fat / cont : null, saldo: fat - totais.E.v, valorDe, contagem };
}
