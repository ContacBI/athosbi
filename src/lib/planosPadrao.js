import { state, setData } from "../data/useStore.js";
import { PLANOS_PADRAO_KEY, PLANO_SNAPSHOT_KEY, readStoredArray, writePersistent } from "./persistence.js";

// Planos padrão — cada um é o Plano gerencial global MAIS uma lista pequena
// de contas extras, exclusivas de quem usa aquele plano (uma empresa
// sozinha, ou um grupo de empresas parecidas, ver company.planoPadraoId em
// companies.js). Nunca uma cópia da árvore inteira: só a diferença por cima
// do global, pra editar o Plano gerencial continuar valendo pra todo mundo,
// e promover uma conta extra pro global ser só "mover ela de lista" no
// futuro (ver o resumo em PlanoGerencial.jsx).
//
// Formato de cada plano: { id, nome, extraAccounts: [...linhas no mesmo
// formato do plano gerencial], createdAt, updatedAt }.

export async function loadPlanosPadrao() {
  const planos = await readStoredArray(PLANOS_PADRAO_KEY);
  setData({ planosPadrao: planos });
}

// Parte do "Backup geral" (ver lib/fullBackup.js) — mesmo padrão de
// restoreRepresentantes/restoreIndicatorOverrides.
export function restorePlanosPadrao(planos) {
  const next = Array.isArray(planos) ? planos : [];
  writePersistent(PLANOS_PADRAO_KEY, next);
  setData({ planosPadrao: next });
}

function persist(planos) {
  writePersistent(PLANOS_PADRAO_KEY, planos);
  setData({ planosPadrao: planos });
  // planosPadrao mudou (nova conta extra, plano apagado etc.) — se quem
  // está ativo agora usa um dos planos afetados, os relatórios na tela
  // precisam refletir isso na hora, não só depois de trocar de empresa.
  refreshEffectivePlanoSafe();
}

// refreshEffectivePlano só pode rodar depois que companies/groups já
// carregaram (precisa achar a empresa/grupo ativo) — no boot, planosPadrao
// carrega em paralelo com o resto (ver App.jsx) e pode terminar primeiro;
// nesse caso não tem nada ativo ainda mesmo, então não faz diferença pular.
function refreshEffectivePlanoSafe() {
  if (state.companies.length || state.groups.length) refreshEffectivePlano();
}

