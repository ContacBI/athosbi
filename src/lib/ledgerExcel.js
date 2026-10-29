import { COR, argb } from "./exportVisual.js";
import { baixarPasta, cabecalhoDaPlanilha, fio, fonte, impressao, linhaDeTitulos, novaPasta, preenchido, rodapeDaPlanilha } from "./excelVisual.js";

const MOEDA = '#,##0.00;-#,##0.00;"–"';

// Os lançamentos de uma conta em Excel, no mesmo padrão do PDF (ledgerPdf.js):
// data como data, débito e crédito como números e o total do período em
// fórmula. Numa conta somada entre empresas, uma linha com o nome da empresa
// antes dos lançamentos dela.
export async function exportLedgerExcel({ label, companyName, classificacaoLabel, totalLabel, showCompany, rows, fileLabel }) {
  const workbook = novaPasta();
  const sheet = workbook.addWorksheet("Lançamentos", {
    properties: { tabColor: { argb: argb(COR.acento) } },
    views: [{ state: "frozen", ySplit: 6, showGridLines: false, activeCell: "A7" }],
  });
  [12, 54, 42, 17, 17].forEach((largura, i) => {
    sheet.getColumn(i + 1).width = largura;
  });
  await cabecalhoDaPlanilha(workbook, sheet, { titulo: "Lançamentos da conta", empresa: label, detalhes: [companyName, classificacaoLabel, totalLabel, "Valores em R$"], ultima: 5 });
  linhaDeTitulos(sheet, 6, ["Data", "Histórico", "Contrapartida", "Débito", "Crédito"], { alinhar: (i) => (i >= 3 ? "right" : "left") });

  let numero = 7;
  let lastCompany = null;
  rows.forEach((row) => {
    if (showCompany && row.companyName !== lastCompany) {
      lastCompany = row.companyName;
      const grupo = sheet.getRow(numero);
      grupo.getCell(1).value = row.companyName || "Empresa não identificada";
      for (let c = 1; c <= 5; c += 1) {
        const cell = grupo.getCell(c);
        cell.fill = preenchido(COR.faixa);
        cell.font = fonte({ bold: true });
        cell.border = fio;
      }
      grupo.height = 20;
      numero += 1;
    }
    const linha = sheet.getRow(numero);
    const [ano, mes, dia] = String(row.data || "").split("-").map(Number);
    // Data em UTC: o Excel guarda o dia sem fuso — com a meia-noite local, um fuso adiantado viraria o dia anterior.
    linha.values = [ano && mes && dia ? new Date(Date.UTC(ano, mes - 1, dia)) : row.data || "", row.historico || "", row.counterpartText || "—", Number(row.debito || 0) || null, Number(row.credito || 0) || null];
    linha.eachCell({ includeEmpty: true }, (cell, coluna) => {
      cell.border = fio;
      cell.font = fonte({ color: { argb: argb(coluna >= 4 ? COR.tinta : COR.tinta2) } });
      cell.alignment = { vertical: "middle", horizontal: coluna >= 4 ? "right" : "left", wrapText: coluna === 2 || coluna === 3 };
      if (coluna === 1) cell.numFmt = "dd/mm/yyyy";
      if (coluna >= 4) cell.numFmt = MOEDA;
    });
    numero += 1;
  });

  const total = sheet.getRow(numero);
  total.values = ["", "Total do período", "", { formula: `SUM(D7:D${numero - 1})` }, { formula: `SUM(E7:E${numero - 1})` }];
  total.height = 20;
  for (let c = 1; c <= 5; c += 1) {
    const cell = total.getCell(c);
    cell.fill = preenchido(COR.acentoSuave);
    cell.font = fonte({ bold: true });
    cell.border = c === 1 ? { ...fio, left: { style: "thick", color: { argb: argb(COR.acento) } } } : fio;
    if (c >= 4) Object.assign(cell, { numFmt: MOEDA, alignment: { horizontal: "right", vertical: "middle" } });
  }
  rodapeDaPlanilha(sheet, numero + 2);
  impressao(sheet, { empresa: label, paisagem: true });
  await baixarPasta(workbook, `${fileLabel}.xlsx`);
}
