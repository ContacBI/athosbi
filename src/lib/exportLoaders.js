// As bibliotecas de PDF/Excel/zip (jsPDF, ExcelJS, JSZip, html2canvas) são
// pesadas e só servem na hora de baixar um arquivo — então só são baixadas
// nesse momento, e não junto com o site. Mesmos nomes e parâmetros das
// funções originais; aqui elas devolvem uma promessa.

function failed(error) {
  console.error("Falha ao gerar o arquivo:", error);
  // Quase sempre é o site que foi atualizado com a página aberta: o pedaço
  // antigo do pacote não existe mais no servidor.
  window.alert("Não consegui gerar o arquivo agora. Recarregue a página (F5) e tente de novo.");
  throw error;
}

const lazy = (load, name) => (...args) => load().then((module) => module[name](...args)).catch(failed);

export const loadReportPdf = () => import("./reportPdf.js");
export const exportDemonstrativoPdf = lazy(loadReportPdf, "exportDemonstrativoPdf");
export const exportDemonstrativoExcel = lazy(() => import("./reportExcel.js"), "exportDemonstrativoExcel");
export const exportMultiSheetExcel = lazy(() => import("./reportExcel.js"), "exportMultiSheetExcel");
export const downloadZip = lazy(() => import("./zipExport.js"), "downloadZip");
export const exportDomSnapshotPdf = lazy(() => import("./domSnapshotPdf.js"), "exportDomSnapshotPdf");
export const exportLedgerPdf = lazy(() => import("./ledgerPdf.js"), "exportLedgerPdf");
export const exportLedgerExcel = lazy(() => import("./ledgerExcel.js"), "exportLedgerExcel");
