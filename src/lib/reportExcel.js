import ExcelJS from "exceljs";
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

// O Excel de verdade (diferente de um navegador) ignora silenciosamente
// `padding-left` num <td> ao importar HTML como .xls — qualquer recuo por
// CSS só aparecia numa pré-visualização em navegador, nunca no arquivo
// aberto no Excel de verdade, o que fazia toda a hierarquia parecer
// achatada (mesma indentação em toda linha, exatamente o problema
// reportado). Recuo como CONTEÚDO ("&nbsp;" — espaço fixo, não espaço
// comum, que o parser HTML colapsa numa só ocorrência) sempre sobrevive,
// em qualquer aplicativo que abra o arquivo. Aplicado ANTES do
// escapeHtml normal — cada "&nbsp;" vai cru (não escapado) na frente do
// nome já escapado.
function indentedName(row) {
  return "&nbsp;&nbsp;".repeat(Math.max(0, Number(row.nivel || 1) - 1)) + escapeHtml(row.nome || "");
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
      return `<tr class="${rowClass(row)}"><td class="description">${indentedName(row)}</td>${cells}</tr>`;
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

// Nomes de aba do Excel não aceitam \ / ? * [ ] : e têm limite de 31
// caracteres — corta e troca esses caracteres, e desempata com um sufixo
// numérico se duas empresas gerarem o mesmo nome truncado.
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g;

function sanitizeSheetName(name, usedNames) {
  const base = (String(name || "Aba").replace(INVALID_SHEET_CHARS, " ").trim().slice(0, 31) || "Aba");
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base.slice(0, 28)} ${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

// Mesmas 4 cores (cada vez mais claras) do .xls acima, mas como fill do
// ExcelJS — sintética nível 1 é a mais forte, nível 4+ a mais clara;
// analítica (conta de verdade, sem filhos) fica sem fundo nenhum.
const LEVEL_FILL = ["FFD9F99D", "FFECFCCB", "FFEEF7DE", "FFF2F7E9"];

function levelFill(row) {
  if (row.isAnalytic) return null;
  const level = Math.min(Math.max(Number(row.nivel || 1), 1), 4);
  return LEVEL_FILL[level - 1];
}

// Um .xlsx de verdade com uma aba por relatório (consolidado + cada
// empresa do grupo) — diferente de exportDemonstrativoExcel acima, que
// gera um .xls único (uma tabela HTML disfarçada) sem abas de verdade.
// Usado só pelo export "Consolidado + Individual" do grupo, onde múltiplas
// abas nomeadas é o pedido explícito. Usa o recuo NATIVO do Excel
// (alignment.indent) em vez de espaços no texto — ao contrário do truque
// necessário no .xls acima, um .xlsx de verdade honra essa propriedade
// normalmente.
export async function exportMultiSheetExcel(sheets, fileLabel) {
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set();
  sheets.forEach(({ sheetName, companyName, metaLine, columns, rows }) => {
    const sheet = workbook.addWorksheet(sanitizeSheetName(sheetName || companyName, usedNames));
    sheet.addRow([companyName]).font = { bold: true, size: 14 };
    sheet.addRow([metaLine]).font = { italic: true, color: { argb: "FF6B5F55" } };
    sheet.addRow([]);
    const headerRow = sheet.addRow(["Descrição", ...columns.map((column) => column.label)]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF152033" } };
      cell.alignment = { horizontal: "center" };
    });
    rows.forEach((row) => {
      const dataRow = sheet.addRow([row.nome, ...columns.map((column) => row.cells[column.key] ?? "-")]);
      const descCell = dataRow.getCell(1);
      // nível 1 sem recuo, cada nível seguinte some mais um passo — é isso
      // que dá a "escadinha" da hierarquia; sem isso toda linha ficava
      // colada na mesma margem, com a cor de fundo como única pista.
      descCell.alignment = { indent: Math.max(0, Number(row.nivel || 1) - 1) };
      if (!row.isAnalytic) {
        dataRow.font = { bold: true };
        const fill = levelFill(row);
        if (fill) dataRow.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }; });
      }
      for (let index = 2; index <= columns.length + 1; index += 1) {
        dataRow.getCell(index).alignment = { horizontal: "right" };
      }
    });
    sheet.getColumn(1).width = 42;
    for (let index = 2; index <= columns.length + 1; index += 1) sheet.getColumn(index).width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileLabel}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
