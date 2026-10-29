import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ATHOS_LETTERS, ATHOS_STEPS } from "./athosLogo.js";
import { COR, carimbo, ehNegativo, ehZero, rgb, semMoeda } from "./exportVisual.js";

// O desenho comum de todo PDF do portal (ver exportVisual.js): a fonte da
// marca (Plus Jakarta Sans, a mesma do site), a logo da Athos em vetor, o
// cabeçalho da 1ª página, o cabeçalho curto das seguintes, o rodapé com a
// data e a página, e a tabela de relatório com as colunas medidas pra
// nenhum valor quebrar em duas linhas.

export const MARGEM = 36;
export const TOPO_PRIMEIRA = 98; // onde o conteúdo começa na 1ª página
export const TOPO_DEMAIS = 52; // e nas seguintes (abaixo do cabeçalho curto)
export const BASE = 46; // espaço reservado pro rodapé

// Arquivos .ttf da fonte (convertidos da variável do site, com algarismos
// de largura fixa — os valores de uma coluna ficam alinhados). Só são
// baixados na hora do primeiro PDF.
const ARQUIVOS = {
  regular: new URL("../assets/fonts/PlusJakartaSans-Regular.ttf", import.meta.url).href,
  semi: new URL("../assets/fonts/PlusJakartaSans-SemiBold.ttf", import.meta.url).href,
  bold: new URL("../assets/fonts/PlusJakartaSans-Bold.ttf", import.meta.url).href,
  forte: new URL("../assets/fonts/PlusJakartaSans-ExtraBold.ttf", import.meta.url).href,
};
const FAMILIA = { regular: "AthosRegular", semi: "AthosSemi", bold: "AthosBold", forte: "AthosForte" };
const RESERVA = { regular: ["helvetica", "normal"], semi: ["helvetica", "bold"], bold: ["helvetica", "bold"], forte: ["helvetica", "bold"] };

function paraBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

let fontes = null;
function carregarFontes() {
  if (!fontes) {
    fontes = Promise.all(
      Object.entries(ARQUIVOS).map(async ([peso, url]) => {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`fonte ${peso}: ${resposta.status}`);
        return [peso, paraBase64(await resposta.arrayBuffer())];
      })
    )
      .then(Object.fromEntries)
      .catch((error) => {
        // Sem a fonte (fora do ar, site atualizado com a página aberta…): sai com a Helvetica do próprio PDF.
        console.warn("PDF sem a fonte da marca:", error);
        fontes = null;
        return null;
      });
  }
  return fontes;
}

