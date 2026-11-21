import { supabase } from "./supabaseClient.js";

// Revisa Nota (conferidor de NF-e IBS/CBS) no portal: produtos com a classificação decidida pelo escritório e compradores com o perfil confirmado, vindos do app do escritório
// (função revisa-nota → tabela revisa_nota, uma linha por empresa e por tipo). O portal só LÊ; cadastrar e pedir mudança continua no portal do Revisa Nota.
export const PORTAL_REVISA_NOTA = "https://revisa-nota-piloto.vercel.app/";

/** As listas de uma empresa: { produtos: { geradoEm, de, ate, produtos: [...] } | null, clientes: { ... } | null, atualizadoEm }. */
export async function fetchRevisaNota(companyId) {
  if (!companyId) return { produtos: null, clientes: null, atualizadoEm: null };
  const { data, error } = await supabase.from("revisa_nota").select("tipo, dados, synced_at").eq("company_id", companyId);
  if (error) throw error;
  const por = Object.fromEntries((data || []).map((linha) => [linha.tipo, linha]));
  const datas = (data || []).map((linha) => linha.synced_at).filter(Boolean).sort();
  return { produtos: por.produtos?.dados || null, clientes: por.clientes?.dados || null, atualizadoEm: datas.length ? datas[datas.length - 1] : null };
}

const norm = (texto) => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Situação de um produto: "decidido" (classificado), "duvida" (escritório marcou em dúvida) ou "pendente" (ainda sem decisão). */
export const situacaoDoProduto = (produto) => (produto?.decisao?.status === "decidido" ? "decidido" : produto?.decisao?.status === "duvida" ? "duvida" : "pendente");

export const SITUACOES = [
  { id: "decidido", nome: "Classificados" },
  { id: "duvida", nome: "Em dúvida" },
  { id: "pendente", nome: "Pendentes" },
];

/** Números do topo da tela de produtos (quantidade e valor vendido por situação). */
export function resumoDeProdutos(produtos) {
  const total = { qtd: 0, valor: 0 };
  const por = { decidido: { qtd: 0, valor: 0 }, duvida: { qtd: 0, valor: 0 }, pendente: { qtd: 0, valor: 0 } };
  for (const produto of produtos || []) {
    const valor = Number(produto.valor) || 0;
    const sit = por[situacaoDoProduto(produto)];
    sit.qtd += 1;
    sit.valor += valor;
    total.qtd += 1;
    total.valor += valor;
  }
  return { total, ...por };
}

/** Filtra e ordena (maior valor vendido primeiro): `busca` olha código, descrição e NCM; `situacao` "todos" ou uma de SITUACOES; `tratamento` "todos" ou o texto exato. */
export function filtrarProdutos(produtos, { busca = "", situacao = "todos", tratamento = "todos" } = {}) {
  const palavras = norm(busca).split(" ").filter(Boolean);
  return (produtos || [])
    .filter((produto) => {
      if (situacao !== "todos" && situacaoDoProduto(produto) !== situacao) return false;
      if (tratamento !== "todos" && (produto.decisao?.tratamento || "") !== tratamento) return false;
      if (!palavras.length) return true;
      const texto = norm(`${produto.codigo} ${produto.descricao} ${produto.ncm}`);
      return palavras.every((palavra) => texto.includes(palavra));
    })
    .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));
}

export const PERFIS = [
  { id: "privado", nome: "Privado" },
  { id: "publico", nome: "Público" },
  { id: "sus_cebas", nome: "SUS / CEBAS" },
  { id: "verificar", nome: "A verificar" },
];

/** Perfil de um comprador: o confirmado pelo escritório, ou "sem" quando ainda não foi confirmado. */
export const perfilDoCliente = (cliente) => cliente?.perfil?.tipo || "sem";

export function resumoDeClientes(clientes) {
  const total = { qtd: 0, valor: 0 };
  const por = { privado: { qtd: 0, valor: 0 }, publico: { qtd: 0, valor: 0 }, sus_cebas: { qtd: 0, valor: 0 }, verificar: { qtd: 0, valor: 0 }, sem: { qtd: 0, valor: 0 } };
  for (const cliente of clientes || []) {
    const valor = Number(cliente.valor) || 0;
    const alvo = por[perfilDoCliente(cliente)] || por.sem;
    alvo.qtd += 1;
    alvo.valor += valor;
    total.qtd += 1;
    total.valor += valor;
  }
  return { total, ...por };
}

