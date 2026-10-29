import ExcelJS from "exceljs";
import { COR, argb, baixarBlob, carimbo, lerValor, nomeDaAba, semMoeda } from "./exportVisual.js";

// O desenho comum das planilhas do portal (ver exportVisual.js): um .xlsx
// de verdade — abre no Excel sem aviso, os valores são números (somam e
// filtram), o cabeçalho com a logo da Athos, a tabela com o cabeçalho fixo
// na rolagem, os níveis agrupados (o +/− do próprio Excel abre e fecha cada
// grupo) e a impressão já ajustada à largura da página.

const FONTE = "Segoe UI";
const LINHA_DO_CABECALHO = 6;
const MOEDA = '#,##0.00;-#,##0.00;"–"';
const PCT = '0.0%;-0.0%;"–"';
const INTEIRO = '#,##0;-#,##0;"–"';

const LOGO = new URL("../assets/athos-logo.png", import.meta.url).href;
let logo = null;
function carregarLogo() {
  if (!logo) {
    logo = fetch(LOGO)
      .then((resposta) => {
        if (!resposta.ok) throw new Error(`logo: ${resposta.status}`);
        return resposta.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let texto = "";
        for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `data:image/png;base64,${btoa(texto)}`;
      })
      .catch((error) => {
        console.warn("Planilha sem a logo:", error);
        logo = null;
        return null;
      });
  }
  return logo;
}

export function novaPasta() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Athos B.I.";
  workbook.created = new Date();
  return workbook;
}

export async function baixarPasta(workbook, nome) {
  const buffer = await workbook.xlsx.writeBuffer();
  baixarBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nome);
}

export const fonte = (extra = {}) => ({ name: FONTE, size: 10, color: { argb: argb(COR.tinta) }, ...extra });
export const preenchido = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
export const fio = { bottom: { style: "thin", color: { argb: argb(COR.linha) } } };

// Largura aproximada em pixels de uma coluna do Excel (largura em caracteres).
const pixels = (largura) => Math.round(largura * 7 + 5);

// Cabeçalho da planilha (linhas 1–5): a faixa laranja, o tipo de relatório,
// a empresa, os detalhes e a logo à direita. `ultima` = nº da última coluna.
export async function cabecalhoDaPlanilha(workbook, sheet, { titulo, empresa, detalhes = [], ultima }) {
  sheet.getRow(1).height = 6;
  for (let c = 1; c <= ultima; c += 1) sheet.getCell(1, c).fill = preenchido(COR.acento);
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 26;
  sheet.getRow(4).height = 17;
  sheet.getRow(5).height = 8;
  Object.assign(sheet.getCell("A2"), { value: String(titulo || "").toUpperCase(), font: fonte({ size: 9, bold: true, color: { argb: argb(COR.acento) } }), alignment: { vertical: "bottom" } });
  Object.assign(sheet.getCell("A3"), { value: empresa || "", font: fonte({ size: 16, bold: true }), alignment: { vertical: "middle" } });
  Object.assign(sheet.getCell("A4"), { value: detalhes.filter(Boolean).join("   ·   "), font: fonte({ size: 9, color: { argb: argb(COR.tinta3) } }), alignment: { vertical: "top" } });

  const imagem = await carregarLogo();
  if (!imagem) return;
  // A logo encostada na direita da última coluna, ao lado do título. Se a
  // tabela for estreita demais pros dois (um relatório de uma coluna só),
  // alarga a última coluna. As posições vão em EMU (9525 por pixel) — a
  // conta de coluna "fracionada" do ExcelJS erra quando a largura é própria.
  const largura = 112;
  const altura = Math.round((largura * 153) / 630);
  const larguraDe = (c) => pixels(sheet.getColumn(c).width || 10);
  const precisa = Math.max(String(titulo || "").length * 8.5, String(empresa || "").length * 13) + largura + 40;
  let total = 0;
  for (let c = 1; c <= ultima; c += 1) total += larguraDe(c);
  if (total < precisa) sheet.getColumn(ultima).width = (sheet.getColumn(ultima).width || 10) + Math.ceil((precisa - total) / 7);
  let resta = largura + 4;
  let coluna = ultima;
  while (coluna > 1 && resta > larguraDe(coluna)) {
    resta -= larguraDe(coluna);
    coluna -= 1;
  }
  const id = workbook.addImage({ base64: imagem, extension: "png" });
  sheet.addImage(id, {
    tl: { nativeCol: coluna - 1, nativeColOff: Math.max(0, larguraDe(coluna) - resta) * 9525, nativeRow: 1, nativeRowOff: 6 * 9525 },
    ext: { width: largura, height: altura },
    editAs: "absolute",
  });
}

