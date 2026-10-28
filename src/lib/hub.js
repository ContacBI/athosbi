import { EH_TESTE } from "./ambiente.js";
import { DONO_DA_CENTRAL } from "./uso.js";

// Hub novo (o portal com cara de site: Início, Meu B.I., Tributário,
// Serviços, Conteúdos, Ferramentas) é montado em paralelo ao portal de hoje
// (pedido do Izaias, 28/10/2026): só aparece no site de TESTE e só para os
// e-mails abaixo (os dois do Izaias). No oficial — e para clientes e
// colaboradores, em qualquer site — nada muda. Quando estiver pronto, é
// aqui que se liga para os outros.
const QUEM_VE_O_HUB = [DONO_DA_CENTRAL, "izaiasspaulino@gmail.com"];

export function hubLigado(st, ambienteTeste = EH_TESTE) {
  return Boolean(ambienteTeste) && QUEM_VE_O_HUB.includes(String(st?.userEmail || "").trim().toLowerCase());
}

// A tela de login nova não sabe ainda quem vai entrar — então só aparece
// no site de teste e no navegador onde o dono já entrou no hub (marca
// gravada pelo próprio hub, ver HubLayout).
const MARCA_DO_NAVEGADOR = "athosbi.hub.previa";

export function lembrarHubNoNavegador() {
  try {
    localStorage.setItem(MARCA_DO_NAVEGADOR, "1");
  } catch {
    // navegador sem armazenamento: só não lembra
  }
}

export function hubNoNavegador(ambienteTeste = EH_TESTE) {
  if (!ambienteTeste) return false;
  try {
    return localStorage.getItem(MARCA_DO_NAVEGADOR) === "1";
  } catch {
    return false;
  }
}

// "Portal atual" no topo do hub: volta pro Início de hoje até fechar a aba.
const PORTAL_ATUAL = "athosbi.hub.portalAtual";

export function preferirPortalAtual(sim) {
  try {
    if (sim) sessionStorage.setItem(PORTAL_ATUAL, "1");
    else sessionStorage.removeItem(PORTAL_ATUAL);
  } catch {
    // sem armazenamento: o hub continua sendo o início
  }
}

export function querPortalAtual() {
  try {
    return sessionStorage.getItem(PORTAL_ATUAL) === "1";
  } catch {
    return false;
  }
}

// As áreas do hub, na ordem do menu. `pronta` = já tem conteúdo de verdade;
// as outras abrem a página "em construção", que conta o que vai ter ali.
export const AREAS_DO_HUB = [
  { id: "inicio", nome: "Início", rota: "/hub", pronta: true },
  { id: "bi", nome: "Meu B.I.", rota: null, pronta: true, resumo: "Resultado, caixa, balanço e indicadores da empresa, fechados pelo escritório." },
  { id: "tributario", nome: "Tributário", rota: "/hub/tributario", pronta: true, resumo: "A Reforma Tributária explicada, com o simulador produto a produto." },
  {
    id: "servicos",
    nome: "Serviços",
    rota: "/hub/servicos",
    pronta: false,
    resumo: "Agenda de obrigações, guias para pagar e a troca de documentos com o escritório.",
    itens: ["Agenda de vencimentos da empresa, mês a mês", "Guias prontas para baixar e pagar", "Envio de documentos para o escritório, com protocolo", "Pedidos e chamados acompanhados até o fim"],
  },
  {
    id: "conteudos",
    nome: "Conteúdos",
    rota: "/hub/conteudos",
    pronta: false,
    resumo: "Artigos, notícias e explicações curtas da equipe, sem juridiquês.",
    itens: ["Radar tributário: o que mudou na semana", "Guias curtos para entender DRE, caixa e margem", "Explicações da Reforma por setor", "Tudo escrito e publicado pela própria equipe"],
  },
  {
    id: "ferramentas",
    nome: "Ferramentas",
    rota: "/hub/ferramentas",
    pronta: false,
    resumo: "Calculadoras para decisões do dia a dia.",
    itens: ["Custo real de um funcionário", "Pró-labore × distribuição de lucros", "Simples × Lucro Presumido", "Férias, 13º e rescisão"],
  },
];

// Reforma Tributária — o calendário da transição (EC 132/2023 e LC 214/2025).
export const LINHA_DA_REFORMA = [
  { ano: "2026", titulo: "Ano de teste", texto: "CBS (0,9%) e IBS (0,1%) passam a aparecer na nota fiscal, em caráter de teste." },
  { ano: "2027", titulo: "A CBS para valer", texto: "PIS e Cofins acabam e a CBS entra inteira. O IPI vai a zero (salvo Zona Franca) e começa o Imposto Seletivo." },
  { ano: "2029–2032", titulo: "Transição do ICMS e do ISS", texto: "ICMS e ISS caem aos poucos — 90%, 80%, 70% e 60% — enquanto o IBS sobe no lugar." },
  { ano: "2033", titulo: "Sistema novo completo", texto: "ICMS e ISS deixam de existir. Ficam IBS e CBS, o IVA dual, e o Imposto Seletivo." },
];

// Onde estamos na linha (0 a 1), para o trilho laranja. Os marcos ficam a
// distâncias iguais na tela (2026, 2027, 2029, 2033), então o andamento
// anda por trecho: out/2026 fica perto do fim do primeiro trecho.
const MARCOS = [2026, 2027, 2029, 2033];

export function andamentoDaReforma(hoje = new Date()) {
  const ano = hoje.getFullYear() + hoje.getMonth() / 12 + (hoje.getDate() - 1) / 365;
  if (ano <= MARCOS[0]) return 0;
  for (let i = 1; i < MARCOS.length; i += 1) {
    if (ano < MARCOS[i]) return (i - 1 + (ano - MARCOS[i - 1]) / (MARCOS[i] - MARCOS[i - 1])) / (MARCOS.length - 1);
  }
  return 1;
}