export async function novoPdf({ paisagem = true } = {}) {
  const doc = new jsPDF({ orientation: paisagem ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
  const dados = await carregarFontes();
  if (dados) {
    Object.entries(dados).forEach(([peso, base64]) => {
      doc.addFileToVFS(`${FAMILIA[peso]}.ttf`, base64);
      doc.addFont(`${FAMILIA[peso]}.ttf`, FAMILIA[peso], "normal");
    });
    doc.athosFontes = Object.fromEntries(Object.entries(FAMILIA).map(([peso, familia]) => [peso, [familia, "normal"]]));
  } else {
    doc.athosFontes = RESERVA;
  }
  doc.setProperties({ creator: "Athos B.I.", producer: "Athos B.I." });
  return doc;
}

export const fonteDe = (doc, peso) => (doc.athosFontes || RESERVA)[peso];

export function usar(doc, peso, tamanho, cor) {
  doc.setFont(...fonteDe(doc, peso));
  if (tamanho) doc.setFontSize(tamanho);
  if (cor) doc.setTextColor(...rgb(cor));
}

// O "ATHOS" da logo (lib/athosLogo.js) como caminho do PDF — o SVG só usa
// M, C, L e Z absolutos.
let letras = null;
function caminhoDasLetras() {
  if (letras) return letras;
  const lista = [];
  let atual = null;
  for (const token of ATHOS_LETTERS.match(/[MCLZ]|-?\d*\.?\d+/g)) {
    if (/[MCLZ]/.test(token)) {
      atual = { tipo: token, numeros: [] };
      lista.push(atual);
    } else atual.numeros.push(Number(token));
  }
  letras = [];
  lista.forEach(({ tipo, numeros }) => {
    if (tipo === "Z") letras.push({ op: "h", c: [] });
    else if (tipo === "C") for (let i = 0; i + 5 < numeros.length; i += 6) letras.push({ op: "c", c: numeros.slice(i, i + 6) });
    else
      for (let i = 0; i + 1 < numeros.length; i += 2) letras.push({ op: tipo === "M" && i === 0 ? "m" : "l", c: numeros.slice(i, i + 2) });
  });
  return letras;
}

// A logo em (x, y), com `altura` pt; devolve a largura usada.
export function desenharLogo(doc, x, y, altura, { comLetras = true, corDasLetras = COR.tinta } = {}) {
  const escala = altura / 51; // o desenho ocupa 51 unidades de altura (viewBox "5 4 210 51")
  const px = (vx) => x + (vx - 5) * escala;
  const py = (vy) => y + (vy - 4) * escala;
  ATHOS_STEPS.forEach(([vx, vy, cor]) => {
    doc.setFillColor(...rgb(cor));
    doc.roundedRect(px(vx), py(vy), 15 * escala, 15 * escala, 3 * escala, 3 * escala, "F");
  });
  if (!comLetras) return 51 * escala;
  doc.setFillColor(...rgb(corDasLetras));
  doc.path(caminhoDasLetras().map(({ op, c }) => ({ op, c: c.map((valor, i) => (i % 2 === 0 ? px(valor) : py(valor))) })));
  doc.fillEvenOdd();
  return 209 * escala;
}

// Texto que cabe em `largura`: diminui a letra até `minimo` e, se ainda
// não couber, corta com reticências.
function caber(doc, texto, largura, tamanho, minimo) {
  let t = tamanho;
  doc.setFontSize(t);
  while (doc.getTextWidth(texto) > largura && t > minimo) {
    t -= 0.5;
    doc.setFontSize(t);
  }
  let saida = texto;
  while (doc.getTextWidth(saida) > largura && saida.length > 4) saida = `${saida.slice(0, -2).trimEnd()}…`;
  return saida;
}

function linhaDivisoria(doc, y, { comAcento = false } = {}) {
  const largura = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...rgb(COR.linha));
  doc.setLineWidth(0.6);
  doc.line(MARGEM, y, largura - MARGEM, y);
  if (comAcento) {
    doc.setDrawColor(...rgb(COR.acento));
    doc.setLineWidth(2);
    doc.line(MARGEM, y, MARGEM + 46, y);
  }
}

// Cabeçalho da 1ª página: o tipo de relatório (em laranja), a empresa ou o
// grupo, os detalhes (CNPJ, período, detalhe) e a logo à direita.
function cabecalhoCompleto(doc, { titulo, empresa, detalhes = [], nota = "" }) {
  const largura = doc.internal.pageSize.getWidth();
  const logo = 19;
  const larguraDaLogo = (209 * logo) / 51;
  desenharLogo(doc, largura - MARGEM - larguraDaLogo, 26, logo);
  const espaco = largura - MARGEM * 2 - larguraDaLogo - 28;

  usar(doc, "semi", 7.5, COR.acento);
  doc.text(String(titulo || "").toUpperCase(), MARGEM, 36, { charSpace: 1.1 });

  usar(doc, "forte", 17, COR.tinta);
  doc.text(caber(doc, String(empresa || ""), espaco, 17, 11), MARGEM, 58);

  usar(doc, "regular", 8.5, COR.tinta3);
  const notaLargura = nota ? doc.getTextWidth(nota) + 24 : 0;
  doc.text(caber(doc, detalhes.filter(Boolean).join("   ·   "), largura - MARGEM * 2 - notaLargura, 8.5, 7), MARGEM, 74);
  if (nota) {
    usar(doc, "regular", 7.5, COR.tinta3);
    doc.text(nota, largura - MARGEM, 74, { align: "right" });
  }
  linhaDivisoria(doc, 86, { comAcento: true });
}

// Cabeçalho curto das páginas seguintes: empresa · relatório e o símbolo.
function cabecalhoCurto(doc, { titulo, empresa }) {
  const largura = doc.internal.pageSize.getWidth();
  desenharLogo(doc, largura - MARGEM - 12, 19, 12, { comLetras: false });
  usar(doc, "semi", 8, COR.tinta2);
  doc.text(caber(doc, [empresa, titulo].filter(Boolean).join("   ·   "), largura - MARGEM * 2 - 30, 8, 6.5), MARGEM, 29);
  linhaDivisoria(doc, 39);
}

function rodape(doc, pagina, total) {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  linhaDivisoria(doc, altura - 31);
  usar(doc, "regular", 7.5, COR.tinta3);
  doc.text(`Athos B.I.   ·   Gerado em ${carimbo()}`, MARGEM, altura - 18);
  usar(doc, "semi", 7.5, COR.tinta2);
  doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, altura - 18, { align: "right" });
}