export function createPlanoPadrao(nome) {
  const trimmed = String(nome || "").trim();
  if (!trimmed) return null;
  const plano = {
    id: `pp_${Date.now()}`,
    nome: trimmed,
    extraAccounts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  persist([...state.planosPadrao, plano]);
  return plano;
}

export function renamePlanoPadrao(id, nome) {
  const trimmed = String(nome || "").trim();
  if (!trimmed) return;
  persist(state.planosPadrao.map((plano) => (plano.id === id ? { ...plano, nome: trimmed, updatedAt: new Date().toISOString() } : plano)));
}

// Só deixa apagar um plano padrão sem empresa nenhuma usando ele — apagar
// um em uso deixaria as empresas dele sem chart de contas extra nenhum de
// hora pra outra, silenciosamente.
export function companiesUsingPlano(planoId) {
  return state.companies.filter((company) => company.planoPadraoId === planoId);
}

export function deletePlanoPadrao(id) {
  if (companiesUsingPlano(id).length > 0) return false;
  persist(state.planosPadrao.filter((plano) => plano.id !== id));
  return true;
}

// Mesma lógica de código-filho do plano gerencial global (ver
// lib/planoOverrides.js nextChildCode) — mas olhando pro EFETIVO (global +
// extras já deste plano), senão duas contas em planos padrão diferentes
// poderiam gerar o mesmo código embaixo do mesmo pai global.
function nextChildCode(parentCode, siblingCodes) {
  const prefix = `${parentCode}.`;
  const children = siblingCodes.filter((code) => code.startsWith(prefix) && !code.slice(prefix.length).includes("."));
  if (!children.length) return `${parentCode}.01`;
  let maxNumber = 0;
  let width = 2;
  children.forEach((code) => {
    const last = code.split(".").pop();
    const number = Number(last);
    if (Number.isFinite(number)) {
      width = last.length;
      if (number > maxNumber) maxNumber = number;
    }
  });
  return `${parentCode}.${String(maxNumber + 1).padStart(width, "0")}`;
}

// A "árvore efetiva" que uma empresa/grupo enxerga: o plano gerencial
// global mais as contas extras do plano padrão escolhido. Usado tanto pra
// alimentar De/Para e os relatórios (BP/DRE/DFC) quanto pra calcular o
// próximo código livre ao adicionar uma conta extra nova. Sempre lê o
// GLOBAL puro (state.planoGlobal) — nunca state.plano, que já é o efetivo
// de outra empresa/grupo qualquer que esteja ativo no momento.
export function effectivePlano(planoPadraoId) {
  if (!planoPadraoId) return state.planoGlobal;
  const plano = state.planosPadrao.find((item) => item.id === planoPadraoId);
  if (!plano || !plano.extraAccounts.length) return state.planoGlobal;
  return [...state.planoGlobal, ...plano.extraAccounts];
}

// Recalcula state.plano (o "efetivo") pra bater com quem está ativo agora
// — mesma ideia de journal/mappings/accounts, que já trocam a cada
// selectCompany/selectGroup (ver companies.js e groups.js). Chamado por
// eles, e por qualquer edição que possa mudar o resultado pra quem já está
// olhando um relatório agora (plano gerencial global mudou, ou o próprio
// plano padrão em uso ganhou/perdeu uma conta extra).
export function refreshEffectivePlano() {
  if (state.activeGroupId) {
    const group = state.groups.find((item) => item.id === state.activeGroupId);
    const memberIds = new Set(group?.companyIds || []);
    const planoIds = new Set(
      state.companies.filter((company) => memberIds.has(company.id) && company.planoPadraoId).map((company) => company.planoPadraoId)
    );
    // Grupo já é obrigado (ver GroupModal.jsx) a ter todo mundo no mesmo
    // plano padrão, mas soma qualquer um encontrado por segurança — nunca
    // trava o app por causa de um grupo antigo que ainda não bate com essa
    // regra.
    let extra = [];
    planoIds.forEach((id) => {
      const plano = state.planosPadrao.find((item) => item.id === id);
      if (plano) extra = extra.concat(plano.extraAccounts);
    });
    setData({ plano: extra.length ? [...state.planoGlobal, ...extra] : state.planoGlobal });
    return;
  }
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  setData({ plano: effectivePlano(company?.planoPadraoId) });
}

export function previewNewExtraAccount(planoPadraoId, parentCode, natureza) {
  const effective = effectivePlano(planoPadraoId);
  const parent = effective.find((row) => row.codigo_gerencial === parentCode);
  if (!parent) return null;
  return {
    codigo_gerencial: nextChildCode(parentCode, effective.map((row) => row.codigo_gerencial)),
    demonstrativo: parent.demonstrativo,
    grupo_macro: parent.grupo_macro,
    nivel: String(Number(parent.nivel || 1) + 1),
    natureza,
    aceita_depara: natureza === "Analitica" ? "sim" : "nao",
  };
}

// `nome`/`natureza` vêm do formulário; o resto é derivado de onde o
// usuário clicou pra encaixar, igual ao plano gerencial global — sem
// chance de digitar um código malformado ou colidindo com outro.
export function addExtraAccount(planoPadraoId, { parentCode, nome, natureza }) {
  const trimmedName = String(nome || "").trim();
  if (!trimmedName) return null;
  const preview = previewNewExtraAccount(planoPadraoId, parentCode, natureza);
  if (!preview) return null;
  const row = {
    ...preview,
    nome: trimmedName,
    sinal_padrao: "Neutro",
    observacao: "",
    dfc_numero: "",
    dfc_codigo: "",
    dfc_descricao: "",
    custom: true,
    createdAt: new Date().toISOString(),
  };
  const planos = state.planosPadrao.map((plano) =>
    plano.id === planoPadraoId ? { ...plano, extraAccounts: [...plano.extraAccounts, row], updatedAt: new Date().toISOString() } : plano
  );
  persist(planos);
  return row;
}

export function removeExtraAccount(planoPadraoId, codigoGerencial) {
  const planos = state.planosPadrao.map((plano) =>
    plano.id === planoPadraoId
      ? { ...plano, extraAccounts: plano.extraAccounts.filter((row) => row.codigo_gerencial !== codigoGerencial), updatedAt: new Date().toISOString() }
      : plano
  );
  persist(planos);
}

// Move uma conta que hoje vive no Plano gerencial global pra dentro de um
// plano padrão — SEM trocar o código. Diferente de removePlanoAccount (que
// desfaz todo mundo que apontava pra ela, ver invalidateMappingsForPlanoCodes
// em companies.js), aqui os vínculos de De/Para que já existiam continuam
// valendo do jeito que estavam: a conta só passa a existir pra quem usa
// esse plano padrão, em vez de pra toda a carteira. Pensado pro fluxo
// "essa conta foi criada manual pensando numa empresa só/grupo só, não
// devia ter poluído o global" (ver PlanoGerencial.jsx CustomAccountsAudit).
export function moveGlobalAccountToPlano(codigoGerencial, planoPadraoId) {
  const row = state.planoGlobal.find((item) => item.codigo_gerencial === codigoGerencial);
  if (!row) return false;
  const movedRow = { ...row, movedFromGlobalAt: new Date().toISOString() };
  const planos = state.planosPadrao.map((plano) =>
    plano.id === planoPadraoId ? { ...plano, extraAccounts: [...plano.extraAccounts, movedRow], updatedAt: new Date().toISOString() } : plano
  );
  writePersistent(PLANOS_PADRAO_KEY, planos);
  const nextGlobal = state.planoGlobal.filter((item) => item.codigo_gerencial !== codigoGerencial);
  writePersistent(PLANO_SNAPSHOT_KEY, nextGlobal);
  setData({ planosPadrao: planos, planoGlobal: nextGlobal });
  refreshEffectivePlano();
  return true;
}

export function hasExtraChildren(planoPadraoId, code) {
  const prefix = `${code}.`;
  return effectivePlano(planoPadraoId).some((row) => row.codigo_gerencial.startsWith(prefix));
}

// Resumo pro Plano gerencial admin saber o que foi criado em cada plano
// padrão e quem usa — é assim que "qual empresa" é respondido quando o
// plano é compartilhado por várias (ver PlanoGerencial.jsx).
export function extraAccountsSummary() {
  return state.planosPadrao
    .filter((plano) => plano.extraAccounts.length > 0)
    .map((plano) => ({
      plano,
      companies: companiesUsingPlano(plano.id),
    }));
}
