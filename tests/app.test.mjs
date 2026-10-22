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

// ── Prazos médios e ciclo financeiro ──
section("Prazos médios");
const { prazosDoCtx } = await src("lib/prazos.js");
const prazos = prazosDoCtx(ctx);
// Clientes 80.000 → 110.000 (média 95.000) sobre receita bruta 300.000 em 90 dias.
check("Prazo de recebimento = 95.000 ÷ 300.000 × 90 = 28,5 dias", near(prazos.pmr, 28.5, 0.01), prazos.pmr);
// Estoque 60.000 → 75.000 (média 67.500) sobre custo 135.000.
check("Prazo de estoque = 67.500 ÷ 135.000 × 90 = 45 dias", near(prazos.pme, 45, 0.01), prazos.pme);
// Fornecedores 50.000 → 56.000 (média 53.000) sobre compras 135.000.
check("Prazo de pagamento = 53.000 ÷ 135.000 × 90 ≈ 35,3 dias", near(prazos.pmp, 35.333, 0.01), prazos.pmp);
check("Ciclo financeiro = 28,5 + 45 − 35,3 ≈ 38,2 dias", near(prazos.ciclo, 38.167, 0.01), prazos.ciclo);
const { analyze } = await src("lib/assistant/analysis.js");
const facts = analyze(ctx, { period: PERIOD, label: "1º tri" }).facts;
check("Cards de prazo batem com o assistente de slides", near(facts.pmr, prazos.pmr, 0.001) && near(facts.pme, prazos.pme, 0.001) && near(facts.pmp, prazos.pmp, 0.001), { assistente: [facts.pmr, facts.pme, facts.pmp] });
const cardPrazo = WIDGET_CATALOG.find((item) => item.id === "prazo_recebimento");
check("Card mostra em dias", cardPrazo && (await src("lib/dashboardWidgets.js")).formatWidgetValue(cardPrazo.value(ctx).value, "days") === "29 dias", cardPrazo?.value(ctx));

// Aplicar indicadores personalizados não pode apagar os cards de prazo
// (eles não têm fórmula editável — bug corrigido junto com os cards).
const { restoreIndicatorOverrides } = await src("lib/indicators.js");
restoreIndicatorOverrides([]);
const prazoDepois = WIDGET_CATALOG.find((item) => item.id === "prazo_recebimento");
check("Indicadores personalizados não apagam os cards de prazo", Boolean(prazoDepois) && prazoDepois.value(ctx).format === "days", prazoDepois?.value(ctx));

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