// Cabeçalhos e rodapés de todas as páginas — no fim, quando já se sabe
// quantas páginas o arquivo tem.
export function acabamento(doc, info) {
  const total = doc.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    if (pagina === 1) cabecalhoCompleto(doc, info);
    else cabecalhoCurto(doc, info);
    rodape(doc, pagina, total);
  }
}

// ——— Tabela de relatório ———

const ehColunaDeTotal = (coluna) => coluna.key === "total" || /^(saldo )?total/i.test(String(coluna.label || ""));

// Larguras: cada coluna de valor do tamanho do maior valor dela (sem quebrar
// linha); a descrição fica com o resto. Diminui a letra até caber; mede uma
// vez a 10 pt e escala (a largura do texto é proporcional ao tamanho).
function medir(doc, colunas, textos) {
  const larguraA10 = colunas.map((coluna, j) => {
    let maior = 0;
    usar(doc, "bold", 10);
    textos.forEach((linha) => {
      maior = Math.max(maior, doc.getTextWidth(linha[j] || ""));
    });
    usar(doc, "semi", 10);
    return { valores: maior, titulo: doc.getTextWidth(String(colunas[j].label || "")) };
  });
  return (largura, tamanhos, minimoDescricao) => {
    for (const tamanho of tamanhos) {
      const folga = tamanho >= 7 ? 6 : 4.5;
      const larguras = larguraA10.map(({ valores, titulo }) => Math.max(54, Math.ceil((Math.max(valores, titulo) * tamanho) / 10 + folga * 2 + 2)));
      const soma = larguras.reduce((a, b) => a + b, 0);
      if (largura - soma >= minimoDescricao) return { tamanho, folga, larguras, descricao: largura - soma };
    }
    return null;
  };
}

// Retrato pra relatório estreito (até 4 colunas de valor que caibam com
// letra boa); paisagem pro resto.
export async function planejarTabela(colunas, textos) {
  const medida = await novoPdf({ paisagem: false });
  const caber = medir(medida, colunas, textos);
  const retrato = 595.28 - MARGEM * 2;
  const paisagem = 841.89 - MARGEM * 2;
  if (colunas.length <= 4) {
    const plano = caber(retrato, [8.4, 8, 7.6], 210);
    if (plano) return { paisagem: false, ...plano };
  }
  const plano = caber(paisagem, [8.4, 8, 7.6, 7.2, 6.8, 6.4, 6, 5.6, 5.2], 190);
  if (plano) return { paisagem: true, ...plano };
  // Coluna demais até pra letra miúda: divide por igual e deixa quebrar.
  const descricao = 150;
  const cada = (paisagem - descricao) / colunas.length;
  return { paisagem: true, tamanho: 5.2, folga: 3, larguras: colunas.map(() => cada), descricao };
}

const semValor = (linha, colunas) => colunas.every((coluna) => !String(linha.cells?.[coluna.key] ?? "").trim());

