// Testes automáticos do AthosBI com a empresa fictícia de
// tests/fixtures/empresaExemplo.mjs (nenhum dado de cliente). Rodam no Node,
// sem navegador: `npm test` (ou node --import ./tests/register.mjs
// tests/app.test.mjs). Cada teste confere um número do app contra a conta
// feita à mão a partir das operações da empresa-exemplo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEmpresaExemplo, COMPANY_ID, PERIOD } from "./fixtures/empresaExemplo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (file) => import(path.join(ROOT, "src", file));

const { state } = await src("data/store.js");
const { parseCsv } = await src("importers/csv.js");
const { DEFAULT_NATURE_RULES } = await src("lib/accountNature.js");
const csv = (file) => parseCsv(fs.readFileSync(path.join(ROOT, "public/data", file), "utf8"));

const plano = csv("plano_gerencial_padrao.csv");
const { company, journal, expected } = buildEmpresaExemplo(plano);

function setCompanyState(start = PERIOD.start, end = PERIOD.end) {
  Object.assign(state, {
    plano,
    planoGlobal: plano,
    companies: [company],
    groups: [],
    activeCompanyId: COMPANY_ID,
    activeGroupId: "",
    mappings: company.mappings,
    accounts: company.accounts,
    journal,
    dfcStructure: csv("estrutura_dfc_direta.csv"),
    dfcRules: csv("regras_dfc_direta.csv"),
    dfcLinks: csv("vinculo_gerencial_dfc.csv"),
    dfcOverrides: [],
    natureRules: DEFAULT_NATURE_RULES,
    hideNonOperatingResults: false,
    excludedNonOperatingCodes: [],
    periodStart: start,
    periodEnd: end,
    orcamentos: [],
  });
}
setCompanyState();

