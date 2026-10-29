import autoTable from "jspdf-autotable";
import { money } from "./format.js";
import { COR, rgb, semMoeda } from "./exportVisual.js";
import { BASE, MARGEM, TOPO_DEMAIS, TOPO_PRIMEIRA, acabamento, fonteDe, novoPdf, usar } from "./pdfVisual.js";

function formatDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "";
}

const valor = (numero) => (Math.abs(Number(numero || 0)) < 0.005 ? "" : semMoeda(money(numero)));

// Os lançamentos de uma conta (o "razão" que abre ao clicar numa linha) no
// padrão dos downloads (pdfVisual.js), com o total do período no fim.
//
// Uma conta somada entre empresas (mergeGroupRowsByName) intercala o
// razão de cada empresa sob a mesma conta — imprimir tudo misturado, só
// por data, deixa dúbio de qual lançamento é de qual empresa. Quando
// `showCompany` vier true, `rows` já chega ordenado (empresa, depois data)
// e cada linha carrega `companyName`; aqui isso vira uma linha de cabeçalho
// (ocupando a largura toda) toda vez que a empresa muda, ANTES do primeiro
// lançamento dela.
export async function exportLedgerPdf({ label, companyName, classificacaoLabel, totalLabel, showCompany, rows, fileLabel }) {
  const doc = await novoPdf({ paisagem: true });
  const fonte = (peso) => fonteDe(doc, peso)[0];
  const largura = doc.internal.pageSize.getWidth() - MARGEM * 2;

  const body = [];
  // rowMeta[i] diz o que a linha i da tabela é (cabeçalho de empresa, lançamento ou total).
  const rowMeta = [];
  let lastCompany = null;
  let debitos = 0;
  let creditos = 0;
  rows.forEach((row) => {
    if (showCompany && row.companyName !== lastCompany) {
      lastCompany = row.companyName;
      body.push([{ content: row.companyName || "Empresa não identificada", colSpan: 5 }]);
      rowMeta.push({ kind: "group" });
    }
    debitos += Number(row.debito || 0);
    creditos += Number(row.credito || 0);
    body.push([formatDate(row.data), row.historico || "", row.counterpartText || "—", valor(row.debito), valor(row.credito)]);
    rowMeta.push({ kind: "entry" });
  });
  body.push(["", "Total do período", "", valor(debitos), valor(creditos)]);
  rowMeta.push({ kind: "total" });

  // Débito e crédito do tamanho do maior valor; histórico e contrapartida dividem o resto.
  usar(doc, "bold", 10);
  const maior = Math.max(doc.getTextWidth(valor(debitos) || "0"), doc.getTextWidth(valor(creditos) || "0"), ...body.flatMap((linha) => (linha.length === 5 ? [doc.getTextWidth(linha[3]), doc.getTextWidth(linha[4])] : [])));
  const colunaDeValor = Math.max(70, Math.ceil((maior * 7.6) / 10 + 16));
  const data = 58;
  const resto = largura - data - colunaDeValor * 2;

  autoTable(doc, {
    theme: "plain",
    startY: TOPO_PRIMEIRA,
    margin: { top: TOPO_DEMAIS, bottom: BASE, left: MARGEM, right: MARGEM },
    head: [["Data", "Histórico", "Contrapartida", "Débito", "Crédito"]],
    body,
    styles: { font: fonte("regular"), fontStyle: "normal", fontSize: 7.6, textColor: rgb(COR.tinta2), cellPadding: { top: 4, bottom: 4, left: 6, right: 6 }, lineWidth: 0, overflow: "linebreak", valign: "middle" },
    headStyles: { font: fonte("semi"), fillColor: rgb(COR.cabecalho), textColor: [255, 255, 255], cellPadding: { top: 6.4, bottom: 6.4, left: 6, right: 6 } },
    columnStyles: {
      0: { cellWidth: data },
      1: { cellWidth: resto * 0.58 },
      2: { cellWidth: resto * 0.42 },
      3: { cellWidth: colunaDeValor, halign: "right" },
      4: { cellWidth: colunaDeValor, halign: "right" },
    },
    didParseCell({ cell, column, row, section }) {
      if (section === "head") {
        if (column.index >= 3) cell.styles.halign = "right";
        return;
      }
      const meta = rowMeta[row.index];
      if (!meta) return;
      cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.5, left: 0 };
      cell.styles.lineColor = rgb(COR.linha);
      if (meta.kind === "group") {
        cell.styles.fillColor = rgb(COR.faixa);
        cell.styles.font = fonte("bold");
        cell.styles.textColor = rgb(COR.tinta);
      } else if (meta.kind === "total") {
        cell.styles.fillColor = rgb(COR.acentoSuave);
        cell.styles.font = fonte("bold");
        cell.styles.textColor = rgb(COR.tinta);
      } else if (column.index >= 3) {
        cell.styles.textColor = rgb(COR.tinta);
      }
    },
    didDrawCell(data) {
      if (data.section !== "body" || data.column.index !== 0 || rowMeta[data.row.index]?.kind !== "total") return;
      doc.setFillColor(...rgb(COR.acento));
      doc.rect(data.cell.x, data.cell.y, 2.2, data.cell.height, "F");
    },
  });

  acabamento(doc, { titulo: "Lançamentos da conta", empresa: label, detalhes: [companyName, classificacaoLabel, totalLabel], nota: "Valores em R$" });
  doc.save(`${fileLabel}.pdf`);
}