// ── Sugestão de De/Para ──
section("Sugestão de De/Para");
const { suggestDepara, mappingFromSuggestion } = await src("lib/deparaSugestao.js");
const vinc = (classificacao, nome_conta, codigo_gerencial, codigo_conta = "") => ({ classificacao, nome_conta, codigo_gerencial, codigo_conta });
const conta = (classificacao, nome_conta, codigo = "") => ({ classificacao, nome_conta, codigo, tipo_sintetica: "nao" });
const sugerir = (accounts, extra = {}) => {
  const result = suggestDepara({ accounts, mappings: extra.mappings || [], otherCompanies: extra.others || [], plano, natureRules: DEFAULT_NATURE_RULES, ...extra.options });
  return (classificacao) => result.suggestions.find((item) => item.account.classificacao === classificacao);
};
const proprios = [vinc("1.1.2.01", "CLIENTE ALFA", "01.01.02.01.02", "501"), vinc("1.1.2.02", "CLIENTE BETA", "01.01.02.01.02", "502"), vinc("1.1.2.03", "CLIENTE DELTA", "01.01.02.01.02", "503")];
const irmas = sugerir([conta("1.1.2.04", "CLIENTE GAMA")], { mappings: proprios })("1.1.2.04");
check("Conta nova entre irmãs que vão todas pro mesmo lugar → alta", irmas.row?.codigo_gerencial === "01.01.02.01.02" && irmas.confidence === "alta", irmas.reason);
const renumerada = sugerir([conta("1.1.9.01", "BANCO EXEMPLO S/A", "777")], { mappings: [vinc("1.1.1.02", "BANCO EXEMPLO S/A", "01.01.01.02.01", "777")] })("1.1.9.01");
check("A mesma conta com outro número → mesma linha", renumerada.row?.codigo_gerencial === "01.01.01.02.01" && renumerada.confidence === "alta", renumerada.reason);
const destoa = sugerir([conta("1.1.2.05", "CLIENTE OMEGA", "900")], { mappings: [...proprios, vinc("1.1.2.99", "CLIENTE OMEGA", "01.01.01.02.01", "900")] })("1.1.2.05");
check("Vínculo antigo que destoa das irmãs perde para elas", destoa.row?.codigo_gerencial === "01.01.02.01.02", destoa.reason);
const outras = [
  { id: "a", name: "Empresa A", mappings: [vinc("9.5.1.01", "Energia Elétrica", "DRE.07.02.01.01")] },
  { id: "b", name: "Empresa B", mappings: [vinc("9.7.2.11", "ENERGIA ELETRICA", "DRE.07.02.01.01")] },
];
const carteira = sugerir([conta("9.3.4.01", "ENERGIA ELÉTRICA")], { others: outras })("9.3.4.01");
check("Mesmo nome em 2 empresas da carteira → alta", carteira.row?.codigo_gerencial === "DRE.07.02.01.01" && carteira.confidence === "alta" && /2 de 2/.test(carteira.reason), carteira.reason);
const naturezaErrada = sugerir([conta("9.3.5.01", "CONTA ESQUISITA XYZ")], { others: [{ id: "c", mappings: [vinc("9.1.1.01", "CONTA ESQUISITA XYZ", "01.01.01.01.01")] }] })("9.3.5.01");
check("Nunca sugere linha de natureza diferente (despesa → caixa)", naturezaErrada.row?.codigo_gerencial !== "01.01.01.01.01", naturezaErrada.row?.codigo_gerencial);
const outroPlano = [{ id: "d", planoPadraoId: "pp_outro", mappings: [vinc("9.5.1.01", "ENERGIA ELETRICA", "DRE.07.02.01.01")] }];
const semGlobal = sugerir([conta("9.3.4.01", "ENERGIA ELETRICA")], { others: outroPlano, options: { globalCodes: new Set() } })("9.3.4.01");
const comGlobal = sugerir([conta("9.3.4.01", "ENERGIA ELETRICA")], { others: outroPlano, options: { globalCodes: new Set(["DRE.07.02.01.01"]) } })("9.3.4.01");
check("Outro plano padrão só vale com linha do plano global", semGlobal.row?.codigo_gerencial !== "DRE.07.02.01.01" && comGlobal.row?.codigo_gerencial === "DRE.07.02.01.01", [semGlobal.row?.codigo_gerencial, comGlobal.row?.codigo_gerencial]);
const parecida = sugerir([conta("9.3.6.01", "ASSINATURA DE JORNAIS E REVISTAS")], { others: [{ id: "e", name: "Empresa E", mappings: [vinc("9.2.2.01", "ASSINATURA DE JORNAIS", "DRE.07.02.01.01")] }] })("9.3.6.01");
check("Nome parecido em outra empresa → média, com o motivo", parecida.row?.codigo_gerencial === "DRE.07.02.01.01" && parecida.confidence === "media" && /Empresa E/.test(parecida.reason), parecida.reason);
const nada = sugerir([conta("9.3.7.01", "QWERTY ZXCVB")])("9.3.7.01");
check("Sem pista nenhuma → sem sugestão (não inventa)", !nada.row && !nada.confidence, nada);
const gravado = mappingFromSuggestion(irmas);
check("Vínculo aceito fica marcado como sugerido", gravado.codigo_gerencial === "01.01.02.01.02" && gravado.observacao.startsWith("Sugerido (Alta)") && gravado.categoria_gerencial === irmas.row.nome, gravado);
const todas = suggestDepara({ accounts: company.accounts, mappings: company.mappings, plano });
check("Empresa toda vinculada → nada pendente", todas.pending.length === 0 && todas.suggestions.length === 0, todas.counts);

