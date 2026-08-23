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

// Sobe a cadeia de pais de um código, devolvendo só os ancestrais que
// TAMBÉM são custom — uma sintética "de verdade" do plano padrão original
// nunca entra aqui, só as sintéticas que foram criadas manualmente pra
// abrigar essa conta analítica (o caso comum: alguém criou uma categoria
// nova do zero, com a folha lá no fundo dela).
function customAncestors(codigoGerencial) {
  const parts = codigoGerencial.split(".");
  const ancestors = [];
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const parentCode = parts.slice(0, i).join(".");
    const parentRow = state.planoGlobal.find((row) => row.codigo_gerencial === parentCode);
    if (parentRow?.custom) ancestors.push(parentRow);
  }
  return ancestors;
}

// Move uma conta (analítica) que hoje vive no Plano gerencial global — e
// qualquer sintética-mãe dela que também seja custom — pra dentro de um ou
// mais planos padrão, SEM trocar código nenhum. Diferente de
// removePlanoAccount (que desfaz todo mundo que apontava pra ela, ver
// invalidateMappingsForPlanoCodes em companies.js), aqui os vínculos de
// De/Para que já existiam continuam valendo do jeito que estavam: a conta
// só passa a existir pra quem usa um desses planos, em vez de pra toda a
// carteira. Aceita vários planos de uma vez porque a mesma conta custom
// pode já estar em uso por empresas de grupos diferentes (ver
// PlanoGerencial.jsx CustomAccountsAudit) — mover pra só um quebraria a
// visibilidade dela nos relatórios de quem ficou de fora.
export function moveGlobalAccountToPlanos(codigoGerencial, planoPadraoIds) {
  const leaf = state.planoGlobal.find((item) => item.codigo_gerencial === codigoGerencial);
  if (!leaf || !planoPadraoIds?.length) return false;
  const movedAt = new Date().toISOString();
  const chain = [...customAncestors(codigoGerencial), leaf].map((row) => ({ ...row, movedFromGlobalAt: movedAt }));
  const targetIds = new Set(planoPadraoIds);
  const planos = state.planosPadrao.map((plano) => {
    if (!targetIds.has(plano.id)) return plano;
    const existingCodes = new Set(plano.extraAccounts.map((row) => row.codigo_gerencial));
    const toAdd = chain.filter((row) => !existingCodes.has(row.codigo_gerencial));
    return toAdd.length ? { ...plano, extraAccounts: [...plano.extraAccounts, ...toAdd], updatedAt: movedAt } : plano;
  });
  writePersistent(PLANOS_PADRAO_KEY, planos);
  const movedCodes = new Set(chain.map((row) => row.codigo_gerencial));
  const nextGlobal = state.planoGlobal.filter((item) => !movedCodes.has(item.codigo_gerencial));
  writePersistent(PLANO_SNAPSHOT_KEY, nextGlobal);
  setData({ planosPadrao: planos, planoGlobal: nextGlobal });
  refreshEffectivePlano();
  return true;
}

// Depois de mover uma conta pra "vários planos padrão" de uma vez (ver
// moveGlobalAccountToPlanos), pode sobrar em algum plano onde nenhuma
// empresa DAQUELE plano tem De/Para de verdade apontando pra ela — ficou
// lá só porque foi marcada junto na hora de mover, não porque faz sentido
// ali. Isso limpa: por plano, mantém só as contas extras que pelo menos
// uma empresa DAQUELE plano específico realmente usa; remove o resto.
// Uma sintética-mãe custom é mantida se ainda tiver algum filho em uso no
// mesmo plano (ela não recebe De/Para direto, só as folhas). Nunca mexe
// em nenhum vínculo de De/Para — só tira a conta da lista de "disponível
// pra esse plano"; sempre reversível recriando a conta ou movendo de novo.
export function pruneUnusedExtraAccounts() {
  let removedTotal = 0;
  const planos = state.planosPadrao.map((plano) => {
    const memberIds = new Set(companiesUsingPlano(plano.id).map((company) => company.id));
    const usedCodes = new Set();
    state.companies.forEach((company) => {
      if (!memberIds.has(company.id)) return;
      (company.mappings || []).forEach((mapping) => usedCodes.add(mapping.codigo_gerencial));
    });
    const keep = plano.extraAccounts.filter((row) => {
      if (usedCodes.has(row.codigo_gerencial)) return true;
      if (row.natureza !== "Sintetica") return false;
      const prefix = `${row.codigo_gerencial}.`;
      return plano.extraAccounts.some((other) => other.codigo_gerencial.startsWith(prefix) && usedCodes.has(other.codigo_gerencial));
    });
    if (keep.length === plano.extraAccounts.length) return plano;
    removedTotal += plano.extraAccounts.length - keep.length;
    return { ...plano, extraAccounts: keep, updatedAt: new Date().toISOString() };
  });
  if (removedTotal) persist(planos);
  return removedTotal;
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
