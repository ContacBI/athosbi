import { state } from "../data/useStore.js";

// Visibilidade por empresa/grupo (pedido do Izaias, 28/10/2026): a equipe configura UMA vez o que os clientes daquela empresa (ou grupo) enxergam; tudo
// começa visível e a equipe oculta o que quiser. A configuração mora no próprio cadastro da empresa/grupo (`visibilidade`):
//   { ocultos: ["bi:tab:<aba>", "bi:sub:<aba>:<subaba>", "bi:w:<aba>:<subaba|_>:<item>", "es:insights", ...], modulos?: ["orcamento", ...] }
// `modulos` (quando existe) é a lista de módulos complementares liberados pros clientes desta empresa/grupo; sem ela vale a ficha de cada pessoa.
// É só a TELA: quem tem acesso à empresa continua com o dado liberado no banco; a equipe sempre vê tudo (e a "visão do cliente" mostra o que o cliente vê).

export const kAba = (abaId) => `bi:tab:${abaId}`;
export const kSubaba = (abaId, subId) => `bi:sub:${abaId}:${subId}`;
export const kItem = (abaId, subId, itemId) => `bi:w:${abaId}:${subId || "_"}:${itemId}`;

// Blocos do módulo Entradas x Saídas que dá pra ocultar (os acumuladores são sempre só da equipe).
export const BLOCOS_ENTRADAS_SAIDAS = [
  { id: "es:kpis", nome: "Cartões de resumo" },
  { id: "es:insights", nome: "Leitura rápida (frases)" },
  { id: "es:comparativo", nome: "Comparativo entre as empresas (grupo)" },
  { id: "es:grafico", nome: "Gráfico mês a mês" },
];

/** Visibilidade configurada da empresa/grupo que está aberto agora. */
export function visibilidadeAtiva() {
  if (state.activeGroupId) return state.groups.find((group) => group.id === state.activeGroupId)?.visibilidade || null;
  return state.companies.find((company) => company.id === state.activeCompanyId)?.visibilidade || null;
}

/**
 * A equipe vê tudo; o cliente (ou a equipe na "visão do cliente") vê conforme a configuração da empresa/grupo:
 *  - modo "marcados" (o padrão novo, 29/10/2026): só aparece o que a equipe MARCOU (`visiveis`); item novo nasce desmarcado;
 *  - legado (`ocultos`): aparece tudo, menos o que foi ocultado — vale até a equipe abrir o "Acesso dos clientes" e salvar de novo;
 *  - sem configuração: aparece tudo (pra não tirar a tela de quem já usa antes de configurar).
 */
export function oculto(chave) {
  if (state.isAdmin || state.isColaborador) return false;
  const v = visibilidadeAtiva();
  if (v?.modo === "marcados") return !(v.visiveis || []).includes(chave);
  return (v?.ocultos || []).includes(chave);
}

/** Todas as chaves que dá pra marcar numa empresa/grupo (abas, subabas, itens do B.I e blocos do Entradas x Saídas). */
export function todasAsChaves(alvo) {
  const chaves = [];
  for (const aba of abasDoAlvo(alvo)) {
    chaves.push(kAba(aba.id));
    for (const item of aba.widgets || []) chaves.push(kItem(aba.id, null, item.id));
    for (const sub of aba.subTabs || []) {
      chaves.push(kSubaba(aba.id, sub.id));
      for (const item of sub.widgets || []) chaves.push(kItem(aba.id, sub.id, item.id));
    }
  }
  BLOCOS_ENTRADAS_SAIDAS.forEach((b) => chaves.push(b.id));
  return [...new Set(chaves)];
}

/** Módulos que a empresa/grupo aberto libera pros clientes — null = não configurado (vale a ficha da pessoa). */
export function modulosDaEmpresa() {
  const lista = visibilidadeAtiva()?.modulos;
  return Array.isArray(lista) ? lista : null;
}

/** Árvore de abas do B.I da empresa/grupo (a do cadastro, que é a que o cliente vê): [{ id, name, subTabs: [{ id, name, widgets }], widgets }]. */
export function abasDoAlvo(alvo) {
  const abas = Array.isArray(alvo?.dashboardTabs) ? alvo.dashboardTabs : [];
  return abas.map((aba) => ({ id: aba.id, name: aba.name, subTabs: aba.subTabs || [], widgets: aba.widgets || [] }));
}
