// Gera src/lib/reforma/anexosLc214.js — os NCM/NBS dos anexos da LC 214/2025
// com redução de 60% ou alíquota zero do IBS/CBS, pra sugerir a coluna "Na
// reforma" das simulações.
//
// Fonte: pacote @sinete/ibs-cbs-dados (Apache-2.0, FAZER.AI LTDA e
// contribuidores do sinete), que extrai os dados da Calculadora de Tributos
// da Reforma (RFB, módulo offline) e do IT 2025.002 (tabela cClassTrib),
// com hash de cada tabela no manifest.json.
//
// Atualizar:
//   npm pack @sinete/ibs-cbs-dados@<versão>   (numa pasta vazia)
//   tar -xzf sinete-ibs-cbs-dados-<versão>.tgz
//   node scripts/gerar-anexos-lc214.mjs <pasta>/package
//   node scripts/test-reforma.mjs
import fs from "node:fs";
import path from "node:path";

const pasta = process.argv[2];
if (!pasta) {
  console.error("Uso: node scripts/gerar-anexos-lc214.mjs <pasta do pacote @sinete/ibs-cbs-dados>");
  process.exit(1);
}
const ler = (nome) => JSON.parse(fs.readFileSync(path.join(pasta, "src/data", `${nome}.json`), "utf8"));
const pacote = JSON.parse(fs.readFileSync(path.join(pasta, "package.json"), "utf8"));
const manifest = ler("manifest");
const vigente = (registro) => !registro.vigencia?.fim;

// Tratamentos que entram na simulação: reduções de 60% e alíquota zero dos
// anexos. `condicao` = só vale pra certo comprador/caso (vira alternativa,
// não sugestão principal). 515001 é o mesmo Anexo IX com diferimento.
const TRATAMENTOS = {
  200003: { titulo: "Cesta Básica Nacional de Alimentos" },
  200004: { titulo: "Dispositivos médicos" },
  200005: { titulo: "Dispositivos médicos", condicao: "só na venda a órgão público (administração direta, autarquia, fundação) ou a entidade de saúde imune com CEBAS (SUS)" },
  200007: { titulo: "Dispositivos de acessibilidade para pessoas com deficiência" },
  200008: { titulo: "Dispositivos de acessibilidade para pessoas com deficiência", condicao: "só na venda a órgão público ou a entidade de saúde imune com CEBAS (SUS)" },
  200011: { titulo: "Nutrição enteral e parenteral", condicao: "só na venda a órgão público ou a entidade de saúde imune com CEBAS (SUS)" },
  200014: { titulo: "Produtos hortícolas, frutas e ovos" },
  200028: { titulo: "Serviços de educação" },
  200029: { titulo: "Serviços de saúde humana" },
  200030: { titulo: "Dispositivos médicos" },
  200031: { titulo: "Dispositivos de acessibilidade para pessoas com deficiência" },
  200033: { titulo: "Nutrição enteral e parenteral" },
  200034: { titulo: "Alimentos destinados ao consumo humano" },
  200035: { titulo: "Produtos de higiene pessoal e limpeza" },
  200038: { titulo: "Insumos agropecuários e aquícolas" },
  200039: { titulo: "Produções artísticas, culturais, de eventos, jornalísticas e audiovisuais", condicao: "só nas produções nacionais desses tipos" },
  200043: { titulo: "Soberania e segurança nacional", condicao: "só na venda à administração pública" },
  200044: { titulo: "Segurança da informação e cibernética", condicao: "só por sociedade com sócio brasileiro com pelo menos 20% do capital" },
};

const ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII"];
const classTrib = new Map(ler("classTrib").filter((c) => vigente(c) && c.familia === "CBS_IBS").map((c) => [c.codigo, c]));
const tratamentos = {};
for (const [codigo, extra] of Object.entries(TRATAMENTOS)) {
  const c = classTrib.get(codigo);
  if (!c) throw new Error(`cClassTrib ${codigo} não existe (ou não está vigente) nesta versão dos dados — revise TRATAMENTOS.`);
  const reducoes = [...new Set(c.reducoes.filter(vigente).map((r) => Number(r.pRed)))];
  if (reducoes.length !== 1 || ![60, 100].includes(reducoes[0])) throw new Error(`cClassTrib ${codigo}: redução inesperada ${reducoes}`);
  tratamentos[codigo] = { reducao: reducoes[0], anexo: ROMANOS[Number(c.anexo)] || String(c.anexo), artigo: c.legal?.lc214 || "", ...extra };
}

const linhas = (nome) =>
  ler(nome)
    .filter((a) => vigente(a) && a.familia === "CBS_IBS" && tratamentos[a.cClassTrib])
    .map((a) => [a.prefixo, a.cClassTrib, a.itemDoAnexo || "", [...new Set(a.excecoes.filter(vigente).map((e) => e.prefixo))]]);
const unicas = (lista) => [...new Map(lista.map((l) => [JSON.stringify(l), l])).values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
const ncm = unicas(linhas("aplicabilidadeNcm"));
const nbs = unicas(linhas("aplicabilidadeNbs"));

const usados = new Set([...ncm, ...nbs].map((l) => l[2]).filter(Boolean));
const itens = Object.fromEntries(
  ler("anexos")
    .filter(vigente)
    .map((a) => [`${a.anexo}/${a.item}`, a.texto.replace(/\s+/g, " ").trim()])
    .filter(([chave]) => usados.has(chave))
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
);

const fonte = {
  pacote: `${pacote.name}@${pacote.version}`,
  dados: manifest.versaoDosDados,
  conhecidoEm: manifest.conhecidoEm,
  sha256DoDataset: manifest.sha256DoDataset,
  origem: manifest.fontes.map((f) => `${f.titulo} (${f.versao})`),
  licenca: "Apache-2.0 — FAZER.AI LTDA e os contribuidores do sinete",
};
const saida = `// GERADO por scripts/gerar-anexos-lc214.mjs — não edite à mão.
// NCM/NBS dos anexos da LC 214/2025 com redução de 60% ou alíquota zero do
// IBS/CBS. Fonte: ${fonte.pacote} (${fonte.licenca}), dados ${fonte.dados}
// conhecidos em ${fonte.conhecidoEm}, extraídos da Calculadora da Reforma (RFB)
// e do IT 2025.002. Licença: https://www.apache.org/licenses/LICENSE-2.0
// Linhas: [prefixo, cClassTrib, item do anexo, exceções].
export const FONTE = ${JSON.stringify(fonte, null, 2)};

export const TRATAMENTOS = ${JSON.stringify(tratamentos, null, 2)};

export const ITENS = ${JSON.stringify(itens, null, 0).replace(/","/g, '",\n  "').replace(/^\{/, "{\n  ").replace(/\}$/, "\n}")};

export const NCM = [
${ncm.map((l) => `  ${JSON.stringify(l)},`).join("\n")}
];

export const NBS = [
${nbs.map((l) => `  ${JSON.stringify(l)},`).join("\n")}
];
`;
fs.writeFileSync(new URL("../src/lib/reforma/anexosLc214.js", import.meta.url), saida);
console.log(`anexosLc214.js: ${Object.keys(tratamentos).length} tratamentos, ${ncm.length} linhas NCM, ${nbs.length} linhas NBS, ${Object.keys(itens).length} itens de anexo (${fonte.pacote})`);
