import { COR, argb } from "./exportVisual.js";
import { baixarPasta, cabecalhoDaPlanilha, fio, fonte, impressao, linhaDeTitulos, novaPasta, preenchido, rodapeDaPlanilha } from "./excelVisual.js";

const MOEDA = '#,##0.00;-#,##0.00;"–"';

const letra = (n) => String.fromCharCode(64 + n); // 1 → A (até 26 colunas, de sobra aqui)

// O resultado da "Buscar lançamento" em Excel, no mesmo padrão do diário da conta (ledgerExcel.js): data como data, débito e crédito como números, total em fórmula.
// `rows`: [{ data, companyName, conta, codigo, historico, debito, credito }] — TODOS os achados, não só os que cabem na tela. `filtros`: texto que descreve o que foi procurado.
export async function exportBuscaLancamentosExcel({ empresa, filtros, rows, mostrarEmpresa, fileLabel }) {
  const workbook = novaPasta();
  const colunas = [
    { titulo: "Data", largura: 12 },
    ...(mostrarEmpresa ? [{ titulo: "Empresa", largura: 30 }] : []),
    { titulo: "Código", largura: 16 },
    { titulo: "Conta", largura: 36 },
    { titulo: "Histórico", largura: 60 },
    { titulo: "Débito", largura: 17, valor: true },
    { titulo: "Crédito", largura: 17, valor: true },
  ];
  const n = colunas.length;
  const colDeb = n - 1;
  const colCre = n;
  const sheet = workbook.addWorksheet("Lançamentos", {
    properties: { tabColor: { argb: argb(COR.acento) } },
    views: [{ state: "frozen", ySplit: 6, showGridLines: false, activeCell: "A7" }],
  });
  colunas.forEach((coluna, i) => {
    sheet.getColumn(i + 1).width = coluna.largura;
  });
  await cabecalhoDaPlanilha(workbook, sheet, {
    titulo: "Consulta de lançamentos",
    empresa,
    detalhes: [filtros, `${rows.length} lançamento${rows.length === 1 ? "" : "s"}`, "Valores em R$"],
    ultima: n,
  });
  linhaDeTitulos(sheet, 6, colunas.map((coluna) => coluna.titulo), { alinhar: (i) => (i >= n - 2 ? "right" : "left") });

  let numero = 7;
  rows.forEach((row) => {
    const linha = sheet.getRow(numero);
    const [ano, mes, dia] = String(row.data || "").split("-").map(Number);
    // Data em UTC: o Excel guarda o dia sem fuso — com a meia-noite local, um fuso adiantado viraria o dia anterior.
    const data = ano && mes && dia ? new Date(Date.UTC(ano, mes - 1, dia)) : row.data || "";
    linha.values = [data, ...(mostrarEmpresa ? [row.companyName || ""] : []), row.codigo || "", row.conta || "", row.historico || "", Number(row.debito || 0) || null, Number(row.credito || 0) || null];
    linha.eachCell({ includeEmpty: true }, (cell, coluna) => {
      cell.border = fio;
      cell.font = fonte({ color: { argb: argb(coluna >= colDeb ? COR.tinta : COR.tinta2) } });
      cell.alignment = { vertical: "middle", horizontal: coluna >= colDeb ? "right" : "left", wrapText: coluna === n - 2 };
      if (coluna === 1) cell.numFmt = "dd/mm/yyyy";
      if (coluna >= colDeb) cell.numFmt = MOEDA;
    });
    numero += 1;
  });

  const total = sheet.getRow(numero);
  const valores = Array(n).fill("");
  valores[n - 3] = "Total dos lançamentos encontrados";
  valores[colDeb - 1] = { formula: `SUM(${letra(colDeb)}7:${letra(colDeb)}${numero - 1})` };
  valores[colCre - 1] = { formula: `SUM(${letra(colCre)}7:${letra(colCre)}${numero - 1})` };
  total.values = valores;
  total.height = 20;
  for (let c = 1; c <= n; c += 1) {
    const cell = total.getCell(c);
    cell.fill = preenchido(COR.acentoSuave);
    cell.font = fonte({ bold: true });
    cell.border = c === 1 ? { ...fio, left: { style: "thick", color: { argb: argb(COR.acento) } } } : fio;
    if (c >= colDeb) Object.assign(cell, { numFmt: MOEDA, alignment: { horizontal: "right", vertical: "middle" } });
  }
  rodapeDaPlanilha(sheet, numero + 2);
  impressao(sheet, { empresa, paisagem: true });
  await baixarPasta(workbook, `${fileLabel}.xlsx`);
}
