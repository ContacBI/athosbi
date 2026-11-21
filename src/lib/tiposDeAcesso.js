import { BLOCOS_ENTRADAS_SAIDAS, abasDoAlvo, configHerdada, todasAsChaves } from "./visibilidade.js";
import { modulosAplicaveisAoAlvo } from "./modulos.js";

// Tipos de acesso (21/11/2026): "Financeiro", "Comercial", "Marketing"… — cada empresa/grupo escolhe, pessoa a pessoa, o tipo de acesso, e cada tipo diz o que dá direito
// (abas e itens do B.I., áreas do menu, Ferramentas). Os três modelos abaixo vêm PRÉ-PREENCHIDOS como ponto de partida (a equipe ajusta depois); a equipe cria outros à vontade.
// Guardado em `visibilidade.perfis` (ver lib/visibilidade.js › configDaPessoa).

const norm = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// `abas`: regra pelo NOME da aba do B.I. da empresa (as abas são montadas por empresa, então o modelo procura por nome); `modulos`: módulos das Ferramentas que o tipo recebe.
export const MODELOS_TIPO = [
  { id: "financeiro", nome: "Financeiro", abas: /demonstrativ|indicador|resumo|fluxo|balan|dre|caixa|financ/, modulos: ["carga-tributaria", "orcamento", "analise-desempenho", "entradas-saidas", "dre-gerencial"], texto: "Demonstrativos, indicadores e as ferramentas de números." },
  { id: "comercial", nome: "Comercial", abas: /resumo|grafic|vend|comerc|indicador/, modulos: ["entradas-saidas", "analise-desempenho"], texto: "Resumo, gráficos e as ferramentas de vendas." },
  { id: "marketing", nome: "Marketing", abas: /resumo|grafic|marketing|vend/, modulos: ["analise-desempenho"], texto: "Resumo e gráficos, sem os números detalhados." },
];

/**
 * O que um modelo libera numa empresa/grupo específico. `contexto`: { abas (abasDoAlvo), chaves (todasAsChaves), modulosAplicaveis (ids), blocos (ids dos blocos do Entradas x Saídas) }.
 * Se nenhuma aba da empresa combina com o nome do modelo, libera todas (pra não nascer vazio). Devolve conjuntos prontos pro editor: { visiveis, modulos, areasOcultas }.
 */
export function conjuntosDoModelo(modeloId, { abas = [], chaves = [], modulosAplicaveis = [], blocos = [] } = {}) {
  const modelo = MODELOS_TIPO.find((m) => m.id === modeloId);
  if (!modelo) return { visiveis: new Set(), modulos: new Set(), areasOcultas: new Set() };
  const combinam = abas.filter((aba) => modelo.abas.test(norm(aba.name)));
  const escolhidas = combinam.length ? combinam : abas;
  const visiveis = new Set(
    chaves.filter((chave) => escolhidas.some((aba) => chave === `bi:tab:${aba.id}` || chave.startsWith(`bi:sub:${aba.id}:`) || chave.startsWith(`bi:w:${aba.id}:`)))
  );
  const modulos = new Set(modelo.modulos.filter((id) => modulosAplicaveis.includes(id)));
  if (modulos.has("entradas-saidas")) blocos.forEach((id) => visiveis.add(id));
  return { visiveis, modulos, areasOcultas: new Set() };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Atribuir o tipo de acesso a uma pessoa numa empresa/grupo (usado pelo formulário "Novo acesso", em Parâmetros › Acessos).
// ---------------------------------------------------------------------------------------------------------------------------------------
const copia = (valor) => JSON.parse(JSON.stringify(valor ?? {}));

/** A visibilidade que vale hoje pra empresa/grupo (a própria, ou a herdada do grupo quando a empresa não tem). */
export function visibilidadeEfetiva(item, ehGrupo, groups) {
  return (!ehGrupo && configHerdada(item, groups)?.visibilidade) || item?.visibilidade || {};
}

/** Tipo de acesso que a pessoa tem hoje nessa empresa/grupo ("" = padrão). */
export function tipoAtual(item, ehGrupo, email, groups) {
  const v = visibilidadeEfetiva(item, ehGrupo, groups);
  const id = v.perfilPorPessoa?.[String(email || "").trim().toLowerCase()];
  return id && (v.perfis || []).some((p) => p.id === id) ? id : "";
}

/** Os tipos já criados nessa empresa/grupo: [{ id, nome }]. */
export function tiposDoAlvo(item, ehGrupo, groups) {
  return (visibilidadeEfetiva(item, ehGrupo, groups).perfis || []).map((p) => ({ id: p.id, nome: p.nome }));
}

/**
 * A `visibilidade` nova depois de dar o tipo `tipoId` à pessoa ("" = volta ao padrão). Se o tipo é um dos modelos (financeiro, comercial, marketing) e a empresa/grupo ainda não
 * o tem, cria já pré-preenchido. Parte da configuração que vale hoje (a empresa que herdava do grupo leva a cópia inteira, pra não perder a herança). Quem chama grava.
 */
export function visibilidadeComTipo({ item, ehGrupo, email, tipoId, companies, groups }) {
  const base = copia(visibilidadeEfetiva(item, ehGrupo, groups));
  const perfis = base.perfis || [];
  const modelo = MODELOS_TIPO.find((m) => m.id === tipoId);
  if (tipoId && modelo && !perfis.some((p) => p.id === tipoId)) {
    const conjuntos = conjuntosDoModelo(tipoId, {
      abas: abasDoAlvo(item),
      chaves: todasAsChaves(item),
      modulosAplicaveis: modulosAplicaveisAoAlvo(item, ehGrupo, companies).map((m) => m.id),
      blocos: BLOCOS_ENTRADAS_SAIDAS.map((b) => b.id),
    });
    perfis.push({ id: tipoId, nome: modelo.nome, modo: "marcados", visiveis: [...conjuntos.visiveis].sort(), modulos: [...conjuntos.modulos].sort(), areasOcultas: [] });
  }
  const mapa = { ...(base.perfilPorPessoa || {}) };
  const chave = String(email || "").trim().toLowerCase();
  if (tipoId && perfis.some((p) => p.id === tipoId)) mapa[chave] = tipoId;
  else delete mapa[chave];
  if (perfis.length) {
    base.perfis = perfis;
    base.perfilPorPessoa = mapa;
  } else {
    delete base.perfis;
    delete base.perfilPorPessoa;
  }
  return base;
}