// A tabela de um demonstrativo (linhas {nome, nivel, isAnalytic, cells} e
// colunas {key, label} — as mesmas da tela). Nível 1 em destaque (faixa
// clara e o fio laranja à esquerda), sintéticas em negrito, analíticas em
// cinza e recuadas pelo nível; negativo em vermelho, zero em cinza claro.
export function tabelaDeRelatorio(doc, { colunas, linhas, textos, plano, inicio = TOPO_PRIMEIRA }) {
  const fonte = (peso) => fonteDe(doc, peso)[0];
  const { tamanho, folga, larguras, descricao } = plano;
  const vertical = tamanho >= 7.6 ? 3.6 : tamanho >= 6.4 ? 3 : 2.4;
  const sinteticas = linhas.filter((linha) => !linha.isAnalytic).map((linha) => Number(linha.nivel || 1));
  const topo = sinteticas.length ? Math.min(...sinteticas) : 1;
  // Em destaque: o nível de cima, as seções sem valor e o que a tela marca (`destaque`, ex.: subtotais da DFC).
  const destaque = linhas.map((linha) => Boolean(linha.destaque) || (!linha.isAnalytic && (Number(linha.nivel || 1) <= topo || semValor(linha, colunas))));
  const totais = colunas.map(ehColunaDeTotal);

  autoTable(doc, {
    theme: "plain",
    startY: inicio,
    margin: { top: TOPO_DEMAIS, bottom: BASE, left: MARGEM, right: MARGEM },
    head: [["Descrição", ...colunas.map((coluna) => coluna.label)]],
    body: linhas.map((linha, i) => [linha.nome || "", ...textos[i].map((texto) => (ehZero(texto) ? "–" : texto))]),
    styles: {
      font: fonte("regular"),
      fontStyle: "normal",
      fontSize: tamanho,
      textColor: rgb(COR.tinta),
      cellPadding: { top: vertical, bottom: vertical, left: folga, right: folga },
      lineWidth: 0,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      font: fonte("semi"),
      fillColor: rgb(COR.cabecalho),
      textColor: [255, 255, 255],
      halign: "right",
      cellPadding: { top: vertical + 2.6, bottom: vertical + 2.6, left: folga, right: folga },
    },
    columnStyles: {
      0: { cellWidth: descricao, halign: "left" },
      ...Object.fromEntries(larguras.map((largura, j) => [j + 1, { cellWidth: largura, halign: "right" }])),
    },
    didParseCell(data) {
      const { cell, column, row, section } = data;
      if (section === "head") {
        if (column.index === 0) cell.styles.halign = "left";
        if (column.index > 0 && totais[column.index - 1]) cell.styles.fillColor = rgb(COR.acento);
        return;
      }
      const linha = linhas[row.index];
      if (!linha) return;
      const nivel = Number(linha.nivel || 1);
      cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.5, left: 0 };
      cell.styles.lineColor = rgb(COR.linha);
      if (destaque[row.index]) {
        cell.styles.fillColor = rgb(COR.acentoSuave);
        cell.styles.font = fonte("bold");
      } else if (!linha.isAnalytic) {
        cell.styles.font = fonte("semi");
        if (nivel - topo >= 2) cell.styles.textColor = rgb(COR.tinta2);
      } else {
        cell.styles.textColor = rgb(COR.tinta2);
      }
      if (column.index === 0) {
        cell.styles.cellPadding = { top: vertical, bottom: vertical, right: folga, left: folga + Math.min(5, Math.max(0, nivel - topo)) * 8 };
        return;
      }
      const texto = textos[row.index][column.index - 1];
      if (ehZero(texto)) cell.styles.textColor = rgb(COR.tinta3);
      else if (ehNegativo(texto)) cell.styles.textColor = rgb(COR.negativo);
      if (totais[column.index - 1]) {
        if (!destaque[row.index]) cell.styles.fillColor = rgb(COR.coluna);
        if (!linha.isAnalytic) cell.styles.font = fonte("bold");
      }
    },
    didDrawCell(data) {
      if (data.section !== "body" || data.column.index !== 0 || !destaque[data.row.index]) return;
      doc.setFillColor(...rgb(COR.acento));
      doc.rect(data.cell.x, data.cell.y, 2.2, data.cell.height, "F");
    },
  });
}

// Os textos das células, já sem o "R$" (vai um "Valores em R$" no cabeçalho).
export function textosDasLinhas(linhas, colunas) {
  return linhas.map((linha) => colunas.map((coluna) => semMoeda(linha.cells?.[coluna.key] ?? "")));
}