// Impressão: A4, ajustada à largura, cabeçalho da tabela repetido em toda
// página e o rodapé com a empresa e a página.
export function impressao(sheet, { empresa, paisagem, linhaDoCabecalho = LINHA_DO_CABECALHO }) {
  sheet.pageSetup = {
    paperSize: 9,
    orientation: paisagem ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
    printTitlesRow: `${linhaDoCabecalho}:${linhaDoCabecalho}`,
  };
  const seguro = String(empresa || "").replace(/&/g, "&&");
  sheet.headerFooter = { oddFooter: `&L&"${FONTE},Regular"&8Athos B.I. · ${seguro}&R&"${FONTE},Regular"&8Página &P de &N` };
}

export function linhaDeTitulos(sheet, numero, titulos, { alinhar = () => "right", destacar = () => false } = {}) {
  const linha = sheet.getRow(numero);
  linha.height = 24;
  titulos.forEach((titulo, i) => {
    const cell = linha.getCell(i + 1);
    cell.value = titulo;
    cell.font = fonte({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = preenchido(destacar(i) ? COR.acento : COR.cabecalho);
    cell.alignment = { horizontal: alinhar(i), vertical: "middle", indent: i === 0 ? 1 : 0 };
  });
}

export function rodapeDaPlanilha(sheet, numero) {
  Object.assign(sheet.getCell(numero, 1), { value: `Gerado pelo Athos B.I. em ${carimbo()}`, font: fonte({ size: 8, italic: true, color: { argb: argb(COR.tinta3) } }) });
}

// Escreve um texto já formatado da tela como valor de verdade na célula.
function escreverValor(cell, texto) {
  const lido = lerValor(texto);
  if (lido.tipo === "moeda") Object.assign(cell, { value: lido.valor, numFmt: MOEDA });
  else if (lido.tipo === "pct") Object.assign(cell, { value: lido.valor, numFmt: PCT });
  else if (lido.tipo === "numero") Object.assign(cell, { value: lido.valor, numFmt: lido.decimais ? MOEDA : INTEIRO });
  else if (lido.tipo === "vazio") {
    if (lido.texto === "-") Object.assign(cell, { value: 0, numFmt: MOEDA });
    else if (lido.texto) cell.value = lido.texto;
  } else cell.value = semMoeda(lido.texto);
  return lido;
}

const ehColunaDeTotal = (coluna) => coluna.key === "total" || /^(saldo )?total/i.test(String(coluna.label || ""));
const semValor = (linha, colunas) => colunas.every((coluna) => !String(linha.cells?.[coluna.key] ?? "").trim());
const letra = (n) => {
  let texto = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) texto = String.fromCharCode(65 + ((x - 1) % 26)) + texto;
  return texto;
};

// Uma aba com um demonstrativo (as mesmas linhas {nome, nivel, isAnalytic,
// cells} e colunas {key, label} que o PDF e a tela usam).
export async function abaDeRelatorio(workbook, { nomeDaAba: nome, usados = new Set(), titulo, empresa, detalhes = [], colunas, linhas }) {
  const ultima = colunas.length + 1;
  const sheet = workbook.addWorksheet(nomeDaAba(nome, usados), {
    properties: { tabColor: { argb: argb(COR.acento) }, outlineProperties: { summaryBelow: false, summaryRight: false } },
    views: [{ state: "frozen", xSplit: 1, ySplit: LINHA_DO_CABECALHO, showGridLines: false, activeCell: `B${LINHA_DO_CABECALHO + 1}` }],
  });

  const sinteticas = linhas.filter((linha) => !linha.isAnalytic).map((linha) => Number(linha.nivel || 1));
  const topo = sinteticas.length ? Math.min(...sinteticas) : 1;
  const recuo = (linha) => Math.min(6, Math.max(0, Number(linha.nivel || 1) - topo));

  // Larguras: a descrição pelo maior nome (com o recuo), os valores pelo maior texto.
  const maiorNome = linhas.reduce((maior, linha) => Math.max(maior, String(linha.nome || "").length + recuo(linha) * 2), 0);
  sheet.getColumn(1).width = Math.min(64, Math.max(38, maiorNome + 4));
  colunas.forEach((coluna, j) => {
    const maior = linhas.reduce((m, linha) => Math.max(m, semMoeda(linha.cells?.[coluna.key] ?? "").length), String(coluna.label || "").length);
    sheet.getColumn(j + 2).width = Math.min(24, Math.max(14, maior + 4));
  });

  await cabecalhoDaPlanilha(workbook, sheet, { titulo, empresa, detalhes, ultima });
  const totais = colunas.map(ehColunaDeTotal);
  linhaDeTitulos(sheet, LINHA_DO_CABECALHO, ["Descrição", ...colunas.map((coluna) => coluna.label)], { alinhar: (i) => (i === 0 ? "left" : "right"), destacar: (i) => i > 0 && totais[i - 1] });

  linhas.forEach((linha, i) => {
    const numero = LINHA_DO_CABECALHO + 1 + i;
    const row = sheet.getRow(numero);
    const destaque = Boolean(linha.destaque) || (!linha.isAnalytic && (Number(linha.nivel || 1) <= topo || semValor(linha, colunas)));
    const sintetica = !linha.isAnalytic;
    const cor = linha.isAnalytic || Number(linha.nivel || 1) - topo >= 2 ? COR.tinta2 : COR.tinta;
    row.height = destaque ? 20 : 18;
    row.outlineLevel = recuo(linha);

    const nomeCell = row.getCell(1);
    nomeCell.value = linha.nome || "";
    nomeCell.font = fonte({ bold: sintetica, color: { argb: argb(cor) } });
    nomeCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 + recuo(linha) * 2 };
    nomeCell.border = fio;
    if (destaque) {
      nomeCell.fill = preenchido(COR.acentoSuave);
      nomeCell.border = { ...fio, left: { style: "thick", color: { argb: argb(COR.acento) } } };
    }

    colunas.forEach((coluna, j) => {
      const cell = row.getCell(j + 2);
      const lido = escreverValor(cell, linha.cells?.[coluna.key] ?? "");
      const zero = lido.tipo === "vazio";
      cell.font = fonte({ bold: sintetica || totais[j], color: { argb: argb(zero ? COR.tinta3 : cor) } });
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = fio;
      if (destaque) cell.fill = preenchido(COR.acentoSuave);
      else if (totais[j]) cell.fill = preenchido(COR.coluna);
    });
  });

  // Os botões 1, 2, 3… do agrupamento. Um nível a mais que o mais fundo: o
  // ExcelJS marca como "recolhida" toda linha no nível máximo (e aí ela
  // abre fechada) — assim tudo abre aberto.
  sheet.properties.outlineLevelRow = linhas.reduce((maior, linha) => Math.max(maior, recuo(linha)), 0) + 1;
  const ultimaLinha = LINHA_DO_CABECALHO + linhas.length;
  if (linhas.length && colunas.length) {
    // Negativo em vermelho (por cima da cor da linha).
    sheet.addConditionalFormatting({
      ref: `B${LINHA_DO_CABECALHO + 1}:${letra(ultima)}${ultimaLinha}`,
      rules: [{ type: "cellIs", operator: "lessThan", formulae: [0], priority: 1, style: { font: { color: { argb: argb(COR.negativo) } } } }],
    });
  }
  rodapeDaPlanilha(sheet, ultimaLinha + 2);
  impressao(sheet, { empresa, paisagem: colunas.length > 4 });
  return sheet;
}
