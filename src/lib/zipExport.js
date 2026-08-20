import JSZip from "jszip";

// Empacota vários arquivos já prontos (Blob) num .zip só e dispara o
// download — usado pelo export Consolidado+Individual em PDF: um arquivo
// por empresa (+ o consolidado) zipados juntos em vez de vários downloads
// separados.
export async function downloadZip(files, zipName) {
  const zip = new JSZip();
  files.forEach(({ name, blob }) => zip.file(name, blob));
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
