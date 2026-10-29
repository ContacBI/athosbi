// A cara dos downloads (PDF e Excel): todo arquivo que sai do portal com o
// mesmo padrão — as cores da marca, o cabeçalho com a logo da Athos, o
// rodapé com a data e a página, os valores sem o "R$" repetido em cada
// célula (vai um "Valores em R$" no cabeçalho) e só o negativo em
// vermelho. Aqui fica só o que é puro (cores, leitura das células, textos
// do cabeçalho) — o desenho em si está em pdfVisual.js e excelVisual.js.

export const COR = {
  tinta: "#0a1a2d", // títulos e valores
  tinta2: "#3d4b5f", // contas analíticas
  tinta3: "#8792a2", // textos de apoio (período, rodapé, zero)
  acento: "#e75220", // o laranja da logo
  acentoSuave: "#fdf0ea", // linhas de nível 1
  faixa: "#f3f5f9", // linhas de nível 2
  coluna: "#f6f7fa", // coluna de total
  cabecalho: "#0f2033", // cabeçalho da tabela
  linha: "#e3e7ee", // fios entre as linhas
  negativo: "#c0392b",
};

export function rgb(hex) {
  const valor = String(hex).replace("#", "");
  return [0, 2, 4].map((i) => parseInt(valor.slice(i, i + 2), 16));
}

// Cor no formato do Excel (ARGB, sem transparência).
export function argb(hex) {
  return `FF${String(hex).replace("#", "").toUpperCase()}`;
}

const paraNumero = (texto) => Number(String(texto).replace(/\./g, "").replace(",", "."));

// O que uma célula já formatada pra tela ("R$ 1.234,56", "-R$ 10,00",
// "12,5%", "-", "OK") vale de verdade — pro Excel guardar número (que soma
// e filtra) em vez de texto. O que não for valor fica como texto.
export function lerValor(texto) {
  const t = String(texto ?? "")
    .replace(/[  ]/g, " ")
    .trim();
  if (!t || t === "-" || t === "—" || t === "–") return { tipo: "vazio", texto: t };
  let m = t.match(/^(-)?\s*R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)$/);
  if (m) return { tipo: "moeda", valor: (m[1] ? -1 : 1) * paraNumero(m[2]) };
  m = t.match(/^(-)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*%$/);
  if (m) return { tipo: "pct", valor: ((m[1] ? -1 : 1) * paraNumero(m[2])) / 100 };
  m = t.match(/^(-)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+|\d+)$/);
  if (m) return { tipo: "numero", valor: (m[1] ? -1 : 1) * paraNumero(m[2]), decimais: m[2].includes(",") };
  return { tipo: "texto", texto: t };
}

// "R$ 1.234,56" → "1.234,56" (o "Valores em R$" vai no cabeçalho).
export function semMoeda(texto) {
  return String(texto ?? "")
    .replace(/R\$[\s  ]?/g, "")
    .trim();
}

export function ehNegativo(texto) {
  return /^-\s*(R\$[\s  ]?)?\d/.test(String(texto ?? "").trim());
}

export function ehZero(texto) {
  const t = String(texto ?? "").trim();
  return t === "-" || t === "—" || t === "–";
}

const TITULOS = {
  DRE: "Demonstração do Resultado",
  "DRE Ebitda": "DRE com EBITDA",
  "DFC Direta": "Fluxo de Caixa — método direto",
  "DFC Indireta": "Fluxo de Caixa — método indireto",
};

// O título por extenso de um relatório ("DRE" → "Demonstração do Resultado").
export function tituloDoRelatorio(reportName) {
  return TITULOS[reportName] || reportName || "Relatório";
}

const normal = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// A linha de detalhes do cabeçalho: as partes da `metaLine` ("CNPJ … | DRE |
// período | Analítico") sem repetir o nome do relatório, que já é o título.
export function partesDaMeta(metaLine, reportName) {
  const nome = normal(reportName);
  return String(metaLine || "")
    .split("|")
    .map((parte) => parte.trim())
    .filter((parte) => parte && normal(parte) !== nome);
}

// "29/10/2026 às 08:15" — quando o arquivo foi gerado (vai no rodapé).
export function carimbo(data = new Date()) {
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} às ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

export function temMoeda(linhas, colunas) {
  return linhas.some((linha) => colunas.some((coluna) => /R\$/.test(String(linha.cells?.[coluna.key] ?? ""))));
}

// Nomes de aba do Excel não aceitam \ / ? * [ ] : e têm no máximo 31
// caracteres — corta, troca esses caracteres e desempata com um número.
export function nomeDaAba(nome, usados) {
  const base =
    String(nome || "Aba")
      .replace(/[\\/?*[\]:]/g, " ")
      .trim()
      .slice(0, 31) || "Aba";
  let candidato = base;
  let sufixo = 2;
  while (usados.has(candidato)) {
    candidato = `${base.slice(0, 28)} ${sufixo}`;
    sufixo += 1;
  }
  usados.add(candidato);
  return candidato;
}

export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
