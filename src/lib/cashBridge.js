// "Ponte do lucro ao caixa": por que o lucro do período virou (ou não
// virou) caixa. Montada pelo próprio Balanço (saldo no início x no fim do
// período), então fecha por construção com a variação do caixa:
//
//   Δ caixa = lucro + depreciação + (− Δ ativos) + Δ passivos + (Δ PL − lucro)
//
// Cada grupo do Balanço cai numa etapa (capital de giro, investimentos,
// financiamentos); o que não for de nenhum grupo conhecido entra em
// "Outros" — nada se perde. Se o balanço não fecha numa das pontas, a
// diferença aparece numa etapa própria em vez de sumir na conta.

import { restoreAccents } from "./accents.js";
import { planNameCase } from "./planCase.js";

// Grupos do plano gerencial padrão (nível 3), por etapa. `sign` 1 = ativo
// (aumento consome caixa), -1 = passivo (aumento gera caixa).
const STEPS = [
  { id: "clientes", short: "Clientes", name: "Clientes e outros créditos", group: "operacional", prefixes: ["01.01.02"], kind: "ativo", help: "Venda que ainda não foi recebida prende caixa; recebimento de vendas antigas libera." },
  { id: "estoques", short: "Estoques", name: "Estoques", group: "operacional", prefixes: ["01.01.03"], kind: "ativo", help: "Comprar mais do que se vende enche o estoque e consome caixa." },
  { id: "outrosAtivos", short: "Outros ativos", name: "Outros ativos de curto prazo", group: "operacional", prefixes: ["01.01"], exclude: ["01.01.01", "01.01.02", "01.01.03"], kind: "ativo", help: "Despesas pagas antecipadamente e outros valores a receber no curto prazo." },
  { id: "fornecedores", short: "Fornecedores", name: "Fornecedores", group: "operacional", prefixes: ["02.01.01"], kind: "passivo", help: "Comprar a prazo segura caixa; pagar fornecedores antigos consome." },
  { id: "obrigacoes", short: "Impostos/encargos", name: "Impostos e encargos a pagar", group: "operacional", prefixes: ["02.01.03", "02.01.04", "02.02.02"], kind: "passivo", help: "Impostos, salários e encargos que ainda vão ser pagos." },
  { id: "outrosPassivos", short: "Outras a pagar", name: "Outras contas a pagar", group: "operacional", prefixes: ["02.01"], exclude: ["02.01.01", "02.01.02", "02.01.03", "02.01.04", "02.01.07"], kind: "passivo", help: "Adiantamentos de clientes, provisões e outras obrigações de curto prazo." },
  { id: "longoPrazo", short: "Créditos LP", name: "Créditos de longo prazo", group: "investimento", prefixes: ["01.02.01"], kind: "ativo", help: "Valores a receber no longo prazo (ex.: empréstimos a sócios ou empresas ligadas)." },
  { id: "investimentos", short: "Investimentos", name: "Investimentos em bens", group: "investimento", prefixes: ["01.02"], exclude: ["01.02.01"], kind: "ativo", addDepreciation: true, help: "Compra de máquinas, veículos, imóveis, sistemas e participações (sem a depreciação, que não sai do caixa)." },
  { id: "emprestimos", short: "Empréstimos", name: "Empréstimos e financiamentos", group: "financiamento", prefixes: ["02.01.02", "02.02.01"], kind: "passivo", help: "Tomar empréstimo traz caixa; pagar parcelas consome." },
  { id: "distribuicoes", short: "Distribuições", name: "Distribuições a pagar aos sócios", group: "financiamento", prefixes: ["02.01.07"], kind: "passivo", help: "Lucros já aprovados para os sócios: aumento ainda não saiu do caixa; redução é distribuição paga." },
  { id: "outrosLongo", short: "Outras LP", name: "Outras obrigações de longo prazo", group: "financiamento", prefixes: ["02.02"], exclude: ["02.02.01", "02.02.02"], kind: "passivo", help: "Demais valores a pagar no longo prazo." },
];

const startsWith = (code, prefix) => code === prefix || code.startsWith(`${prefix}.`);

function rowsAtLevel(bp, level) {
  return (bp || []).filter((row) => row.kind === "synthetic" && Number(row.nivel || 0) === level);
}

function nice(name) {
  return planNameCase(restoreAccents(name)).replace(/\b(lp|cp)\b/gi, (m) => m.toUpperCase());
}