// ── Conferência dos lançamentos ──
section("Conferência dos lançamentos");
const { detectAnomalies } = await src("lib/anomalias.js");
const conferir = (entries, extra = {}) => detectAnomalies(entries, { start: PERIOD.start, end: PERIOD.end, natureRules: DEFAULT_NATURE_RULES, ...extra });
const limpo = conferir(journal);
check("Razão da empresa-exemplo: nada estranho", limpo.open === 0, limpo.items.map((item) => `${item.kind} ${item.conta}`));
const venda = journal.filter((entry) => entry.linha_origem === journal[0].linha_origem);
const repetido = conferir([...journal, ...venda.map((entry) => ({ ...entry, linha_origem: "9001" }))]);
const dup = repetido.items.find((item) => item.kind === "duplicado");
check("Lançamento repetido é apontado (com as duas cópias)", repetido.byKind.duplicado === 1 && dup?.entries.length === 4 && dup.value === venda[0].debito + venda[1].debito, dup?.reason);
const apuracao = [
  { data: "2026-03-31", debito: 5000, credito: 0, historico: "APURAÇÃO DE RESULTADO EM 31.03.2026", linha_origem: "9101", classificacao: "9.1.1.01", demonstrativo: "DRE" },
  { data: "2026-03-31", debito: 5000, credito: 0, historico: "APURAÇÃO DE RESULTADO EM 31.03.2026", linha_origem: "9102", classificacao: "9.1.1.01", demonstrativo: "DRE" },
];
check("Apuração do resultado não conta como repetido", conferir([...journal, ...apuracao]).byKind.duplicado === 0, null);
const material = (dia, valor, linha) => ({ data: `2026-0${1 + (dia % 3)}-${String(10 + dia).padStart(2, "0")}`, debito: valor, credito: 0, historico: `MATERIAL DE ESCRITORIO ${linha}`, linha_origem: linha, classificacao: "9.3.4.01", descricao_conta: "MATERIAL DE ESCRITORIO", demonstrativo: "DRE" });
const comMaterial = [...journal, ...Array.from({ length: 10 }, (_, i) => material(i, 90 + i * 5, `95${i}`)), material(11, 5000, "9599")];
const fora = conferir(comMaterial).items.find((item) => item.kind === "valor");
check("Valor fora do padrão da conta (R$ 5.000 onde o normal é ~R$ 110)", fora?.value === 5000 && fora.level === "alta", fora?.reason);
const estorno = { data: "2026-03-15", debito: 0, credito: 20000, historico: "ESTORNO ALUGUEL", linha_origem: "9701", classificacao: "9.3.2.01", descricao_conta: "ALUGUEL", demonstrativo: "DRE" };
const invertido = conferir([...journal, estorno]).items.find((item) => item.kind === "sinal");
check("Despesa credora no mês = sinal invertido", invertido?.month === "2026-03" && invertido.value === 12000, invertido?.reason);
const marcado = conferir([...journal, estorno], { dismissed: [invertido.id] });
check("“Está certo” tira o aviso da lista", marcado.open === 0 && marcado.dismissed === 1 && marcado.items[0].dismissed, marcado.open);
const { journalStatsFromEntries } = await src("lib/carteira.js");
const resumo = journalStatsFromEntries([...journal, ...venda.map((entry) => ({ ...entry, linha_origem: "9001" }))], company.mappings).anomalias;
check("Saúde da carteira recebe o resumo dos 2 últimos meses", resumo?.from === "2026-02" && resumo.to === "2026-03" && resumo.open === 0, resumo);

