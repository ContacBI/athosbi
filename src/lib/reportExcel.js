import { escapeHtml } from "./format.js";

// Byte-for-byte the same CSS as the accounting team's own report templates
// (Fechamento .../Relatorios — Balancete/DRE/DRE EBITDA .xls, which are
// themselves just styled HTML tables saved with an .xls extension — Excel
// opens that format natively, styling and all).
const STYLE = `
body{font-family:Segoe UI,Arial,sans-serif;background:#f7f3ee;color:#211b16}
.sheet{background:#fffdf9;border:1px solid #d8c5ad}
.title{font-size:22px;font-weight:800;color:#ffffff;background:#c64a12;padding:16px 18px}
.meta{font-size:12px;color:#6b5f55;background:#fff4e8;padding:8px 18px}
table{border-collapse:collapse;width:100%;font-size:11px}
th{background:#152033;color:#ffffff;text-align:center;font-weight:800;border:1px solid #d8c5ad;padding:8px}
td{border:1px solid #e3d7c9;padding:6px 8px;vertical-align:middle}
.description{mso-number-format:"\\@";text-align:left;min-width:320px}
.number{text-align:right;white-space:nowrap}
.level-1{background:#d9f99d;font-weight:800;border-top:2px solid #4d7c0f}
.level-2{background:#ecfccb;font-weight:700;border-top:2px solid #65a30d}
.level-3{background:#eef7de;font-weight:700;border-top:1.5px solid #84a874}
.level-4{background:#f2f7e9;font-weight:700;border-top:1.5px solid #9cb68f}
.analytic{background:#ffffff;color:#252525}.heading{background:#e8eef7;font-weight:800}
`;

function rowClass(row) {
  if (row.isAnalytic) return "analytic";
  const level = Math.min(Math.max(Number(row.nivel || 1), 1), 4);
  return `level-${level}`;
}

function indentFor(row) {
  return 10 + 16 * Math.max(0, Number(row.nivel || 1) - 1);
}

// `columns` is the plain {key,label} list already shown on screen; `rows`
// carry {nome, nivel, isAnalytic, cells} — cells hold the exact same
// pre-formatted strings (money/percent) the on-screen table renders. No
// account-code column, by design — just the description and the values.
export function exportDemonstrativoExcel({ companyName, reportName, metaLine, columns, rows, fileLabel }) {
  const headCells = ["<th>Descrição</th>", ...columns.map((column) => `<th>${escapeHtml(column.label)}</th>`)].join("");

  const bodyRows = rows
    .map((row) => {
      const cells = columns.map((column) => `<td class="number">${escapeHtml(row.cells[column.key] ?? "-")}</td>`).join("");
      return `<tr class="${rowClass(row)}"><td class="description" style="padding-left:${indentFor(row)}px">${escapeHtml(row.nome)}</td>${cells}</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><title>${escapeHtml(reportName)}</title>
<style>${STYLE}</style></head>
<body><section class="sheet"><div class="title">${escapeHtml(companyName)}</div><div class="meta">${escapeHtml(metaLine)}</div><table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></section></body></html>`;

  const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileLabel}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