let failures = 0;
let total = 0;
const near = (a, b, tolerance = 0.02) => Math.abs(Number(a) - Number(b)) <= tolerance;
function check(label, ok, detail) {
  total += 1;
  console.log(`${ok ? "OK   " : "FALHA"} ${label}${ok ? "" : ` → ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
}
function section(name) {
  console.log(`\n── ${name}`);
}

const { buildDashboardContext } = await src("lib/dashboardData.js");
const { kpis } = await src("data/calculations.js");
const row = (tree, code) => tree.find((item) => item.codigo_gerencial === code);
const value = (tree, code) => Number(row(tree, code)?.saldo || 0);

// ── DRE ──
section("DRE");
let ctx = buildDashboardContext();
check(`Receita bruta = vendas (${expected.vendas})`, near(value(ctx.dre, "DRE.01"), expected.vendas), value(ctx.dre, "DRE.01"));
check(`Receita líquida = vendas − PIS (${expected.receitaLiquida})`, near(value(ctx.dre, "DRE.03"), expected.receitaLiquida), value(ctx.dre, "DRE.03"));
check(`Lucro bruto (${expected.lucroBruto})`, near(value(ctx.dre, "DRE.05"), expected.lucroBruto), value(ctx.dre, "DRE.05"));
check(`Despesas administrativas (${expected.despesasAdm})`, near(value(ctx.dre, "DRE.07"), expected.despesasAdm), value(ctx.dre, "DRE.07"));
check(`Resultado financeiro (${expected.financeiro})`, near(value(ctx.dre, "DRE.13"), expected.financeiro), value(ctx.dre, "DRE.13"));
check(`Lucro líquido (${expected.lucro})`, near(value(ctx.dre, "DRE.17"), expected.lucro), value(ctx.dre, "DRE.17"));
const formulas = [
  ["DRE.03", ["DRE.01", "DRE.02"]],
  ["DRE.05", ["DRE.03", "DRE.04"]],
  ["DRE.10", ["DRE.05", "DRE.06", "DRE.07", "DRE.08", "DRE.09"]],
  ["DRE.12", ["DRE.10", "DRE.11"]],
  ["DRE.15", ["DRE.12", "DRE.13", "DRE.14"]],
  ["DRE.17", ["DRE.15", "DRE.16"]],
];
formulas.forEach(([target, parts]) => {
  const sum = parts.reduce((acc, code) => acc + value(ctx.dre, code), 0);
  check(`${target} = ${parts.join(" + ")}`, near(value(ctx.dre, target), sum), { target: value(ctx.dre, target), sum });
});
check(`EBITDA = lucro operacional + depreciação (${expected.depreciacao})`, near(ctx.ebitda, value(ctx.dre, "DRE.12") + expected.depreciacao), { ebitda: ctx.ebitda, dre12: value(ctx.dre, "DRE.12") });

// ── Balanço ──
section("Balanço");
check(`Ativo total (${expected.ativo})`, near(value(ctx.bp, "01"), expected.ativo), value(ctx.bp, "01"));
check(`Caixa e equivalentes no fim (${expected.caixa})`, near(value(ctx.bp, "01.01.01"), expected.caixa), value(ctx.bp, "01.01.01"));
const fecha = value(ctx.bp, "01") - value(ctx.bp, "02") - value(ctx.bp, "03");
check("Balanço fecha (ativo = passivo + PL, com o resultado do período)", near(fecha, 0), { ativo: value(ctx.bp, "01"), passivo: value(ctx.bp, "02"), pl: value(ctx.bp, "03") });
const indicators = kpis();
check(`Receita do resumo de indicadores (${expected.receitaLiquida})`, near(indicators.receita, expected.receitaLiquida), indicators.receita);

// ── Mês a mês e comparativo ──
section("Períodos");
const { rowsForPeriod, rowValue } = await src("lib/periodCompare.js");
const jan = rowsForPeriod("DRE", "2026-01-01", "2026-01-31");
const fev = rowsForPeriod("DRE", "2026-02-01", "2026-02-28");
const janVendas = rowValue(jan.find((item) => item.codigo_gerencial === "DRE.01"), "DRE");
const fevVendas = rowValue(fev.find((item) => item.codigo_gerencial === "DRE.01"), "DRE");
check("Vendas de janeiro = 100.000", near(janVendas, 100000), janVendas);
check("Vendas de fevereiro = 110.000 (+10%)", near(fevVendas, 110000), fevVendas);
check("rowsForPeriod devolve o período global intacto", state.periodStart === PERIOD.start && state.periodEnd === PERIOD.end, { start: state.periodStart, end: state.periodEnd });

// ── Ponte do lucro ao caixa ──
section("Ponte do lucro ao caixa");
const { buildCashBridge } = await src("lib/cashBridge.js");
const bridge = buildCashBridge(ctx);
check("A ponte fecha (sem diferença do balanço)", bridge?.fecha === true, bridge && { diferenca: bridge.diferenca });
check(`Começa no lucro (${expected.lucro})`, near(bridge.lucro, expected.lucro), bridge.lucro);
check(`Termina na variação do caixa (${expected.variacaoCaixa})`, near(bridge.variacao, expected.variacaoCaixa), bridge.variacao);
check(`Depreciação volta somando (${expected.depreciacao})`, near(bridge.depreciacao, expected.depreciacao), bridge.depreciacao);

// ── Do número ao lançamento ──
section("Do número ao lançamento");
const { WIDGET_CATALOG } = await src("lib/dashboardWidgets.js");
const { buildDrill } = await src("lib/drill.js");
const { ledgerData } = await src("lib/slideDemo.js");
let nodes = 0;
let badSums = 0;
let ledgers = 0;
let badLedgers = 0;
for (const definition of WIDGET_CATALOG.filter((item) => item.formula)) {
  const drill = buildDrill(definition, ctx);
  for (const column of ["total", ...drill.months]) {
    const walk = (node) => {
      const kids = node.children();
      if (kids.length) {
        nodes += 1;
        const sum = kids.reduce((acc, kid) => acc + kid.value(column), 0);
        if (!near(sum, node.value(column))) badSums += 1;
      }
      if (column === "total") {
        const request = node.kind === "account" ? node.ledger : node.lineLedger?.();
        if (request) {
          ledgers += 1;
          const data = ledgerData({ ...request, months: drill.months });
          const got = request.source === "BP" ? data.closing : data.total;
          if (!near(got, node.value("total") * node.sign)) badLedgers += 1;
        }
      }
      kids.forEach(walk);
    };
    drill.groups.forEach((group) => group.terms.forEach(walk));
  }
  if (definition.formula.kind === "sum") {
    check(`Card "${definition.label}": soma dos termos = valor do card`, near(drill.groupTotal(drill.groups[0], "total"), definition.value(ctx).value), { card: definition.value(ctx).value });
  }
}
check(`Cada nível soma o de cima (${nodes} linhas conferidas)`, badSums === 0, { badSums });
check(`O razão de cada conta/linha bate com o valor dela (${ledgers} razões)`, badLedgers === 0, { badLedgers });

// ── Orçamento ──
section("Orçamento");
const budget = await src("lib/budget.js");
const devGood = budget.deviation(-1000, -1003);
check("Diferença de centavos (0,3%) não conta como desvio", devGood.tone === "bom", devGood);
const devBad = budget.deviation(100000, 80000);
check("Receita 20% abaixo do orçado é 'ruim'", devBad.tone === "ruim" && near(devBad.pct, -20), devBad);
const orc = budget.newBudget(2026, "Principal");
const filled = budget.fillFromActuals(orc, ctx, { mode: "media", pct: 10, months: ["2026-04", "2026-05"] });
check("Preencher pela média + 10% gera valores", budget.hasAnyValue(filled), null);

// ── Assistente de apresentações ──
section("Assistente");
const { parseRequest } = await src("lib/assistant/parse.js");
const { buildCatalog } = await src("lib/assistant/context.js");
const catalog = buildCatalog(ctx);
const request = parseRequest("resultado de fevereiro para os sócios, destacando caixa, uns 8 slides, didático", catalog);
check("Entende o mês (fevereiro de 2026)", request.period?.start === "2026-02-01" && request.period?.end === "2026-02-28", request.period);
check("Entende o público (sócios)", request.audience?.id === "socios", request.audience);
check("Entende o tamanho (8 slides)", request.size?.target === 8, request.size);
check("Entende o jeito (didático)", (request.tones || []).includes("didatico"), request.tones);

// ── Saúde da carteira ──
section("Saúde da carteira");
const { companyHealth } = await src("lib/carteira.js");
const health = companyHealth(company, { today: new Date("2026-04-10T12:00:00") });
const balancoCheck = (health.checks || []).find((item) => item.id === "balanco");
check("Balanço da empresa-exemplo aparece como fechando", balancoCheck && balancoCheck.level !== "critico", balancoCheck);

// Conta sem De/Para: o app tem de perceber (e o balanço deixa de fechar).
const { missingMappingAccounts } = await src("data/calculations.js");
state.mappings = company.mappings.filter((item) => item.classificacao !== "1.1.3.01");
const missing = missingMappingAccounts();
check("Conta sem De/Para aparece como pendente", missing.some((item) => item.classificacao === "1.1.3.01"), missing.map((item) => item.classificacao));
state.mappings = company.mappings;

// ── Compartilhar por link e biblioteca ──
section("Compartilhar e biblioteca");
const { newShareToken, expiryFromChoice, shareStatus } = await src("lib/sharing.js");
const token = newShareToken();
check("Código do link: 24 caracteres sem ambíguos", /^[A-HJ-NP-Za-km-z2-9]{24}$/.test(token), token);
check("Dois links nunca repetem o código", newShareToken() !== token, null);
const sevenDays = (new Date(expiryFromChoice("7")) - new Date()) / 86400000;
check("Validade de 7 dias", sevenDays > 6 && sevenDays < 8.1, sevenDays);
check("Sem prazo = sem data", expiryFromChoice("never") === null, null);
check("Link revogado e vencido", shareStatus({ revoked_at: "2026-01-01" }) === "revogado" && shareStatus({ expires_at: "2000-01-01" }) === "expirado" && shareStatus({}) === "ativo", null);
const { favoriteOverrides } = await src("lib/officeLibrary.js");
const kept = favoriteOverrides({ period: { start: "2026-01-01", end: "2026-01-31" }, audience: "socios", size: 8 });
check("Pedido salvo não leva o período (e leva o resto)", !("period" in kept) && kept.audience === "socios" && kept.size === 8, kept);

console.log(`\n${total - failures} de ${total} testes passaram.`);
if (failures) {
  console.log(`${failures} FALHA(S).`);
  process.exit(1);
}
