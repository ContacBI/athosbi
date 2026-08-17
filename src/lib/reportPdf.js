import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Palette matched against the accounting team's own report templates
// (Fechamento .../Relatorios — BALANCETE/DRE/DRE EBITDA .pdf): a solid
// orange banner up top, a navy table header, and warm tan tones that get
// lighter the deeper a line sits in the account hierarchy.
const BANNER = [198, 74, 18];
const HEADER = [21, 32, 51];
const POSITIVE = [15, 110, 86];
const NEGATIVE = [168, 52, 42];
const TOTAL_COLUMN = [244, 222, 197];
const LEVEL_BG = [
  [243, 224, 202],
  [248, 238, 227],
  [246, 236, 224],
];
const LEVEL_BAR = [
  [198, 74, 18],
  [222, 158, 128],
  [233, 199, 175],
];
const ANALYTIC_TEXT = [140, 137, 133];
const BODY_TEXT = [35, 30, 26];
const BORDER = [227, 215, 201];

function drawBanner(doc, { companyName, metaLine }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BANNER);
  doc.rect(0, 0, pageWidth, 58, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.text(String(companyName || "").toUpperCase(), 24, 24);
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

function levelIndex(row) {
  return Math.min(Math.max(Number(row.nivel || 1), 1), 3) - 1;
}

// `columns` is the plain {key,label} list already shown on screen; `rows`
// carry {nome, nivel, isAnalytic, cells} — cells hold the exact same
// pre-formatted strings (money/percent) the on-screen table renders, so the
// PDF is never out of sync with what the user was just looking at. No
// account-code column, by design — just the description and the values.
export function exportDemonstrativoPdf({ companyName, metaLine, columns, rows, fileLabel }) {
  // Explicit "pt" unit — every coordinate/size below is sized in points to
  // match the accounting team's reference PDF (measured directly off it).
  // jsPDF defaults to "mm", which would make all of those numbers ~3x too
  // small and collapse the table into unreadable, character-wrapped columns.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const totalColumnIndex = columns.findIndex((column) => column.key === "total");

  autoTable(doc, {
    startY: 66,
    head: [["Descrição", ...columns.map((column) => column.label)]],
    body: rows.map((row) => [row.nome, ...columns.map((column) => row.cells[column.key] ?? "-")]),
    styles: { fontSize: 7.5, cellPadding: 4, textColor: BODY_TEXT, lineColor: BORDER, lineWidth: 0.4, valign: "middle" },
    headStyles: { fillColor: HEADER, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" },
    columnStyles: {
      0: { cellWidth: 220 },
      ...columns.reduce((acc, _column, index) => {
        acc[index + 1] = { halign: "right" };
        return acc;
      }, {}),
    },
    didParseCell(data) {
      const isTotalColumn = totalColumnIndex !== -1 && data.column.index === totalColumnIndex + 1;
      if (data.section === "head") {
        if (isTotalColumn) data.cell.styles.fillColor = [141, 61, 21];
        return;
      }
      const row = rows[data.row.index];
      if (!row) return;
      if (row.isAnalytic) {
        if (data.column.index >= 1) data.cell.styles.textColor = ANALYTIC_TEXT;
      } else {
        const level = levelIndex(row);
        data.cell.styles.fillColor = LEVEL_BG[level];
        // Every synthetic (subtotal) row gets bold, not just the top two
        // levels — at "Analítico" depth a synthetic row can sit 4-5 levels
        // deep, and without this it read the same weight as the leaf
        // accounts underneath it, with almost no visual separation.
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.lineWidth = { top: 1, right: 0.4, bottom: 0.4, left: 0.4 };
        data.cell.styles.lineColor = BORDER;
      }
      if (isTotalColumn) {
        data.cell.styles.fillColor = TOTAL_COLUMN;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index >= 1) {
        const raw = String(row.cells[columns[data.column.index - 1]?.key] ?? "");
        if (/^-/.test(raw)) data.cell.styles.textColor = NEGATIVE;
        else if (/^R\$/.test(raw)) data.cell.styles.textColor = POSITIVE;
      }
    },
    didDrawCell(data) {
      if (data.section !== "body" || data.column.index !== 0) return;
      const row = rows[data.row.index];
      if (!row || row.isAnalytic) return;
      doc.setFillColor(...LEVEL_BAR[levelIndex(row)]);
      doc.rect(data.cell.x, data.cell.y, 2.4, data.cell.height, "F");
    },
    margin: { left: 24, right: 24, top: 66, bottom: 24 },
    didDrawPage() {
      drawBanner(doc, { companyName, metaLine });
    },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawPageLabel(doc, `Página ${page}/${pageCount}`);
  }

  doc.save(`${fileLabel}.pdf`);
}