// ── Projeção do fechamento do ano ──
section("Projeção do ano");
const { projectYear, projectionSentence } = await src("lib/projecao.js");
const { contextForPeriod } = await src("lib/assistant/context.js");
setCompanyState();
const anoCtx = contextForPeriod("2026-01-01", "2026-12-31");
const abril = new Date("2026-04-15T12:00:00");
const proj = projectYear({ ano: 2026, ctx: anoCtx, method: "media", lookback: 0, today: abril });
check("Meses fechados jan–mar, faltam abr–dez", proj.closed.join() === "2026-01,2026-02,2026-03" && proj.remaining.length === 9, proj.closed);
check("Receita bruta realizada = vendas do trimestre (300 mil)", near(proj.receita.realizado, 300000), proj.receita.realizado);
check("Média: ano = realizado + 9 × média (4× o trimestre)", near(proj.receita.provavel, 1200000) && near(proj.resultado.provavel, 4 * proj.resultado.realizado), [proj.receita.provavel, proj.resultado.provavel]);
check("Faixa: desvio mensal (10 mil) × √9 = ± 30 mil", near(proj.receita.otimista - proj.receita.provavel, 30000) && near(proj.receita.provavel - proj.receita.pessimista, 30000), proj.receita.margin);
check("Sem 2025 no razão: sazonalidade indisponível (e cai na média)", !proj.available.sazonal && projectYear({ ano: 2026, ctx: anoCtx, method: "sazonal", today: abril }).method === "media", proj.available);
const caixaMar = proj.caixa;
check("Caixa: saldo de março + variação média × 9", caixaMar && near(caixaMar.provavel, caixaMar.atual + caixaMar.mediaMensal * 9), caixaMar);
const orcProj = { ...budget.newBudget(2026), valores: { "DRE.01": Object.fromEntries(budget.yearMonths(2026).map((m) => [m, 200000])) } };
const pelaMeta = projectYear({ ano: 2026, ctx: anoCtx, budgets: [orcProj], method: "orcamento", today: abril });
check("Orçamento: realizado + orçado dos meses que faltam", pelaMeta.method === "orcamento" && near(pelaMeta.receita.provavel, 300000 + 9 * 200000) && near(pelaMeta.receita.orcado, 2400000), pelaMeta.receita.provavel);
const frase = projectionSentence(proj, { empresa: "A Exemplo" });
check("Frase pronta para o assistente", /^Se o ritmo do ano continuar, A Exemplo deve fechar 2026 com receita bruta de R\$ 1,2 mi e (lucro|prejuízo) de/.test(frase) && /caixa deve terminar o ano/.test(frase), frase);
const janeiro = projectYear({ ano: 2026, ctx: anoCtx, budgets: [orcProj], method: "media", today: new Date("2026-01-10T12:00:00") });
check("Sem mês fechado: só o orçamento projeta o ano", !janeiro.available.media && janeiro.method === "orcamento" && near(janeiro.receita.provavel, 2400000), janeiro.method);

// ── Metas dos indicadores por empresa ──
section("Metas dos indicadores");
const { goalsOf, parseGoalInput, cleanGoals } = await src("lib/metas.js");
const padrao = goalsOf(company);
check("Sem metas: vale a régua padrão (margem 3%, liquidez 1, endividamento 2x, prazo 60 dias)", padrao.margemLiquida.value === 3 && padrao.liquidezCorrente.value === 1 && padrao.endividamento.value === 2 && padrao.pmr.value === 60 && !padrao.pmr.custom, padrao);
check("Lê o que a pessoa digita (\"1,2\", \"15%\", vazio)", parseGoalInput("1,2") === 1.2 && parseGoalInput("15%") === 15 && parseGoalInput(" ") === null && JSON.stringify(cleanGoals({ pmr: "45", margemLiquida: "" })) === '{"pmr":45}', null);
const comMeta = (metasIndicadores) => {
  state.companies = [{ ...company, metasIndicadores }];
  const result = analyze(buildDashboardContext(), { period: PERIOD, label: "1º tri" });
  state.companies = [company];
  return result;
};
setCompanyState();
const semMeta = analyze(buildDashboardContext(), { period: PERIOD, label: "1º tri" });
const liq = semMeta.facts.liquidezCorrente;
check(`Liquidez da empresa-exemplo (${liq?.toFixed(2)}) não dispara alerta pela régua padrão`, liq >= 1 && !semMeta.alerts.some((item) => item.id === "liquidez_baixa"), liq);
const exigente = comMeta({ liquidezCorrente: Math.ceil((liq + 0.5) * 10) / 10 });
const alertaMeta = exigente.alerts.find((item) => item.id === "liquidez_baixa");
check("Meta de liquidez acima do realizado → alerta pela meta da empresa", alertaMeta?.title === "Liquidez abaixo da meta" && /a meta da empresa é/.test(alertaMeta.text), alertaMeta);
const folgada = comMeta({ liquidezCorrente: Math.floor((liq - 0.2) * 10) / 10, margemLiquida: -50 });
check("Metas cumpridas → ponto positivo \"dentro das metas\"", folgada.positives.some((item) => item.id === "metas_ok") && !folgada.alerts.some((item) => item.id === "liquidez_baixa"), folgada.positives.map((item) => item.id));
state.companies = [{ ...company, metasIndicadores: { liquidezCorrente: Math.ceil((liq + 0.5) * 10) / 10 } }];
const radar = buildDashboardContext().radarIndicators.find((item) => item.indicator === "Liquidez corrente");
state.companies = [company];
check("Radar: a meta fica a 60% do raio (contorno tracejado)", Math.abs(radar.ref - 60) < 0.01 && radar.meta != null && radar.score < 60, radar);