// Nome no meio da frase: só a primeira letra minúscula (siglas ficam).
function inSentence(name) {
  return /^[A-Z]{2,}\b/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

export function buildCashBridge(ctx) {
  if (!ctx?.bp?.length) return null;
  const bp = ctx.bp;
  const find = (code) => bp.find((row) => row.codigo_gerencial === code);
  const start = (row) => Number(row?.saldo_inicial || 0);
  const end = (row) => Number(row?.saldo || 0);
  const caixa = find("01.01.01");
  const caixaInicio = start(caixa);
  const caixaFim = end(caixa);
  const variacao = caixaFim - caixaInicio;

  const dre = (code) => {
    const row = (ctx.dre || []).find((item) => item.codigo_gerencial === code);
    if (!row) return 0;
    const months = Object.values(row.monthValues || {});
    return months.length ? months.reduce((sum, value) => sum + Number(value || 0), 0) : Number(row.saldo || 0);
  };
  const lucro = dre("DRE.17") || dre("DRE.12");
  // Mesma depreciação da DRE Ebitda (DEX.09): a destacada e a que mora
  // dentro das despesas administrativas.
  const depreciacao = Math.abs(dre("DRE.11") + dre("DRE.07.07.03"));

  // Os grupos de nível 3 do Balanço (fora o caixa e o PL), cada um numa etapa.
  const groups = [...rowsAtLevel(bp, 3)].filter((row) => !startsWith(row.codigo_gerencial, "01.01.01") && !startsWith(row.codigo_gerencial, "03"));
  // Grupos de nível 2 sem filhos de nível 3 também entram (plano mais curto).
  rowsAtLevel(bp, 2).forEach((row) => {
    const code = row.codigo_gerencial;
    if (startsWith(code, "03") || code === "01.01" || code === "02.01" || code === "01.02" || code === "02.02") return;
    if (!groups.some((group) => group.codigo_gerencial.startsWith(`${code}.`))) groups.push(row);
  });

  const used = new Set();
  const steps = STEPS.map((step) => {
    const members = groups.filter((group) => {
      const code = group.codigo_gerencial;
      if (used.has(code)) return false;
      if (!step.prefixes.some((prefix) => startsWith(code, prefix))) return false;
      if ((step.exclude || []).some((prefix) => startsWith(code, prefix))) return false;
      return true;
    });
    members.forEach((group) => used.add(group.codigo_gerencial));
    const detail = members
      .map((group) => {
        const delta = end(group) - start(group);
        return { code: group.codigo_gerencial, name: nice(group.categoria_gerencial), start: start(group), end: end(group), delta, effect: step.kind === "ativo" ? -delta : delta };
      })
      .filter((item) => Math.abs(item.delta) > 0.5);
    let value = detail.reduce((sum, item) => sum + item.effect, 0);
    // A depreciação já foi somada de volta no começo; aqui o investimento
    // é o bruto (o imobilizado cai pela depreciação sem sair caixa).
    if (step.addDepreciation) value -= depreciacao;
    return { ...step, value, detail };
  });

  // O que sobrou de ativo/passivo sem etapa conhecida.
  const leftovers = groups
    .filter((group) => !used.has(group.codigo_gerencial))
    .map((group) => {
      const delta = end(group) - start(group);
      const isAsset = startsWith(group.codigo_gerencial, "01");
      return { code: group.codigo_gerencial, name: nice(group.categoria_gerencial), start: start(group), end: end(group), delta, effect: isAsset ? -delta : delta };
    })
    .filter((item) => Math.abs(item.delta) > 0.5);

  // Patrimônio líquido: o que mudou além do lucro (capital, ajustes,
  // distribuição direto do PL).
  const pl = find("03");
  const plOutros = end(pl) - start(pl) - lucro;

  const op = (id) => steps.find((step) => step.id === id);
  const operacionalSteps = steps.filter((step) => step.group === "operacional");
  const operacional = lucro + depreciacao + operacionalSteps.reduce((sum, step) => sum + step.value, 0);
  const investimento = steps.filter((step) => step.group === "investimento").reduce((sum, step) => sum + step.value, 0);
  const financiamento = steps.filter((step) => step.group === "financiamento").reduce((sum, step) => sum + step.value, 0) + plOutros;
  const outros = leftovers.reduce((sum, item) => sum + item.effect, 0);
  const calculado = operacional + investimento + financiamento + outros;
  const diferenca = variacao - calculado;

  const items = [
    { id: "lucro", short: "Lucro", name: lucro >= 0 ? "Lucro do período" : "Prejuízo do período", value: lucro, type: "start", group: "operacional", help: "Resultado líquido da DRE no período." },
    { id: "depreciacao", short: "Depreciação", name: "Depreciação (não sai do caixa)", value: depreciacao, type: "step", group: "operacional", help: "Despesa da DRE que não é pagamento: volta para o caixa." },
    ...operacionalSteps.map((step) => ({ id: step.id, short: step.short, name: step.name, value: step.value, type: "step", group: step.group, detail: step.detail, help: step.help })),
    { id: "operacional", short: "Operação", name: "Caixa da operação", value: operacional, type: "subtotal", help: "Quanto a operação gerou (ou consumiu) de caixa." },
    ...steps.filter((step) => step.group === "investimento").map((step) => ({ id: step.id, short: step.short, name: step.name, value: step.value, type: "step", group: step.group, detail: step.detail, help: step.help })),
    ...steps.filter((step) => step.group === "financiamento").map((step) => ({ id: step.id, short: step.short, name: step.name, value: step.value, type: "step", group: step.group, detail: step.detail, help: step.help })),
    { id: "pl", short: "PL", name: "Capital e outros movimentos do PL", value: plOutros, type: "step", group: "financiamento", help: "Aporte ou redução de capital, distribuição direto do patrimônio e ajustes." },
    { id: "outros", short: "Outros", name: "Outros", value: outros, type: "step", detail: leftovers, help: "Grupos do Balanço fora das etapas acima." },
    { id: "diferenca", short: "Diferença", name: "Diferença do balanço", value: diferenca, type: "step", help: "O balanço não fecha numa das pontas do período — confira o De/Para." },
    { id: "variacao", short: "Caixa", name: variacao >= 0 ? "Aumento do caixa" : "Redução do caixa", value: variacao, type: "total", help: "Caixa no fim menos caixa no início do período." },
  ].filter((item) => item.type !== "step" || Math.abs(item.value) > 0.5);

  // O maior "vilão" (o que mais consumiu caixa) e o maior "herói".
  const movers = items.filter((item) => item.type === "step" && item.id !== "diferenca" && item.id !== "depreciacao");
  const vilao = [...movers].sort((a, b) => a.value - b.value)[0];
  const heroi = [...movers].sort((a, b) => b.value - a.value)[0];
  return {
    items,
    lucro,
    depreciacao,
    caixaInicio,
    caixaFim,
    variacao,
    operacional,
    investimento,
    financiamento,
    diferenca,
    fecha: Math.abs(diferenca) < 1,
    vilao: vilao && vilao.value < -0.5 ? vilao : null,
    heroi: heroi && heroi.value > 0.5 ? heroi : null,
    clientes: op("clientes")?.value || 0,
    estoques: op("estoques")?.value || 0,
  };
}

const money = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e4) return `${sign}R$ ${(abs / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

// A leitura em uma frase: "Lucro de R$ 397,9 mil, mas o caixa caiu R$ 302,5
// mil — o que mais consumiu foi estoques (-R$ 367,6 mil)."
export function bridgeSentence(bridge) {
  if (!bridge) return "";
  const lucroText = `${bridge.lucro >= 0 ? "Lucro" : "Prejuízo"} de ${money(Math.abs(bridge.lucro))}`;
  const caixaText = bridge.variacao >= 0 ? `o caixa subiu ${money(bridge.variacao)}` : `o caixa caiu ${money(Math.abs(bridge.variacao))}`;
  const link = (bridge.lucro >= 0) === (bridge.variacao >= 0) ? "e" : "mas";
  const vilao = bridge.vilao ? ` O que mais consumiu caixa: ${inSentence(bridge.vilao.name)} (${money(bridge.vilao.value)}).` : "";
  const heroi = bridge.heroi && bridge.heroi.id !== "depreciacao" ? ` O que mais ajudou: ${inSentence(bridge.heroi.name)} (+${money(bridge.heroi.value).replace("-", "")}).` : "";
  return `${lucroText}, ${link} ${caixaText}.${vilao}${heroi}`;
}
