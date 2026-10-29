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

// A tela de login nova vale pra todo mundo no site de teste (pedido do
// Izaias, 28/10/2026); no oficial continua a de sempre.
export function loginNovo(ambienteTeste = EH_TESTE) {
  return Boolean(ambienteTeste);
}

// Visual novo do portal todo (src/hub/bi.css) pra quem tem o hub ligado:
// data-hub no <html>. A marca no navegador deixa o index.html já pintar o
// carregamento com as cores novas, antes do React subir.
const MARCA_DO_TEMA = "athosbi.hub";

export function aplicarTemaDoHub(ligado) {
  const raiz = document.documentElement;
  try {
    if (ligado) {
      raiz.dataset.hub = "1";
      localStorage.setItem(MARCA_DO_TEMA, "1");
    } else {
      delete raiz.dataset.hub;
      localStorage.removeItem(MARCA_DO_TEMA);
    }
  } catch {
    // sem armazenamento: o atributo já basta pra esta aba
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

// As áreas do hub, na ordem do menu. O B.I., a Reforma Tributária (só
// informação) e as Ferramentas (os módulos que ficavam no menu lateral do
// B.I. — pedido do Izaias, 29/10/2026); Serviços e Conteúdos ficam no menu,
// ainda sem nada.
export const AREAS_DO_HUB = [
  { id: "inicio", nome: "Início", rota: "/hub", pronta: true },
  { id: "bi", nome: "Meu B.I.", rota: null, pronta: true, resumo: "Resultado, caixa, balanço e indicadores da empresa, fechados pelo escritório." },
  { id: "reforma", nome: "Reforma Tributária", rota: "/hub/reforma", pronta: true, resumo: "O que muda, quando muda e o que observar — sem juridiquês." },
  { id: "servicos", nome: "Serviços", rota: "/hub/servicos", pronta: false },
  { id: "conteudos", nome: "Conteúdos", rota: "/hub/conteudos", pronta: false },
  { id: "ferramentas", nome: "Ferramentas", rota: "/hub/ferramentas", pronta: true, resumo: "Orçamento, carga tributária, desempenho e notas fiscais da empresa." },
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
