import { isResultClosingEntry } from "../data/calculations.js";
import { accountNature } from "./accountNature.js";

// Conferência do razão: procura o que parece erro de lançamento antes de o
// mês ir para o cliente. Cinco tipos de suspeita:
//  - duplicado: o mesmo lançamento (data, contas, valores e histórico)
//    lançado duas vezes com números de lançamento diferentes;
//  - valor: um lançamento numa conta de resultado muito acima do que essa
//    conta costuma receber (10× a mediana e 3× os 10% maiores);
//  - mes: o total do mês de uma conta de resultado fora do padrão dos
//    outros meses;
//  - sinal: o mês de uma conta de resultado ficou com o sinal trocado
//    (despesa com saldo credor, receita com saldo devedor);
//  - nova: conta de resultado usada pela primeira vez depois de meses de
//    razão — às vezes é lançamento na conta errada.
// As réguas foram ajustadas no razão real de 2026 (jan–set) de uma empresa
// da carteira: acham repetição de recebimento, compra lançada em despesa de
// viagem, despesa de cartão estornada no mês etc., sem encher a lista.
// O que o usuário marca como "está certo" fica em company.anomaliasOk.

export const ANOMALY_KINDS = {
  duplicado: { label: "Lançamento repetido", short: "Repetidos" },
  valor: { label: "Valor fora do padrão da conta", short: "Valor fora do padrão" },
  mes: { label: "Mês fora do padrão", short: "Mês fora do padrão" },
  sinal: { label: "Sinal invertido no mês", short: "Sinal invertido" },
  nova: { label: "Conta usada pela primeira vez", short: "Conta nova" },
};

export const ANOMALY_LEVEL_RANK = { alta: 3, media: 2, baixa: 1 };

const cents = (value) => Math.round(Number(value || 0) * 100) / 100;
const normText = (value) => String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
const amount = (entry) => cents(Number(entry.debito || 0) || Number(entry.credito || 0));

