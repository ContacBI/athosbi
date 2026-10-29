import { useEffect, useMemo, useState } from "react";
import { state } from "../data/useStore.js";
import { cachedJournalStats, companyHealth, LEVELS, resumoGuardado, resumosGuardados } from "../lib/carteira.js";

// Saúde de cada empresa pro console e pro hub (a mesma conta da página
// Carteira, ver lib/carteira.js). Antes, cada tela refazia a carteira inteira
// do zero toda vez que a lista de empresas mudava — e ela muda várias vezes
// ao abrir (o razão e as contagens chegam aos poucos) —, o que travava tudo.
// Agora a conta é uma só, compartilhada entre as telas: guardada por empresa
// com uma "assinatura" do que ela usa, refeita só pra empresa que mudou, em
// fatias de poucos milissegundos (a tela não trava) e com um aviso por fatia
// (não um por empresa).
const contas = new Map(); // id → { assinatura, saude }
const ouvintes = new Set();
let fila = [];
let agendada = false;
let planosDaConta = null;
let ultimoAviso = 0;

function assinatura(company, resumo, hoje) {
  const meta = company.lastBalanceteMeta || {};
  return [
    hoje,
    company.updatedAt || "",
    company.journalCount ?? "",
    company.journalLoadFailed ? 1 : 0,
    (company.accounts || []).length,
    (company.mappings || []).length,
    (company.responsaveis || []).join(","),
    company.planoPadraoId || "",
    meta.fim || "",
    meta.syncedAt || meta.uploadedAt || "",
    resumo?.analyzedAt || "",
  ].join("|");
}

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

const proximaFatia = (fn) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 250 }) : setTimeout(fn, 16));

function processar() {
  agendada = false;
  const inicio = performance.now();
  const hoje = new Date();
  while (fila.length && performance.now() - inicio < 10) {
    const { company, resumo, chave } = fila.shift();
    let saude;
    try {
      saude = companyHealth(company, { today: hoje, journalStats: resumo });
    } catch (error) {
      console.warn(`Saúde de ${company.name} falhou`, error);
      saude = { id: company.id, status: "atencao", checks: [], problems: 0, metrics: {} };
    }
    contas.set(company.id, { assinatura: chave, saude });
  }
  // Avisa as telas no máximo a cada 300 ms (e no fim): cada aviso redesenha a lista inteira.
  if (!fila.length || performance.now() - ultimoAviso > 300) {
    ultimoAviso = performance.now();
    avisar();
  }
  if (fila.length) {
    agendada = true;
    proximaFatia(processar);
  }
}

// Põe na fila só as empresas cuja assinatura mudou (lendo os resumos do razão
// uma vez só). `razaoAberto`: pra empresa com o razão na memória, o resumo
// sai dele na hora (a página Carteira mostra assim); no resto, só o guardado.
export function agendarSaude(companies, { razaoAberto = false } = {}) {
  // Plano padrão mudou: a conta de todas muda junto.
  if (planosDaConta !== state.planosPadrao) {
    planosDaConta = state.planosPadrao;
    contas.clear();
  }
  const guardados = resumosGuardados();
  const hoje = new Date().toISOString().slice(0, 10);
  const naFila = new Set(fila.map((item) => item.company.id));
  for (const company of companies) {
    const resumo = razaoAberto && company.journalLoaded ? cachedJournalStats(company, guardados) : resumoGuardado(company, guardados);
    const chave = assinatura(company, resumo, hoje);
    if (contas.get(company.id)?.assinatura === chave) continue;
    if (naFila.has(company.id)) fila = fila.filter((item) => item.company.id !== company.id);
    fila.push({ company, resumo, chave });
  }
  if (fila.length && !agendada) {
    agendada = true;
    proximaFatia(processar);
  }
}

export function useSaude(companies, { razaoAberto = false } = {}) {
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const ouvinte = () => setVersao((v) => v + 1);
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  }, []);
  useEffect(() => {
    agendarSaude(companies, { razaoAberto });
  }, [companies, razaoAberto]);
  return useMemo(() => {
    // Enquanto uma empresa é refeita, continua valendo a conta anterior dela (sem piscar).
    const healths = {};
    let faltam = 0;
    for (const company of companies) {
      const conta = contas.get(company.id);
      if (conta) healths[company.id] = conta.saude;
      else faltam += 1;
    }
    return { healths, calculando: faltam > 0 };
    // `versao` muda a cada fatia pronta: é o que faz reler as contas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, versao]);
}

// O resumo da carteira (como resumoCarteira em lib/inicio.js), a partir das contas já feitas.
export function resumoDasSaudes(healths) {
  const resumo = { critico: 0, atencao: 0, ok: 0, atrasadas: 0, depara: 0, total: 0 };
  Object.values(healths).forEach((saude) => {
    resumo.total += 1;
    resumo[saude.status] += 1;
    if ((saude.checks || []).some((check) => check.id === "balancete" && (check.level === "atencao" || check.level === "critico"))) resumo.atrasadas += 1;
    if ((saude.checks || []).some((check) => check.id === "depara" && check.level !== "ok")) resumo.depara += 1;
  });
  return resumo;
}

const ORDEM = { critico: 0, atencao: 1, ok: 2 };

// A pior situação entre as empresas de uma unidade (grupo ou empresa avulsa).
export function statusDaUnidade(empresas, healths) {
  let pior = null;
  for (const company of empresas) {
    const status = healths[company.id]?.status;
    if (!status) continue;
    if (!pior || ORDEM[status] < ORDEM[pior]) pior = status;
  }
  return pior;
}

// Os problemas (atenção ou crítico) de uma empresa, do pior pro mais leve.
export function problemasDaEmpresa(health) {
  return (health?.checks || []).filter((check) => LEVELS[check.level] >= LEVELS.atencao).sort((a, b) => LEVELS[b.level] - LEVELS[a.level]);
}

export const ROTULO_DO_STATUS = { critico: "Crítica", atencao: "Atenção", ok: "Em dia" };
export const COR_DO_STATUS = { critico: "#d8493a", atencao: "#d99a2b", ok: "#1d9e75" };

// Nome curto de uma empresa dentro de um grupo: sem o "LTDA"/"ME"… e só as
// duas primeiras palavras — mas sempre com o ano do fim, "(2025)": sem ele,
// "CONCENT SISTEMAS LTDA (2025)" e a de 2026 ficavam com o mesmo nome curto.
export function nomeCurto(company) {
  const nome = String(company?.name || "");
  const [, base, ano] = nome.match(/^(.*?)\s*(\(\d{4}\))?\s*$/);
  const palavras = base
    .replace(/\b(LTDA|EIRELI|EPP|ME|S\/?A|SOCIEDADE|EMPRESARIAL|LIMITADA)\b\.?/gi, "")
    .split(/\s+/)
    .filter(Boolean);
  const curto = palavras.slice(0, 2).join(" ");
  return curto ? [curto, ano].filter(Boolean).join(" ") : nome;
}
