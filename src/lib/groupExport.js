import { state } from "../data/store.js";
import { remapJournal } from "./companies.js";
import { groupCompanies } from "./groups.js";
import { slug } from "./demonstrativoExport.js";

// Roda `builder()` com accounts/journal/mappings do estado global
// TEMPORARIAMENTE trocados pros dados de UMA empresa do grupo (sem o
// merge/namespacing sintético que o grupo usa — ver buildGroupDataset em
// groups.js), igual selectCompany faz pra uma empresa normal. Todo o
// resto (período selecionado, toggles de exibição, dashboardTabs) fica
// como está — o relatório de cada empresa usa exatamente a mesma
// configuração do que está na tela do grupo, só trocando de qual razão ele
// lê.
//
// Usa `state` importado direto de data/store.js (não de useStore.js) e
// mutação simples (Object.assign), nunca o setData que notifica os
// componentes React — a troca e a restauração acontecem sincronamente
// dentro dessa função, então nenhum componente montado chega a
// re-renderizar com os dados trocados no meio do caminho.
function withCompanyScope(company, builder) {
  const snapshot = { accounts: state.accounts, journal: state.journal, mappings: state.mappings };
  try {
    state.accounts = company.accounts || [];
    state.mappings = company.mappings || [];
    state.journal = remapJournal(company.journal || [], company.mappings || []);
    return builder();
  } finally {
    Object.assign(state, snapshot);
  }
}

// Constrói um relatório por empresa-membro do grupo, chamando `builder()`
// (uma das funções puras buildFullDfcExport/buildFullReportExport) uma vez
// por empresa com o estado global "escopado" pra ela. companyName/fileLabel
// do resultado são sobrescritos com o nome real da empresa — enquanto o
// escopo está trocado, activeWorkspaceName() ainda enxerga o GRUPO (só
// accounts/journal/mappings foram trocados), não a empresa individual.
export function buildPerCompanyReports(group, builder) {
  return groupCompanies(group).map((company) => {
    const data = withCompanyScope(company, builder);
    return {
      company,
      data: { ...data, companyName: company.name, fileLabel: slug(`${data.reportName}_${company.name}`) },
    };
  });
}
