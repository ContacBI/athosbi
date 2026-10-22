import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// PDF das apresentações: um "print" de cada slide (1280×720, em escala 2 —
// fica nítido até em tela grande e no projetor) numa página 16:9.
//
// Mesmo jeito de capturar do PDF do painel (domSnapshotPdf.js): o slide é
// desenhado fora da tela num invólucro fixo 0×0 em (0,0) e o
// foreignObjectRendering deixa o próprio navegador desenhar os gráficos.
// scrollX/scrollY = 0 porque o slide está SEMPRE no canto da janela (fixo)
// — sem isso, com a página rolada, o html2canvas deslocava a captura pelo
// tanto que estava rolado e o slide saía em branco.
const PAGE_W = 960;
const PAGE_H = 540;

function settle(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function imagesReady(node) {
  const images = [...node.querySelectorAll("img")];
  await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
}

// O modo foreignObject do html2canvas desenha o conteúdo deslocado
// scale×scale pixels pra direita/baixo (o <foreignObject> nasce em x=scale
// e ainda é ampliado pelo scale) — sobrava uma faixa vazia em cima/à
// esquerda e o slide perdia o mesmo tanto embaixo/à direita. Captura um
// pouco maior e recorta exatamente o slide.
// fontCss: as fontes da apresentação embutidas (ver embeddedFontCss em
// slideFonts.js) — vão dentro do slide capturado, senão o print sai com a
// fonte padrão do navegador.
// prepare(clone): mexe no slide clonado antes do print (o PowerPoint usa
// para esconder os textos — ver slidesPptx.js).
export async function captureSlide(node, scale = 2, fontCss = "", prepare = null) {
  await imagesReady(node);
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const shift = scale * scale;
  const raw = await html2canvas(node, {
    scale,
    width: width + scale,
    height: height + scale,
    backgroundColor: null,
    useCORS: true,
    foreignObjectRendering: true,
    scrollX: 0,
    scrollY: 0,
    logging: false,
    // Só o slide (e quem está acima dele) entra no clone — o resto da tela
    // (editor, miniaturas…) não precisa ser copiado a cada print.
    ignoreElements: (element) => element.closest?.("body") && element !== document.body && !element.contains(node) && !node.contains(element),
    onclone: (doc, element) => {
      if (fontCss) {
        const style = doc.createElement("style");
        style.textContent = fontCss;
        element.prepend(style);
      }
      prepare?.(element);
    },
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.getContext("2d").drawImage(raw, -shift, -shift);
  return canvas;
}

export async function exportSlidesPdf({ nodes, fileLabel, title, fontCss, onProgress }) {
  // Gráficos do recharts medem o próprio tamanho com ResizeObserver: um
  // instante pra eles se acomodarem (animação já vem desligada no PDF).
  await settle(450);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [PAGE_W, PAGE_H] });
  doc.setProperties({ title: title || fileLabel, creator: "AthosBI" });
  for (let i = 0; i < nodes.length; i += 1) {
    onProgress?.(i + 1, nodes.length);
    const canvas = await captureSlide(nodes[i], 2, fontCss);
    if (i > 0) doc.addPage([PAGE_W, PAGE_H], "landscape");
    doc.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
  }
  doc.save(`${fileLabel}.pdf`);
}

export async function exportSlidePng({ node, fileLabel, fontCss }) {
  await settle(450);
  const canvas = await captureSlide(node, 2, fontCss);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${fileLabel}.png`;
  link.click();
}
