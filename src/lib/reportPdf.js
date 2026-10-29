import { partesDaMeta, temMoeda, tituloDoRelatorio } from "./exportVisual.js";
import { acabamento, novoPdf, planejarTabela, tabelaDeRelatorio, textosDasLinhas } from "./pdfVisual.js";

// PDF de um demonstrativo (DRE, Balanço, DFC, os cartões de tabela e o
// resumo de uma aba do Painel) no padrão dos downloads (pdfVisual.js):
// cabeçalho com a logo, tabela medida pra nenhum valor quebrar e rodapé com
// a data e a página. Só a descrição e os valores — sem a coluna de código.
//
// `columns` é a lista {key,label} da tela; `rows` traz {nome, nivel,
// isAnalytic, cells} com os mesmos textos já formatados que a tabela da tela
// mostra — o PDF nunca sai diferente do que a pessoa estava vendo.
async function montarPdf({ companyName, reportName, metaLine, columns, rows }) {
  const textos = textosDasLinhas(rows, columns);
  const plano = await planejarTabela(columns, textos);
  const doc = await novoPdf({ paisagem: plano.paisagem });
  tabelaDeRelatorio(doc, { colunas: columns, linhas: rows, textos, plano });
  acabamento(doc, {
    titulo: tituloDoRelatorio(reportName),
    empresa: companyName,
    detalhes: partesDaMeta(metaLine, reportName),
    nota: temMoeda(rows, columns) ? "Valores em R$" : "",
  });
  return doc;
}

export async function exportDemonstrativoPdf(meta) {
  const doc = await montarPdf(meta);
  doc.save(`${meta.fileLabel}.pdf`);
}

// O mesmo PDF como Blob, sem baixar — pra empacotar vários (o consolidado e
// cada empresa do grupo) num .zip só.
export async function buildDemonstrativoPdfBlob(meta) {
  const doc = await montarPdf(meta);
  return doc.output("blob");
}
