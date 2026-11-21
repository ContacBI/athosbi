// Lógica da "Buscar lançamento" (components/BuscaLancamentos.jsx), sem tela: normaliza o texto, entende o valor digitado (exato ou faixa) e filtra o razão.

/** Sem acento, minúsculo e com espaços simples — pra "ALUGUEL" achar "Aluguel" e "conta" achar "cônta". */
export function normalizarBusca(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// "1.234,56" · "1234,56" · "1234.56" · "R$ 1.234" → número; NaN se não der pra entender.
function numero(texto) {
  const limpo = String(texto).replace(/r\$/gi, "").replace(/\s+/g, "");
  if (!limpo || !/^[\d.,]+$/.test(limpo)) return NaN;
  if (/,\d{1,2}$/.test(limpo)) return Number(limpo.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ""));
  return Number(limpo.replace(/,/g, ""));
}

/**
 * Valor digitado → { min, max }: um número só vale como exato (com folga de meio centavo) e "1000 a 2000", "1000-2000" ou "1000..2000" valem como faixa.
 * Devolve null quando está em branco e `invalido: true` quando não deu pra entender.
 */
export function entenderValor(texto) {
  const bruto = String(texto ?? "").trim();
  if (!bruto) return null;
  const faixa = bruto.match(/^(.+?)(?:\s+a\s+|\s+at[ée]\s+|\s*\.\.\s*|\s*-\s*)(.+)$/i);
  if (faixa) {
    const a = numero(faixa[1]);
    const b = numero(faixa[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return { invalido: true };
    return { min: Math.min(a, b) - 0.005, max: Math.max(a, b) + 0.005 };
  }
  const exato = numero(bruto);
  if (Number.isNaN(exato)) return { invalido: true };
  return { min: exato - 0.005, max: exato + 0.005 };
}

/**
 * `indice`: [{ entry, h, c }] (h = histórico normalizado; c = conta normalizada). `filtros`: { historico, valor, conta, de, ate, lado }.
 * Sem nenhum filtro preenchido devolve lista vazia (não despeja o razão inteiro). Ordena por data.
 */
export function buscarLancamentos(indice, { historico = "", valor = "", conta = "", de = "", ate = "", lado = "todos" } = {}) {
  const palavrasHistorico = normalizarBusca(historico).split(" ").filter(Boolean);
  const palavrasConta = normalizarBusca(conta).split(" ").filter(Boolean);
  const faixa = entenderValor(valor);
  const valorInvalido = Boolean(faixa?.invalido);
  const filtrando = palavrasHistorico.length || palavrasConta.length || (faixa && !faixa.invalido) || de || ate || lado !== "todos";
  if (!filtrando) return { resultado: { lista: [], debito: 0, credito: 0 }, valorInvalido };

  const lista = [];
  let debito = 0;
  let credito = 0;
  for (const item of indice) {
    const { entry } = item;
    const d = Number(entry.debito) || 0;
    const c = Number(entry.credito) || 0;
    if (lado === "debito" && !d) continue;
    if (lado === "credito" && !c) continue;
    const dia = String(entry.data || "").slice(0, 10);
    if (de && dia < de) continue;
    if (ate && dia > ate) continue;
    if (faixa && !faixa.invalido) {
      const bateDebito = d && lado !== "credito" && d >= faixa.min && d <= faixa.max;
      const bateCredito = c && lado !== "debito" && c >= faixa.min && c <= faixa.max;
      if (!bateDebito && !bateCredito) continue;
    }
    if (palavrasHistorico.length && !palavrasHistorico.every((palavra) => item.h.includes(palavra))) continue;
    if (palavrasConta.length && !palavrasConta.every((palavra) => item.c.includes(palavra))) continue;
    lista.push(entry);
    debito += d;
    credito += c;
  }
  lista.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return { resultado: { lista, debito, credito }, valorInvalido };
}
