import { partesDaMeta, temMoeda, tituloDoRelatorio } from "./exportVisual.js";
import { abaDeRelatorio, baixarPasta, novaPasta } from "./excelVisual.js";

// Excel de um demonstrativo no padrão dos downloads (excelVisual.js): um
// .xlsx de verdade (antes era uma tabela HTML com extensão .xls, que o
// Excel abria com aviso, sem números de verdade e, fora dele, sem cor
// nenhuma). `columns` é a lista {key,label} da tela; `rows` traz {nome,
// nivel, isAnalytic, cells} com os mesmos textos da tabela da tela — aqui
// eles viram números. Sem a coluna de código, como no PDF.
function dadosDaAba({ sheetName, companyName, reportName, metaLine, columns, rows }) {
  const detalhes = partesDaMeta(metaLine, reportName);
  if (temMoeda(rows, columns)) detalhes.push("Valores em R$");
  return { nomeDaAba: sheetName || tituloDoRelatorio(reportName), titulo: tituloDoRelatorio(reportName), empresa: companyName, detalhes, colunas: columns, linhas: rows };
}

export async function exportDemonstrativoExcel(meta) {
  const workbook = novaPasta();
  await abaDeRelatorio(workbook, dadosDaAba(meta));
  await baixarPasta(workbook, `${meta.fileLabel}.xlsx`);
}

// Uma aba por relatório (o consolidado + cada empresa do grupo) — o
// "Consolidado + Individual" do menu Gerar relatórios.
export async function exportMultiSheetExcel(sheets, fileLabel) {
  const workbook = novaPasta();
  const usados = new Set();
  for (const sheet of sheets) await abaDeRelatorio(workbook, { ...dadosDaAba({ ...sheet, sheetName: sheet.sheetName || sheet.companyName }), usados });
  await baixarPasta(workbook, `${fileLabel}.xlsx`);
}
