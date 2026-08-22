import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "./format.js";

// Mesma paleta dos outros PDFs (reportPdf.js) — banner laranja, cabeçalho
// navy — pra manter a mesma identidade visual em qualquer PDF do portal.
const BANNER = [198, 74, 18];
const HEADER = [21, 32, 51];
const POSITIVE = [15, 110, 86];
const NEGATIVE = [168, 52, 42];
const BORDER = [227, 215, 201];
const BODY_TEXT = [35, 30, 26];
const GROUP_HEADER_BG = [239, 214, 186];

function drawBanner(doc, { title, metaLine }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BANNER);
  doc.rect(0, 0, pageWidth, 58, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.text(String(title || "").toUpperCase(), 24, 24);
  doc.setFontSize(9.5);
  doc.setFont(undefined, "normal");
  doc.setTextColor(250, 224, 208);
  doc.text(metaLine || "", 24, 40);
}

function drawPageLabel(doc, label) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(label, pageWidth - 24, 20, { align: "right" });
}

function formatDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "";
}

// Uma conta somada entre empresas (mergeGroupRowsByName) intercala o
// razão de cada empresa sob a mesma conta — imprimir tudo misturado, só
// por data, deixa dúbio de qual lançamento é de qual empresa. Quando
// `showCompany` vier true, `rows` já chega ordenado (empresa, depois data)
// e cada linha carrega `companyName`; aqui isso vira uma linha de cabeçalho
// (ocupando a largura toda) toda vez que a empresa muda, ANTES do primeiro
// lançamento dela — exatamente "informa no início a empresa referente, com
// os lançamentos de cada uma separados".
export function exportLedgerPdf({ label, classificacaoLabel, totalLabel, showCompany, rows, fileLabel }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const columns = ["Data", "Histórico", "Contrapartida", "Débito", "Crédito"];

  const body = [];
  // rowMeta[i] descreve o que rowIndex i do autoTable realmente é —
  // necessário porque as linhas de cabeçalho de empresa (colSpan) não têm
  // um "row" de lançamento correspondente pra didParseCell consultar.
  const rowMeta = [];
  let lastCompany = null;
  rows.forEach((row) => {
    if (showCompany && row.companyName !== lastCompany) {
      lastCompany = row.companyName;
      body.push([{ content: row.companyName || "Empresa não identificada", colSpan: 5, styles: { fillColor: GROUP_HEADER_BG, fontStyle: "bold", halign: "left", fontSize: 8.5 } }]);
      rowMeta.push({ kind: "group" });
    }
    body.push([formatDate(row.data), row.historico || "", row.counterpartText || "—", row.debito ? money(row.debito) : "", row.credito ? money(row.credito) : ""]);
    rowMeta.push({ kind: "entry", debito: row.debito, credito: row.credito });
  });

  autoTable(doc, {
    startY: 66,
    head: [columns],
    body,
    styles: { fontSize: 7.5, cellPadding: 4, textColor: BODY_TEXT, lineColor: BORDER, lineWidth: 0.4, valign: "middle" },
    headStyles: { fillColor: HEADER, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 220 },
      2: { cellWidth: 160 },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section !== "body") return;
      const meta = rowMeta[data.row.index];
      if (!meta || meta.kind !== "entry") return;
      if (data.column.index === 3 && meta.debito) data.cell.styles.textColor = POSITIVE;
      if (data.column.index === 4 && meta.credito) data.cell.styles.textColor = NEGATIVE;
    },
    margin: { left: 24, right: 24, top: 66, bottom: 24 },
    didDrawPage() {
      drawBanner(doc, { title: label, metaLine: `${classificacaoLabel} · ${totalLabel}` });
    },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawPageLabel(doc, `Página ${page}/${pageCount}`);
  }

  doc.save(`${fileLabel}.pdf`);
}
