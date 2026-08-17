import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// Same brand as reportPdf.js — orange banner, but only on the first page:
// repeating it on every slice of a tall dashboard would eat too much space
// and land in the middle of cards.
const BANNER = [198, 74, 18];
const MARGIN = 24;
const BANNER_HEIGHT = 58;

function drawBanner(doc, { companyName, metaLine }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BANNER);
  doc.rect(0, 0, pageWidth, BANNER_HEIGHT, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.text(String(companyName || "").toUpperCase(), MARGIN, 24);
  doc.setFontSize(9.5);
  doc.setFont(undefined, "normal");
  doc.setTextColor(250, 224, 208);
  doc.text(metaLine || "", MARGIN, 40);
}

// Captures a live DOM node — the dashboard grid exactly as it's rendered,
// cards and charts included — and drops it into a branded PDF, slicing the
// screenshot across as many pages as it needs. Used for "Relatório atual"
// on a Resumo-style tab, where the whole point is reproducing the actual
// on-screen layout rather than flattening it into a table.
// A short, reliable settle delay before capturing. requestAnimationFrame
// would be the "correct" way to wait for a paint, but rAF callbacks are
// suspended indefinitely in backgrounded/non-visible tabs — a user who
// clicks download and immediately switches away would hang forever.
// setTimeout keeps firing (perhaps throttled, but never stopped) either way.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 60));
}

export async function exportDomSnapshotPdf({ element, companyName, metaLine, fileLabel }) {
  if (!element) return;
  // Give Recharts' ResizeObserver-driven charts a moment to settle their
  // measured size before the screenshot — capturing immediately can catch
  // them still at 0×0.
  await settle();
  // foreignObjectRendering lets the browser's own SVG engine draw
  // Recharts' bars/pies (clipPath-heavy) straight into the canvas — without
  // it, html2canvas's own SVG re-implementation drops several of them.
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true, foreignObjectRendering: true });

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - MARGIN * 2;
  const ptPerPx = usableWidth / canvas.width;
  const totalHeightPt = canvas.height * ptPerPx;

  let renderedPt = 0;
  let page = 0;
  while (renderedPt < totalHeightPt) {
    const isFirst = page === 0;
    if (page > 0) doc.addPage();
    const availableHeightPt = (isFirst ? pageHeight - BANNER_HEIGHT : pageHeight) - MARGIN * 2;
    const sliceHeightPt = Math.min(availableHeightPt, totalHeightPt - renderedPt);
    const sliceHeightPx = sliceHeightPt / ptPerPx;
    const sourceYPx = renderedPt / ptPerPx;

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil(sliceHeightPx));
    const sliceCtx = sliceCanvas.getContext("2d");
    sliceCtx.fillStyle = "#ffffff";
    sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceCtx.drawImage(canvas, 0, sourceYPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    const top = (isFirst ? BANNER_HEIGHT : 0) + MARGIN;
    doc.addImage(sliceCanvas.toDataURL("image/png"), "PNG", MARGIN, top, usableWidth, sliceHeightPt);
    if (isFirst) drawBanner(doc, { companyName, metaLine });

    renderedPt += sliceHeightPt;
    page += 1;
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...(p === 1 ? [255, 255, 255] : [150, 150, 150]));
    doc.text(`Página ${p}/${pageCount}`, doc.internal.pageSize.getWidth() - MARGIN, 20, { align: "right" });
  }

  doc.save(`${fileLabel}.pdf`);
}