/** Filtra e ordena (maior valor comprado primeiro): `busca` olha nome, documento, cidade e UF; `perfil` "todos" | "sem" | um de PERFIS. */
export function filtrarClientes(clientes, { busca = "", perfil = "todos", uf = "todos" } = {}) {
  const palavras = norm(busca).split(" ").filter(Boolean);
  return (clientes || [])
    .filter((cliente) => {
      if (perfil !== "todos" && perfilDoCliente(cliente) !== perfil) return false;
      if (uf !== "todos" && cliente.uf !== uf) return false;
      if (!palavras.length) return true;
      const texto = norm(`${cliente.nome} ${cliente.doc} ${cliente.municipio} ${cliente.uf}`);
      return palavras.every((palavra) => texto.includes(palavra));
    })
    .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Classificação de cada produto, no jeito do app do escritório: o que a lei diz do NCM (itens possíveis), o que o escritório decidiu e o que a tabela oficial permite de cClassTrib.
// `lei` = dicionário que vem junto da lista ("XII|5" → { anexo, item, descricao, rotulo, reducao, codigos: [{ cClassTrib, nome }] }).
// ---------------------------------------------------------------------------------------------------------------------------------------
export const ncmFormatado = (ncm) => {
  const n = String(ncm ?? "").replace(/\D/g, "");
  return n.length === 8 ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : String(ncm ?? "");
};

/** "100% · alíq. zero" / "60%": a redução do IBS/CBS prevista na lei. */
export function rotuloDaReducao(reducao, rotulo) {
  if (reducao == null) return "";
  if (Number(reducao) === 100) return "100% · alíq. zero";
  return `${reducao}%${rotulo && !/redu/i.test(rotulo) ? ` · ${rotulo}` : ""}`;
}

/** Itens da lei que podem descrever o produto (do mais parecido para o menos), já com os dados do dicionário. */
export function opcoesDoProduto(produto, lei) {
  return (produto?.cand || []).map((k) => ({ k, ...(lei?.[k] || { anexo: k.split("|")[0], item: k.split("|")[1], descricao: "", rotulo: "", reducao: null, codigos: [] }) }));
}

/** O que as colunas LC / Anexo / Item / % mostram: a decisão do escritório quando há; senão, o que a lei permite para o NCM. */
export function resumoDaClassificacao(produto, lei) {
  const d = produto?.decisao;
  const opcoes = opcoesDoProduto(produto, lei);
  if (d?.status === "decidido" && d.anexo) {
    const o = opcoes.find((x) => x.anexo === d.anexo && String(x.item) === String(d.item)) || lei?.[`${d.anexo}|${d.item}`];
    return { lc: Boolean(produto.lc), anexos: [d.anexo], itens: [String(d.item || "")].filter(Boolean), pct: [rotuloDaReducao(o?.reducao, o?.rotulo) || d.tratamento || ""].filter(Boolean), decidido: true };
  }
  const anexos = [...new Set(opcoes.map((o) => o.anexo))];
  return {
    lc: Boolean(produto?.lc),
    anexos,
    itens: opcoes.map((o) => String(o.item)),
    pct: [...new Set(opcoes.map((o) => rotuloDaReducao(o.reducao, o.rotulo)).filter(Boolean))],
    decidido: false,
  };
}

/** O que a coluna Decisão mostra: "Anexo IV · 62", "Integral", "Em dúvida" ou "Pendente". */
export function rotuloDaDecisao(produto) {
  const d = produto?.decisao;
  if (d?.status === "decidido") return d.anexo ? `Anexo ${d.anexo} · ${d.item}` : "Integral";
  if (d?.status === "duvida") return "Em dúvida";
  return "Pendente";
}

/** Todos os códigos de cClassTrib que a tabela oficial permite para os itens possíveis do produto (sem repetir), com o anexo de onde vêm. */
export function codigosPossiveis(produto, lei) {
  const vistos = new Map();
  for (const o of opcoesDoProduto(produto, lei)) {
    for (const c of o.codigos || []) {
      const atual = vistos.get(c.cClassTrib) || { cClassTrib: c.cClassTrib, nome: c.nome, anexos: new Set() };
      atual.anexos.add(o.anexo);
      vistos.set(c.cClassTrib, atual);
    }
  }
  return [...vistos.values()].map((c) => ({ ...c, anexos: [...c.anexos] }));
}
