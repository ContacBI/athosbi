// Formato compacto das partes do razão (ver writeCompanyJournalNow em
// persistence.js). Cada lançamento era gravado como um objeto JSON com os
// 13 nomes de campo repetidos e textos que se repetem demais (numa parte de
// 5 mil lançamentos: 31 contas, 11 datas, 1 arquivo de origem) — ~490 bytes
// por lançamento, ~126MB pra abrir o grupo CUFF. No compacto:
//   { __compacto: 1, campos: ["data", "historico", …],
//     textos: { data: ["2026-01-02", …], … },   // dicionário das colunas de texto
//     linhas: [[0, 15, …, 1234.5, 0], …],        // um array por lançamento, na ordem de `campos`
//     faltam: { campo: [nº da linha, …] } }      // só se algum lançamento não tem o campo
// Coluna de texto repetitivo guarda a posição no dicionário (-1 = sem o
// campo); as outras guardam o valor como está. Decodificar devolve os
// mesmos lançamentos que o JSON de antes devolveria (campo undefined some,
// como no JSON).

export const FORMATO_COMPACTO = 1;

const ausente = (valor) => valor === undefined || typeof valor === "function";

export function codificarParte(lancamentos) {
  const lista = Array.isArray(lancamentos) ? lancamentos : [];
  const campos = [];
  const visto = new Set();
  lista.forEach((lancamento) => {
    Object.keys(lancamento || {}).forEach((campo) => {
      if (!visto.has(campo) && !ausente(lancamento[campo])) {
        visto.add(campo);
        campos.push(campo);
      }
    });
  });
  // Dicionário só compensa quando o texto repete: coluna toda de texto e
  // com no máximo 80% de valores diferentes.
  const viraDicionario = campos.map((campo) => {
    let presentes = 0;
    const diferentes = new Set();
    for (const lancamento of lista) {
      const valor = lancamento?.[campo];
      if (ausente(valor)) continue;
      if (typeof valor !== "string") return false;
      presentes += 1;
      diferentes.add(valor);
    }
    return presentes > 0 && diferentes.size <= presentes * 0.8;
  });
  const textos = {};
  const posicoes = campos.map(() => new Map());
  campos.forEach((campo, i) => {
    if (viraDicionario[i]) textos[campo] = [];
  });
  const faltam = {};
  const linhas = lista.map((lancamento, n) =>
    campos.map((campo, i) => {
      const valor = lancamento?.[campo];
      if (viraDicionario[i]) {
        if (ausente(valor)) return -1;
        let posicao = posicoes[i].get(valor);
        if (posicao === undefined) {
          posicao = textos[campo].length;
          textos[campo].push(valor);
          posicoes[i].set(valor, posicao);
        }
        return posicao;
      }
      if (ausente(valor)) {
        (faltam[campo] ||= []).push(n);
        return null;
      }
      return valor;
    })
  );
  return { __compacto: FORMATO_COMPACTO, campos, textos, linhas, ...(Object.keys(faltam).length ? { faltam } : {}) };
}

export const parteCompacta = (valor) => Boolean(valor && typeof valor === "object" && !Array.isArray(valor) && valor.__compacto === FORMATO_COMPACTO);

// Array de lançamentos (formato antigo, devolvido como veio) ou null quando
// o valor não é parte de razão nenhuma (quem chama trata como parte faltando).
export function decodificarParte(valor) {
  if (Array.isArray(valor)) return valor;
  if (!parteCompacta(valor) || !Array.isArray(valor.campos) || !Array.isArray(valor.linhas)) return null;
  const { campos, linhas } = valor;
  const dicionarios = campos.map((campo) => (Array.isArray(valor.textos?.[campo]) ? valor.textos[campo] : null));
  const faltam = campos.map((campo) => (Array.isArray(valor.faltam?.[campo]) ? new Set(valor.faltam[campo]) : null));
  const saida = new Array(linhas.length);
  for (let n = 0; n < linhas.length; n += 1) {
    const linha = linhas[n];
    if (!Array.isArray(linha)) return null;
    const lancamento = {};
    for (let i = 0; i < campos.length; i += 1) {
      const dicionario = dicionarios[i];
      const valorCampo = linha[i];
      if (dicionario) {
        if (Number.isInteger(valorCampo) && valorCampo >= 0) {
          if (valorCampo >= dicionario.length) return null;
          lancamento[campos[i]] = dicionario[valorCampo];
        }
      } else if (!faltam[i]?.has(n)) {
        lancamento[campos[i]] = valorCampo === undefined ? null : valorCampo;
      }
    }
    saida[n] = lancamento;
  }
  return saida;
}
