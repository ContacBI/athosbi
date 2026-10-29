import html2canvas from "html2canvas";
import { partesDaMeta, tituloDoRelatorio } from "./exportVisual.js";
import { BASE, MARGEM, TOPO_DEMAIS, TOPO_PRIMEIRA, acabamento, novoPdf } from "./pdfVisual.js";

// A short, reliable settle delay before capturing. requestAnimationFrame
// would be the "correct" way to wait for a paint, but rAF callbacks are
// suspended indefinitely in backgrounded/non-visible tabs — a user who
// clicks download and immediately switches away would hang forever.
// setTimeout keeps firing (perhaps throttled, but never stopped) either way.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 60));
}

// Onde dá pra cortar a página sem partir um cartão no meio: as faixas
// verticais (em px da captura) ocupadas pelos cartões do painel.
function faixasDosCartoes(element, escala) {
  const topo = element.getBoundingClientRect().top;
  // Os cartões são os filhos da grade — que pode vir embrulhada (o printRef do PainelTab envolve o PrintableWidgetGrid).
  let grade = element;
  while (grade.children.length === 1) grade = grade.children[0];
  return [...grade.children].map((filho) => {
    const caixa = filho.getBoundingClientRect();
    return [(caixa.top - topo) * escala, (caixa.bottom - topo) * escala];
  });
}

// O ponto de corte mais baixo até `limite` que não cai dentro de um cartão
// (se o cartão sozinho for maior que a página, corta nele mesmo).
function pontoDeCorte(inicio, limite, faixas) {
  let corte = limite;
  for (let volta = 0; volta < faixas.length; volta += 1) {
    const cortado = faixas.find(([de, ate]) => de < corte - 1 && ate > corte + 1);
    if (!cortado) return corte;
    if (cortado[0] <= inicio + 1) return limite;
    corte = cortado[0];
  }
  return corte;
}

// O painel do jeito que está na tela (cartões e gráficos — o
// PrintableWidgetGrid, uma cópia fora da tela) num PDF no padrão dos
// downloads (pdfVisual.js): cabeçalho com a logo, as páginas cortadas entre
// os cartões (não no meio de um) e o rodapé com a data e a página. A captura
// vai como JPEG — em PNG um painel passava de 15 MB.
// Uma tabela com mais colunas que o cartão (os meses lado a lado) sairia
// cortada, com a barra de rolagem na foto: alarga a cópia de impressão até
// caber tudo (a página encolhe a imagem pra largura da folha) e devolve como
// desfazer.
const rolaDeLado = (el) => /auto|scroll/.test(getComputedStyle(el).overflowX);

async function alargarAteCaber(element) {
  let grade = element;
  while (grade.children.length === 1) grade = grade.children[0];
  const antes = [element.style.width, grade.style.width];
  // Algumas voltas: as colunas de valor crescem junto quando o cartão alarga.
  for (let volta = 0; volta < 4; volta += 1) {
    const sobra = [...element.querySelectorAll("*")].filter(rolaDeLado).reduce((maior, el) => Math.max(maior, el.scrollWidth - el.clientWidth), 0);
    if (sobra <= 0) break;
    const largura = grade.getBoundingClientRect().width + sobra + 48;
    element.style.width = `${largura}px`;
    grade.style.width = `${largura}px`;
    // Os gráficos (ResizeObserver) precisam de um tempo pra se redesenhar na largura nova.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return () => {
    [element.style.width, grade.style.width] = antes;
  };
}

// Na cópia que vira foto, nada de barra de rolagem.
function semBarras(documento, copia) {
  [copia, ...copia.querySelectorAll("*")].forEach((el) => {
    const estilo = documento.defaultView.getComputedStyle(el);
    if (/auto|scroll/.test(estilo.overflowX) || /auto|scroll/.test(estilo.overflowY)) el.style.overflow = "hidden";
  });
}

export async function exportDomSnapshotPdf({ element, companyName, reportName, metaLine, fileLabel }) {
  if (!element) return;
  // Give Recharts' ResizeObserver-driven charts a moment to settle their
  // measured size before the screenshot — capturing immediately can catch
  // them still at 0×0.
  await settle();
  const desfazer = await alargarAteCaber(element);
  const escala = 2;
  let canvas;
  let faixas;
  try {
    faixas = faixasDosCartoes(element, escala);
    // foreignObjectRendering lets the browser's own SVG engine draw
    // Recharts' bars/pies (clipPath-heavy) straight into the canvas — without
    // it, html2canvas's own SVG re-implementation drops several of them.
    canvas = await html2canvas(element, { scale: escala, backgroundColor: "#ffffff", useCORS: true, foreignObjectRendering: true, onclone: semBarras });
  } finally {
    desfazer();
  }

  const doc = await novoPdf({ paisagem: true });
  const larguraDaPagina = doc.internal.pageSize.getWidth();
  const alturaDaPagina = doc.internal.pageSize.getHeight();
  const larguraUtil = larguraDaPagina - MARGEM * 2;
  const ptPorPx = larguraUtil / canvas.width;

  let feito = 0;
  let pagina = 0;
  while (feito < canvas.height - 1) {
    if (pagina > 0) doc.addPage();
    const topo = pagina === 0 ? TOPO_PRIMEIRA : TOPO_DEMAIS;
    const cabe = (alturaDaPagina - topo - BASE) / ptPorPx;
    const ate = feito + cabe >= canvas.height ? canvas.height : pontoDeCorte(feito, feito + cabe, faixas);
    const alturaPx = Math.max(1, Math.ceil(ate - feito));

    const fatia = document.createElement("canvas");
    fatia.width = canvas.width;
    fatia.height = alturaPx;
    const ctx = fatia.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, fatia.width, fatia.height);
    ctx.drawImage(canvas, 0, feito, canvas.width, alturaPx, 0, 0, canvas.width, alturaPx);
    doc.addImage(fatia.toDataURL("image/jpeg", 0.9), "JPEG", MARGEM, topo, larguraUtil, alturaPx * ptPorPx);

    feito += alturaPx;
    pagina += 1;
  }

  acabamento(doc, { titulo: tituloDoRelatorio(reportName), empresa: companyName, detalhes: partesDaMeta(metaLine, reportName) });
  doc.save(`${fileLabel}.pdf`);
}
