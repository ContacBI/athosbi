// Tela de Início (Landing.jsx): o que ela precisa além do que já vem no
// login — a saudação, os números de cada empresa pro cliente e o resumo da
// carteira pra equipe (as abertas por último ficam em lib/recentes.js).

import { state } from "../data/store.js";
import { buildReport } from "../data/calculations.js";
import { sharedDashboardContext } from "./dashboardData.js";
import { analyze } from "./assistant/analysis.js";
import { shortPeriod } from "./assistant/context.js";
import { budgetFor } from "./budget.js";
import { remapJournal } from "./companies.js";
import { effectivePlano } from "./planosPadrao.js";
import { companyHealth } from "./carteira.js";

// ---------------------------------------------------------------------------
// Saudação.

export function saudacao(agora = new Date()) {
  const hora = agora.getHours();
  return hora < 5 ? "Boa noite" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

export function primeiroNome(nome) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  if (!primeiro) return "";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Números de uma empresa pro cartão do cliente: receita e resultado do
// último mês com lançamento e do ano até ele. Precisa do razão já carregado
// (company.journalLoaded) — a DRE mês a mês vem dos lançamentos. Roda com o
// estado global trocado pros dados da empresa (mesma ideia de
// withCompanyScope em lib/carteira.js), restaurado no finally: nenhum
// componente chega a ver o estado trocado.

const SCOPED_KEYS = ["activeCompanyId", "activeGroupId", "accounts", "mappings", "journal", "plano", "periodStart", "periodEnd", "natureRules", "dfcOverrides", "hideNonOperatingResults", "excludedNonOperatingCodes", "orcamentos"];

function mesAntes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const data = new Date(ano, m - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// Roda `fn` com o estado global trocado pros dados de uma empresa (razão
// já carregado), restaurado no finally.
function comEmpresa(company, fn) {
  const snapshot = Object.fromEntries(SCOPED_KEYS.map((key) => [key, state[key]]));
  try {
    Object.assign(state, {
      activeCompanyId: company.id,
      activeGroupId: "",
      accounts: company.accounts || [],
      mappings: company.mappings || [],
      journal: remapJournal(company.journal || [], company.mappings || []),
      plano: effectivePlano(company.planoPadraoId),
      natureRules: company.natureRules || null,
      dfcOverrides: company.dfcOverrides || [],
      hideNonOperatingResults: Boolean(company.hideNonOperatingResults),
      excludedNonOperatingCodes: company.excludedNonOperatingCodes || [],
      orcamentos: company.orcamentos || [],
    });
    return fn();
  } finally {
    Object.assign(state, snapshot);
  }
}

function ultimoDia(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, "0")}`;
}

// `ate` ("AAAA-MM"): o mês fechado — os números param nele mesmo que já
// existam lançamentos depois (ver lib/fechamento.js).
export function numerosDaEmpresa(company, { ate = "" } = {}) {
  if (!company?.journalLoaded || !(company.journal || []).length) return null;
  let ultimoMes = "";
  company.journal.forEach((entry) => {
    const mes = String(entry.data || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(mes) && mes > ultimoMes && (!ate || mes <= ate)) ultimoMes = mes;
  });
  if (!ultimoMes) return null;
  const ano = ultimoMes.slice(0, 4);
  try {
    return comEmpresa(company, () => {
      state.periodStart = `${ano}-01-01`;
      state.periodEnd = ultimoDia(ultimoMes);
      const dre = buildReport("DRE");
      const linha = (code) => dre.find((row) => row.codigo_gerencial === code);
      const doMes = (row) => Number(row?.monthValues?.[ultimoMes] || 0);
      const doAno = (row) => Object.entries(row?.monthValues || {}).reduce((soma, [mes, valor]) => (mes.startsWith(ano) && mes <= ultimoMes ? soma + Number(valor || 0) : soma), 0);
      const receita = linha("DRE.03");
      const lucro = linha("DRE.18") || linha("DRE.13");
      return { mes: ultimoMes, receitaMes: doMes(receita), lucroMes: doMes(lucro), ano, receitaAno: doAno(receita), lucroAno: doAno(lucro) };
    });
  } catch (error) {
    console.error(`Início: não consegui calcular ${company.name}`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// O resumo do celular no cartão do Início (cliente): os números do ano
// (numerosDaEmpresa) mais a análise do mês fechado contra o mês anterior —
// a mesma do resumo no celular (Celular.jsx), com os mesmos alertas,
// quadrinhos, "do lucro ao caixa" e orçamento. Precisa do razão carregado.
export function resumoDaEmpresa(company, { ate = "" } = {}) {
  const numeros = numerosDaEmpresa(company, { ate });
  if (!numeros) return null;
  try {
    return comEmpresa(company, () => {
      const mes = numeros.mes;
      const period = { start: `${mes}-01`, end: ultimoDia(mes) };
      const comPeriodo = (inicio, fim) => {
        state.periodStart = inicio;
        state.periodEnd = fim;
        return sharedDashboardContext();
      };
      const ctx = comPeriodo(period.start, period.end);
      const anterior = mesAntes(mes);
      const temAnterior = (company.journal || []).some((entry) => String(entry.data || "").startsWith(anterior));
      const prevPeriod = temAnterior ? { start: `${anterior}-01`, end: ultimoDia(anterior) } : null;
      const prevCtx = prevPeriod ? comPeriodo(prevPeriod.start, prevPeriod.end) : null;
      state.periodStart = period.start;
      state.periodEnd = period.end;
      const label = shortPeriod(period.start, period.end);
      const prevLabel = prevPeriod ? shortPeriod(prevPeriod.start, prevPeriod.end) : "";
      const analysis = analyze(ctx, { period, label, prevCtx, prevPeriod: prevPeriod || {}, prevLabel });
      return { ...numeros, analysis, budget: budgetFor(ctx), prevLabel };
    });
  } catch (error) {
    console.error(`Início: não consegui montar o resumo de ${company.name}`, error);
    return { ...numeros, analysis: null, budget: null, prevLabel: "" };
  }
}

// ---------------------------------------------------------------------------
// Resumo da carteira pra equipe: quantas empresas críticas, em atenção, em
// dia e com dados atrasados (mesma régua da página Carteira).

export function resumoCarteira(companies, { today = new Date() } = {}) {
  const resumo = { critico: 0, atencao: 0, ok: 0, atrasadas: 0, depara: 0, total: companies.length };
  companies.forEach((company) => {
    const saude = companyHealth(company, { today });
    resumo[saude.status] += 1;
    if (saude.checks.some((check) => check.id === "balancete" && (check.level === "atencao" || check.level === "critico"))) resumo.atrasadas += 1;
    if (saude.checks.some((check) => check.id === "depara" && check.level !== "ok")) resumo.depara += 1;
  });
  return resumo;
}