function median(sorted) {
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function monthsBetween(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

const byValue = (a, b) => b.value - a.value;

export function detectAnomalies(journal, { start = "", end = "", natureRules, dismissed = [] } = {}) {
  const inRange = (date) => (!start || date >= start) && (!end || date <= end);
  const monthInRange = (month) => (!start || month >= start.slice(0, 7)) && (!end || month <= end.slice(0, 7));
  const entries = (journal || []).filter((entry) => String(entry.data || "").length >= 10 && amount(entry) !== 0 && !isResultClosingEntry(entry));
  const isResult = (entry) => (entry.demonstrativo ? entry.demonstrativo === "DRE" : accountNature(entry.classificacao, natureRules) === "resultado");
  const items = [];

  // ── Repetidos ──
  const byOrigin = new Map();
  entries.forEach((entry, index) => {
    const origin = entry.linha_origem != null && entry.linha_origem !== "" ? `${entry.companyId || ""}|${entry.linha_origem}` : `#${index}`;
    if (!byOrigin.has(origin)) byOrigin.set(origin, []);
    byOrigin.get(origin).push(entry);
  });
  const bySignature = new Map();
  byOrigin.forEach((lines, origin) => {
    const date = lines[0].data.slice(0, 10);
    const parts = lines.map((line) => `${line.classificacao}:${cents(line.debito)}:${cents(line.credito)}`).sort();
    const signature = `${lines[0].companyId || ""}|${date}|${normText(lines[0].historico)}|${parts.join(";")}`;
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature).push({ origin, lines });
  });
  const dupGroups = [...bySignature.values()]
    .filter((copies) => copies.length > 1 && inRange(copies[0].lines[0].data.slice(0, 10)))
    .map((copies) => copies.sort((a, b) => String(a.origin).localeCompare(String(b.origin), "pt-BR", { numeric: true })));
  // Um lançamento de várias linhas que a Domínio grava com um número por
  // linha (recebimento + banco + tarifa, em sequência) vira um aviso só.
  const originNumber = (origin) => Number(String(origin).split("|").pop());
  const merged = [];
  dupGroups
    .sort((a, b) => originNumber(a[0].origin) - originNumber(b[0].origin))
    .forEach((copies) => {
      const previous = merged[merged.length - 1];
      const follows =
        previous &&
        previous.copies.length === copies.length &&
        previous.date === copies[0].lines[0].data.slice(0, 10) &&
        copies.every((copy, index) => originNumber(copy.origin) - originNumber(previous.copies[index].last) === 1);
      if (follows) {
        copies.forEach((copy, index) => {
          previous.copies[index].lines.push(...copy.lines);
          previous.copies[index].last = copy.origin;
          previous.copies[index].origins.push(copy.origin);
        });
      } else {
        merged.push({ date: copies[0].lines[0].data.slice(0, 10), copies: copies.map((copy) => ({ lines: [...copy.lines], last: copy.origin, origins: [copy.origin] })) });
      }
    });
  merged.forEach((group) => {
    const first = group.copies[0].lines;
    const debit = cents(first.reduce((sum, line) => sum + Number(line.debito || 0), 0));
    const credit = cents(first.reduce((sum, line) => sum + Number(line.credito || 0), 0));
    const value = Math.max(debit, credit);
    const main = [...first].sort((a, b) => amount(b) - amount(a))[0];
    const numbers = group.copies.map((copy) => copy.origins.map((origin) => String(origin).split("|").pop()).join(", "));
    items.push({
      id: `duplicado|${group.date}|${group.copies.map((copy) => copy.origins.join("+")).join("/")}`,
      kind: "duplicado",
      level: value >= 1000 ? "alta" : value >= 100 ? "media" : "baixa",
      date: group.date,
      month: group.date.slice(0, 7),
      classificacao: main.classificacao,
      conta: main.descricao_conta || main.nome_conta || "",
      categoria: main.categoria_gerencial || "",
      value,
      reason: `${group.copies.length} lançamentos iguais no mesmo dia (mesmas contas, valores e histórico) — números ${numbers.join(" e ")}. Se for o mesmo fato lançado duas vezes, um deles precisa sair.`,
      entries: group.copies.flatMap((copy, index) => copy.lines.map((line) => ({ ...line, copia: index + 1 }))),
    });
  });

  // ── Contas de resultado: mês a mês ──
  const accounts = new Map();
  entries.filter(isResult).forEach((entry) => {
    const key = `${entry.companyId || ""}|${entry.classificacao}`;
    if (!accounts.has(key)) accounts.set(key, { classificacao: entry.classificacao, conta: entry.descricao_conta || entry.nome_conta || "", categoria: entry.categoria_gerencial || "", lines: [], months: new Map() });
    const account = accounts.get(key);
    account.lines.push(entry);
    const month = entry.data.slice(0, 7);
    account.months.set(month, cents((account.months.get(month) || 0) + Number(entry.debito || 0) - Number(entry.credito || 0)));
  });
  const firstMonth = entries.reduce((min, entry) => (!min || entry.data < min ? entry.data : min), "").slice(0, 7);
  const flaggedMonths = new Set();
  const topLines = (account, month, side) =>
    account.lines
      .filter((line) => line.data.slice(0, 7) === month && (!side || (side === "credito" ? Number(line.credito || 0) > 0 : Number(line.debito || 0) > 0)))
      .sort((a, b) => amount(b) - amount(a))
      .slice(0, 6);
  const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const monthName = (month) => {
    const [year, number] = month.split("-");
    return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(number) - 1]}/${year}`;
  };

  accounts.forEach((account, key) => {
    const months = [...account.months.entries()].filter(([, value]) => Math.abs(value) > 0.005);
    const total = months.reduce((sum, [, value]) => sum + value, 0);
    const average = months.length ? Math.abs(total) / months.length : 0;

    // Sinal invertido.
    months.forEach(([month, value]) => {
      if (!monthInRange(month) || Math.abs(total) < 1 || value * total >= 0) return;
      if (Math.abs(value) < 500 || Math.abs(value) < 0.1 * average) return;
      const credora = value < 0;
      flaggedMonths.add(`${key}|${month}`);
      items.push({
        id: `sinal|${account.classificacao}|${month}`,
        kind: "sinal",
        level: Math.abs(value) >= 5000 ? "alta" : "media",
        month,
        date: `${month}-01`,
        classificacao: account.classificacao,
        conta: account.conta,
        categoria: account.categoria,
        value: Math.abs(value),
        reason: `Em ${monthName(month)} a conta fechou ${credora ? "credora" : "devedora"} em ${money(Math.abs(value))}, ao contrário do normal dela (no razão todo ela é ${total > 0 ? "devedora" : "credora"}). Costuma ser estorno maior que a despesa, lançamento invertido ou conta trocada.`,
        entries: topLines(account, month, credora ? "credito" : "debito"),
      });
    });

    // Mês fora do padrão.
    if (months.length >= 4) {
      months.forEach(([month, value]) => {
        if (!monthInRange(month) || flaggedMonths.has(`${key}|${month}`)) return;
        const others = months.filter(([other]) => other !== month).map(([, other]) => Math.abs(other)).sort((a, b) => a - b);
        const typical = median(others);
        const highest = others[others.length - 1] || 0;
        if (Math.abs(value) < 2000 || Math.abs(value) <= 3 * typical || Math.abs(value) <= 1.5 * highest) return;
        flaggedMonths.add(`${key}|${month}`);
        const times = typical > 0 ? Math.abs(value) / typical : null;
        items.push({
          id: `mes|${account.classificacao}|${month}`,
          kind: "mes",
          level: times == null || times >= 8 ? "alta" : "media",
          month,
          date: `${month}-01`,
          classificacao: account.classificacao,
          conta: account.conta,
          categoria: account.categoria,
          value: Math.abs(value),
          reason: `${monthName(month)} somou ${money(Math.abs(value))}${times ? `, ${times.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o mês típico dessa conta (${money(typical)})` : ""} e ${(Math.abs(value) / Math.max(highest, 1)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o maior dos outros meses. Confira se não é lançamento na conta errada ou em duplicidade.`,
          entries: topLines(account, month),
        });
      });
    }

    // Valor fora do padrão (lançamento a lançamento).
    if (account.lines.length >= 8) {
      const values = account.lines.map(amount).sort((a, b) => a - b);
      const typical = median(values);
      account.lines.forEach((line) => {
        const value = amount(line);
        const month = line.data.slice(0, 7);
        if (!inRange(line.data.slice(0, 10)) || flaggedMonths.has(`${key}|${month}`)) return;
        if (value < 1000 || value <= 10 * typical) return;
        const others = values.slice();
        others.splice(others.indexOf(value), 1);
        const p90 = others[Math.floor(others.length * 0.9)] || 0;
        if (value <= 3 * p90) return;
        items.push({
          id: `valor|${line.linha_origem ?? ""}|${account.classificacao}|${line.data.slice(0, 10)}|${value}`,
          kind: "valor",
          level: value >= 30 * typical ? "alta" : "media",
          date: line.data.slice(0, 10),
          month,
          classificacao: account.classificacao,
          conta: account.conta,
          categoria: account.categoria,
          value,
          reason: `${money(value)} num lançamento só, quando essa conta costuma receber ${money(typical)} (mediana) e quase nunca passa de ${money(p90)}. Confira se a conta está certa — é comum uma compra ou um pagamento cair numa despesa que não é a dele.`,
          entries: [line],
        });
      });
    }

    // Conta usada pela primeira vez.
    const firstUse = months.map(([month]) => month).sort()[0];
    if (firstUse && firstMonth && monthInRange(firstUse) && monthsBetween(firstMonth, firstUse) >= 3) {
      const value = Math.abs(account.months.get(firstUse) || 0);
      if (value >= 300) {
        items.push({
          id: `nova|${account.classificacao}`,
          kind: "nova",
          level: "baixa",
          month: firstUse,
          date: `${firstUse}-01`,
          classificacao: account.classificacao,
          conta: account.conta,
          categoria: account.categoria,
          value,
          reason: `Primeiro lançamento dessa conta no razão (desde ${monthName(firstMonth)}), em ${monthName(firstUse)}. Se for uma despesa ou receita nova, tudo bem; se não, pode ser a conta errada.`,
          entries: topLines(account, firstUse),
        });
      }
    }
  });

  const ok = new Set(dismissed || []);
  const list = items
    .map((item) => ({ ...item, dismissed: ok.has(item.id) }))
    .sort((a, b) => a.dismissed - b.dismissed || ANOMALY_LEVEL_RANK[b.level] - ANOMALY_LEVEL_RANK[a.level] || byValue(a, b));
  const open = list.filter((item) => !item.dismissed);
  const byKind = Object.fromEntries(Object.keys(ANOMALY_KINDS).map((kind) => [kind, open.filter((item) => item.kind === kind).length]));
  return { items: list, open: open.length, dismissed: list.length - open.length, byKind, alta: open.filter((item) => item.level === "alta").length };
}

// Resumo pequeno para a Saúde da carteira (fica no cache do navegador).
export function anomalySummary(result) {
  return {
    open: result.open,
    alta: result.alta,
    byKind: result.byKind,
    top: result.items
      .filter((item) => !item.dismissed)
      .slice(0, 3)
      .map((item) => ({ kind: item.kind, conta: item.conta, month: item.month, value: item.value })),
  };
}
