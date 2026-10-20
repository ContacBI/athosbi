// Fontes das apresentações, embutidas no próprio app (pacotes @fontsource,
// licença OFL) — não dependem de internet nem de estarem instaladas no
// computador. Cada arquivo só é baixado pelo navegador quando algum texto
// usa aquela fonte. Importado só pela tela de Apresentações.
import "@fontsource-variable/sora/wght.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/montserrat/wght.css";
import "@fontsource-variable/outfit/wght.css";
import "@fontsource-variable/space-grotesk/wght.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/lora/wght.css";
import "@fontsource-variable/lora/wght-italic.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/bebas-neue/400.css";

// O PDF é um "print" desenhado pelo navegador dentro de uma imagem SVG
// (foreignObject) — e imagem não enxerga as fontes da página. Então as
// fontes usadas na apresentação vão junto, dentro do próprio slide
// capturado, como @font-face com o arquivo embutido (data URL). Só o
// pedaço "latin" de cada fonte (é o que o português usa), uma vez por
// sessão.
const dataUrls = new Map();

function toDataUrl(url) {
  if (!dataUrls.has(url)) {
    dataUrls.set(
      url,
      fetch(url)
        .then((response) => response.blob())
        .then(
          (blob) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
        )
    );
  }
  return dataUrls.get(url);
}

const LATIN = /U\+0+-0*FF(?![0-9A-F])/i;

export async function embeddedFontCss(families) {
  const wanted = new Set(families.map((family) => family.toLowerCase()));
  if (!wanted.size) return "";
  const jobs = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim().toLowerCase();
      if (!wanted.has(family)) continue;
      const range = rule.style.getPropertyValue("unicode-range");
      if (range && !LATIN.test(range.replace(/\s/g, ""))) continue;
      const url = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/)?.[1];
      if (!url) continue;
      const absolute = new URL(url, sheet.href || window.location.href).href;
      jobs.push(toDataUrl(absolute).then((data) => rule.cssText.replace(/src:[^;]+;/, `src: url("${data}") format("woff2");`)));
    }
  }
  const css = await Promise.all(jobs.map((job) => job.catch(() => "")));
  // Garante que a página também já carregou as fontes antes do print.
  await Promise.all(families.map((family) => document.fonts.load(`400 24px "${family}"`).catch(() => undefined)));
  return css.filter(Boolean).join("\n");
}
