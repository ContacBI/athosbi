import { alinharVisaoDoGrupo, pararSincroniaDoGrupo } from "./companies.js";

// Alinhar a visão de um grupo: copia o B.I. do grupo (abas, posições, itens e
// visibilidade) pra todas as empresas dele e passa a manter tudo igual (ver
// lib/companies.js). Antes, baixa um backup do que cada empresa tinha. Usado
// em Cadastros › Grupos e na aba Grupos do console.

function baixarBackup(backup, nome) {
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-visao-${String(nome).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function alinharComConfirmacao(group) {
  const sincronizado = Boolean(group.sincronizarVisao);
  const n = (group.companyIds || []).length;
  const ok = window.confirm(
    `${sincronizado ? "Realinhar" : "Alinhar"} a visão de "${group.name}"?\n\n` +
      `O B.I do GRUPO (abas, posições, itens e o que fica oculto pro cliente) será copiado para as ${n} empresas dele, que PERDEM o que tinham no B.I.\n` +
      `Depois, qualquer mudança no Personalizar de uma empresa ou do grupo vale para todas.\n\n` +
      `Antes de alinhar, um arquivo de backup do que cada empresa tinha é baixado.`
  );
  if (!ok) return;
  const r = alinharVisaoDoGrupo(group.id);
  if (r.erro) {
    window.alert(r.erro);
    return;
  }
  baixarBackup(r.backup, group.name);
  window.alert(
    `Visão alinhada em ${r.alinhadas} empresa(s).${r.puladas.length ? `\n\nJá seguem outro grupo (não alteradas): ${r.puladas.join(", ")}.` : ""}${r.semPermissao.length ? `\n\nSem permissão para alterar: ${r.semPermissao.join(", ")}.` : ""}\n\nO backup foi baixado.`
  );
}

export function pararComConfirmacao(group) {
  if (window.confirm(`Parar de sincronizar a visão de "${group.name}"? As empresas mantêm o que têm hoje e voltam a ser independentes.`)) pararSincroniaDoGrupo(group.id);
}
