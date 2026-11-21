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
