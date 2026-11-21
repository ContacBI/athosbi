import { supabase } from "./supabaseClient.js";

// Revisa Nota (conferidor de NF-e IBS/CBS) no portal: produtos com a classificação decidida pelo escritório e compradores com o perfil confirmado, vindos do app do escritório
// (função revisa-nota → tabela revisa_nota, uma linha por empresa e por tipo). O portal só LÊ; cadastrar e pedir mudança continua no portal do Revisa Nota.
export const PORTAL_REVISA_NOTA = "https://revisa-nota-piloto.vercel.app/";

/** As listas de uma empresa: { produtos: { geradoEm, de, ate, produtos: [...] } | null, clientes: { ... } | null, resumos: { ano, meses, ufs, totais, produtos } | null, lei: { versao, anexos, complementos } | null, atualizadoEm }. */
export async function fetchRevisaNota(companyId) {
  if (!companyId) return { produtos: null, clientes: null, resumos: null, lei: null, atualizadoEm: null };
  const { data, error } = await supabase.from("revisa_nota").select("tipo, dados, synced_at").eq("company_id", companyId);
  if (error) throw error;
  const por = Object.fromEntries((data || []).map((linha) => [linha.tipo, linha]));
  const datas = (data || []).map((linha) => linha.synced_at).filter(Boolean).sort();
  return { produtos: por.produtos?.dados || null, clientes: por.clientes?.dados || null, resumos: por.resumos?.dados || null, lei: por.lei?.dados || null, atualizadoEm: datas.length ? datas[datas.length - 1] : null };
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

/** Itens da lei que podem descrever o produto (do mais parecido para o menos), já com os dados do dicionário e a parecença com a descrição. Se o escritório decidiu por um item que a lei
 *  não casa com o NCM (decisão manual), ele entra no fim da lista para a decisão aparecer completa. */
export function opcoesDoProduto(produto, lei) {
  const cp = produto?.cp || {};
  const lista = (produto?.cand || []).map((k) => ({
    k,
    ...(lei?.[k] || { anexo: k.split("|")[0], item: k.split("|")[1], descricao: "", rotulo: "", reducao: null, codigos: [] }),
    confianca: cp[k]?.c || "",
    palavras: cp[k]?.p || [],
  }));
  const d = produto?.decisao;
  const kd = d?.anexo ? `${d.anexo}|${d.item}` : "";
  if (kd && !lista.some((o) => o.k === kd)) {
    const base = lei?.[kd];
    lista.push({
      k: kd, anexo: d.anexo, item: String(d.item), descricao: base?.descricao || d.itemTexto || "", rotulo: base?.rotulo || d.tratamento || "", reducao: base?.reducao ?? null, ncmLei: base?.ncmLei || d.ncmLei || "",
      alinea: base?.alinea || "", codigos: base?.codigos || (d.cClassTrib ? [{ cClassTrib: d.cClassTrib, cst: d.cst || "", nome: "" }] : []), confianca: "", palavras: [], decididoManual: true,
    });
  }
  return lista;
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

// ---------------------------------------------------------------------------------------------------------------------------------------
// Pedidos do cliente (produto novo, mudança de classificação, perfil de comprador) e a conversa de observações de cada um (etapa 2). Tabelas revisa_nota_pedidos e
// revisa_nota_observacoes; o cliente só cria pedido/observação pelas funções revisa_nota_criar_pedido e revisa_nota_observar (checam o acesso à empresa).
// ---------------------------------------------------------------------------------------------------------------------------------------
export const TIPOS_DE_PEDIDO = { novo: "Produto novo", alteracao: "Mudança de classificação", perfil: "Perfil de comprador" };
export const STATUS_DE_PEDIDO = {
  enviado: { nome: "Novo", tom: "azul" },
  em_analise: { nome: "Em análise", tom: "ambar" },
  cadastrado: { nome: "Aprovado", tom: "verde" },
  recusado: { nome: "Recusado", tom: "cinza" },
};
export const pedidoAberto = (pedido) => pedido?.status === "enviado" || pedido?.status === "em_analise";

/** Chave do alvo de um pedido: produto = "filial|código"; comprador = a chave dele na lista. */
export const alvoDoProduto = (produto) => `${produto.emp}|${produto.codigo}`;

export async function fetchPedidos(companyId) {
  if (!companyId) return [];
  const [{ data: pedidos, error }, { data: obs, error: erroObs }] = await Promise.all([
    supabase.from("revisa_nota_pedidos").select("id, tipo, alvo, descricao, ncm, unidade, proposta, status, resposta, criado_por, criado_em, atualizado_em").eq("company_id", companyId).order("criado_em", { ascending: false }).limit(500),
    supabase.from("revisa_nota_observacoes").select("id, pedido_id, autor, autor_nome, texto, criado_em").eq("company_id", companyId).order("criado_em", { ascending: true }).limit(5000),
  ]);
  if (error) throw error;
  if (erroObs) throw erroObs;
  const porPedido = new Map();
  for (const o of obs || []) porPedido.set(o.pedido_id, [...(porPedido.get(o.pedido_id) || []), o]);
  return (pedidos || []).map((p) => ({ ...p, observacoes: porPedido.get(p.id) || [] }));
}

export async function criarPedido({ companyId, tipo, alvo, descricao = "", ncm = "", unidade = "UN", proposta }) {
  const { data, error } = await supabase.rpc("revisa_nota_criar_pedido", { p_company: companyId, p_tipo: tipo, p_alvo: alvo, p_descricao: descricao, p_ncm: ncm, p_unidade: unidade, p_proposta: proposta });
  if (error) throw new Error(error.message || "Não consegui enviar o pedido.");
  return data;
}

export async function observarPedido(pedidoId, texto) {
  const { data, error } = await supabase.rpc("revisa_nota_observar", { p_pedido: pedidoId, p_texto: texto });
  if (error) throw new Error(error.message || "Não consegui enviar a observação.");
  return data;
}

/** Pedidos de um alvo (e de um tipo, se informado), do mais novo para o mais antigo. */
export const pedidosDoAlvo = (pedidos, alvo, tipo) => (pedidos || []).filter((p) => p.alvo === alvo && (!tipo || p.tipo === tipo));

const ROTULO_PERFIL = { privado: "Privado", publico: "Órgão público", sus_cebas: "SUS com CEBAS", verificar: "A verificar" };
/** Uma frase com o que o cliente pediu. */
export function resumoDoPedido(pedido) {
  const p = pedido?.proposta || {};
  if (pedido?.tipo === "perfil") return `${ROTULO_PERFIL[p.tipo] || p.tipo || ""}${p.cebasValidade ? ` · CEBAS até ${p.cebasValidade}` : ""}`;
  if (pedido?.tipo === "novo") return `NCM ${ncmFormatado(pedido.ncm)} · ${pedido.unidade || "UN"}`;
  if (p.status === "duvida") return "Em dúvida";
  if (p.anexo) return `Anexo ${p.anexo} · item ${p.item}${p.cClassTrib ? ` · ${p.cClassTrib}` : ""}`;
  return p.cClassTrib === "000001" ? "Tributação integral" : p.cClassTrib || "";
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Andamento do pedido e avisos de mensagem nova (aba Cadastro).
// ---------------------------------------------------------------------------------------------------------------------------------------
/** As três etapas do pedido (Enviado → Em análise → Aprovado/Recusado), cada uma com o horário quando se sabe. */
export function etapasDoPedido(pedido) {
  const doEscritorio = (pedido?.observacoes || []).filter((o) => o.autor === "escritorio");
  const final = pedido?.status === "cadastrado" || pedido?.status === "recusado";
  const analise = pedido?.status === "enviado" ? null : doEscritorio[0]?.criado_em || (pedido?.status === "em_analise" ? pedido.atualizado_em : null);
  return [
    { id: "enviado", nome: "Enviado", quando: pedido?.criado_em || null, estado: "feito" },
    { id: "analise", nome: "Em análise", quando: analise, estado: pedido?.status === "enviado" ? "pendente" : "feito" },
    { id: "final", nome: pedido?.status === "recusado" ? "Recusado" : "Aprovado", quando: final ? pedido.atualizado_em : null, estado: !final ? "pendente" : pedido.status === "recusado" ? "recusado" : "feito" },
  ];
}

/** O que o cliente já viu de um pedido: a última mensagem do escritório e a situação naquele momento. */
export function marcaDeLeitura(pedido) {
  const doEscritorio = (pedido?.observacoes || []).filter((o) => o.autor === "escritorio");
  return { t: doEscritorio.length ? doEscritorio[doEscritorio.length - 1].criado_em : "", s: pedido?.status || "enviado" };
}

/** O pedido tem novidade do escritório (mensagem nova ou situação diferente) desde a última vez que o cliente viu? */
export function temNovidade(pedido, lida) {
  const visto = lida || { t: "", s: "enviado" };
  const atual = marcaDeLeitura(pedido);
  return atual.t > (visto.t || "") || atual.s !== visto.s;
}

/** Texto curto do que mudou, para o aviso. */
export function textoDaNovidade(pedido, lida) {
  const visto = lida || { t: "", s: "enviado" };
  const atual = marcaDeLeitura(pedido);
  if (atual.t > (visto.t || "")) return "O escritório respondeu";
  if (atual.s === "cadastrado") return "Pedido aprovado";
  if (atual.s === "recusado") return "Pedido recusado";
  if (atual.s === "em_analise") return "Pedido em análise";
  return "Pedido atualizado";
}

/** A última novidade do escritório num pedido (resposta na conversa, aprovação ou recusa), para a lista do sininho; null se o escritório ainda não fez nada. */
export function eventoDoPedido(pedido) {
  const doEscritorio = (pedido?.observacoes || []).filter((o) => o.autor === "escritorio");
  const ultima = doEscritorio[doEscritorio.length - 1] || null;
  const final = pedido?.status === "cadastrado" || pedido?.status === "recusado";
  if (final) {
    const quando = !ultima || String(pedido.atualizado_em) >= String(ultima.criado_em) ? pedido.atualizado_em : ultima.criado_em;
    return { quando, titulo: pedido.status === "cadastrado" ? "Pedido aprovado" : "Pedido recusado", texto: pedido.resposta || ultima?.texto || "" };
  }
  if (ultima) return { quando: ultima.criado_em, titulo: "O escritório respondeu", texto: ultima.texto };
  if (pedido?.status === "em_analise") return { quando: pedido.atualizado_em, titulo: "Pedido em análise", texto: "" };
  return null;
}
