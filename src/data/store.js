import { readStoredDensity } from "../lib/density.js";

export const state = {
  plano: [],
  // Whether a pre-import snapshot exists to revert a bulk Excel upload —
  // see lib/planoStore.js.
  planoBackupAvailable: false,
  dfcStructure: [],
  dfcRules: [],
  dfcLinks: [],
  companies: [],
  groups: [],
  representantes: [],
  // User-edited/created "Indicadores" catalog entries — see lib/indicators.js.
  // Each record either overrides a built-in indicator's id (its formula
  // patched in place) or introduces a brand-new custom one.
  indicatorOverrides: [],
  activeCompanyId: "",
  activeGroupId: "",
  // true só pro(s) e-mail(s) cadastrados em portal_admins (ver lib/access.js
  // isPortalAdmin) — controla se o menu Parâmetros aparece e se as telas de
  // cadastro ficam editáveis. Todo o resto de fato é aplicado pela RLS do
  // Supabase; esta flag é só pra UI não nem oferecer o que o banco recusaria.
  isAdmin: false,
  mappings: [],
  // Vínculo DFC por empresa — overrides de qual destino (DFC.OP.CLIENTES
  // etc.) uma conta gerencial usa nesta empresa, por cima do vínculo global
  // (vinculo_gerencial_dfc.csv). Um item por código gerencial: [{
  // codigo_gerencial, destino }]. Ver lib/calculations.js (dfcLinkTarget)
  // e pages/VinculoDfc.jsx.
  dfcOverrides: [],
  accounts: [],
  journal: [],
  // Per-company prefix rules that classify a ledger account's classificacao
  // as Ativo/Passivo/PL/Resultado, so De/Para only offers managerial lines
  // of the same nature — see lib/accountNature.js.
  natureRules: null,
  // true quando o razão da empresa ativa não carregou do Supabase (ver
  // lib/companies.js loadCompanies/selectCompany) — nunca deve ser tratado
  // como "essa empresa não tem lançamento".
  journalLoadFailed: false,
  view: "empresas",
  selectedLine: null,
  selectedAccount: null,
  expandedLines: new Set(),
  modalAccount: null,
  modalDfcLedger: null,
  selectedDeparaAccount: null,
  selectedDeparaAccounts: new Set(),
  selectedDeparaPlan: null,
  companyConfigId: "",
  selectedIndicator: null,
  breakEvenMode: "contabil",
  economicProfitTarget: 0,
  deparaMode: "pending",
  deparaPlanView: "BP",
  deparaSearch: "",
  planSearch: "",
  search: "",
  periodStart: "",
  periodEnd: "",
  reportCompare: true,
  // Balanço é saldo acumulado (faz sentido carregar o saldo anterior); DRE é
  // fluxo do período (o saldo anterior não significa nada ali) — por isso
  // cada demonstração tem seu próprio padrão, mas ambos continuam togglables.
  showPreviousBalanceBP: true,
  showPreviousBalanceDRE: false,
  // Each statement keeps its own default: BP is a rolling balance (no
  // redundant total), while DRE is a period flow and benefits from a total.
  showReportTotalBP: false,
  showReportTotalDRE: true,
  showReportTotalDFC: false,
  bpMonthlyMode: "accumulated",
  hideZeroNoMovement: true,
  hideNonOperatingResults: false,
  excludedNonOperatingCodes: [],
  horizontalType: "BP",
  verticalType: "BP",
  ebitdaChartType: "evolution",
  exportMode: "synthetic",
  exportLevels: 3,
  // Per-company, fully user-defined workspace: [] means the company starts
  // completely blank. Each entry is { id, name, widgets: [{ id, size }] } —
  // the user creates/names/orders these tabs themselves; nothing is
  // pre-built. widget id matches WIDGET_CATALOG, size is "sm" | "md" | "lg".
  dashboardTabs: [],
  // Ajuste pessoal de espaçamento das linhas dos demonstrativos — ver
  // lib/density.js. Fica só neste navegador (nunca entra em
  // persistActiveCompany), por isso mora aqui já inicializado do
  // localStorage, não em selectCompany/createCompany como os campos por
  // empresa.
  reportDensity: readStoredDensity(),
};

export function setData(partial) {
  Object.assign(state, partial);
}

export function mappingByClassification() {
  return new Map(state.mappings.map((row) => [row.classificacao, row]));
}

export function planByCode() {
  return new Map(state.plano.map((row) => [row.codigo_gerencial, row]));
}