// ── PowerPoint ──
section("PowerPoint");
const pptxLib = await src("lib/slidesPptx.js");
check("Cores do slide viram cor do PowerPoint (transparente fica de fora)", pptxLib.hexColor("rgb(255, 102, 0)") === "FF6600" && pptxLib.hexColor("rgba(0, 0, 0, 0)") === null && pptxLib.hexColor("#abc") === "AABBCC", null);
check("Fonte: primeira da lista, sem o \"Variable\"", pptxLib.firstFont('"Fraunces Variable", Georgia, serif') === "Fraunces" && pptxLib.firstFont("") === "Calibri", null);
const paras = pptxLib.paragraphs([{ runs: [{ text: "Receita " }, { text: "subiu", bold: true }] }, { runs: [] }, { runs: [{ text: "fim" }] }], { list: "bullet", uppercase: true }, { fontSize: 12 });
check("Texto: um parágrafo por linha, negrito e marcador mantidos", paras.length === 4 && paras[1].options.bold && paras[1].options.breakLine && paras[0].options.bullet === true && !paras[2].options.bullet && paras[3].text === "FIM" && !paras[3].options.breakLine, paras);

// ── Comentários nos números ──
section("Comentários nos números");
const coment = await src("lib/comentarios.js");
check("Assunto do slide pela linha (aluguel → despesas, salários → pessoal, bancos → caixa)", coment.topicForCode("DRE.07.02.01.01") === "despesas" && coment.topicForCode("DRE.07.01.01") === "pessoal" && coment.topicForCode("01.01.01.02.01") === "caixa" && coment.topicForCode("DRE.17") === "resultado", null);
const notas = [
  { id: "c1", code: "DRE.07.02.01.01", month: "2026-02", text: "Reajuste do aluguel em fevereiro", author: "a@b", createdAt: "2026-03-01T10:00:00Z" },
  { id: "c2", code: "DRE.01.01.01.02", month: "2025-12", text: "Fora do período", author: "a@b", createdAt: "2026-01-05T10:00:00Z" },
];
check("Comentário da linha de baixo aparece na de cima (aluguel → despesas administrativas)", coment.commentsFor(notas, "DRE.07", ["2026-01", "2026-02", "2026-03"]).length === 1 && coment.commentsFor(notas, "DRE.07.02", null).length === 1 && coment.commentsFor(notas, "DRE.01", ["2026-02"]).length === 0, null);
check("Card do B.I.: comentários pelas linhas da fórmula", coment.formulaComments({ numerator: [{ code: "DRE.07", sign: 1 }] }, ["2026-02"], notas).length === 1, null);
check("Comentário sem mês válido ou sem texto não grava", coment.addComment({ code: "DRE.07", month: "fev", text: "x" }) === null && coment.addComment({ code: "DRE.07", month: "2026-02", text: "  " }) === null, null);
setCompanyState();
state.companies = [{ ...company, comentarios: notas }];
const comAnalise = analyze(buildDashboardContext(), { period: PERIOD, label: "1º tri" });
state.companies = [company];
const despesasBullets = comAnalise.sections.despesas.bullets;
check("Assistente: o comentário vira observação no slide de despesas", /^Observação — aluguel predial, fevereiro\/2026: Reajuste do aluguel/i.test(despesasBullets[0]), despesasBullets[0]);
check("…e entra na visão geral (anotações); o de fora do período não", comAnalise.sections.visao.bullets.some((item) => /Reajuste do aluguel/.test(item)) && comAnalise.facts.comentarios.length === 1, comAnalise.facts.comentarios);

console.log(`\n${total - failures} de ${total} testes passaram.`);
if (failures) {
  console.log(`${failures} FALHA(S).`);
  process.exit(1);
}
