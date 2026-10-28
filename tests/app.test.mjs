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
check(`Resultado financeiro (${expected.financeiro})`, near(value(ctx.dre, "DRE.14"), expected.financeiro), value(ctx.dre, "DRE.14"));
check(`Lucro líquido (${expected.lucro})`, near(value(ctx.dre, "DRE.18"), expected.lucro), value(ctx.dre, "DRE.18"));
const formulas = [
  ["DRE.03", ["DRE.01", "DRE.02"]],
  ["DRE.05", ["DRE.03", "DRE.04"]],
  ["DRE.11", ["DRE.05", "DRE.06", "DRE.07", "DRE.08", "DRE.10"]],
  ["DRE.13", ["DRE.11", "DRE.12"]],
  ["DRE.16", ["DRE.13", "DRE.14", "DRE.15"]],
  ["DRE.18", ["DRE.16", "DRE.17"]],
];
formulas.forEach(([target, parts]) => {
  const sum = parts.reduce((acc, code) => acc + value(ctx.dre, code), 0);
  check(`${target} = ${parts.join(" + ")}`, near(value(ctx.dre, target), sum), { target: value(ctx.dre, target), sum });
});
check(`EBITDA = lucro operacional + depreciação (${expected.depreciacao})`, near(ctx.ebitda, value(ctx.dre, "DRE.13") + expected.depreciacao), { ebitda: ctx.ebitda, dre12: value(ctx.dre, "DRE.13") });

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
check("Assunto do slide pela linha (aluguel → despesas, salários → pessoal, bancos → caixa)", coment.topicForCode("DRE.07.02.01.01") === "despesas" && coment.topicForCode("DRE.07.01.01") === "pessoal" && coment.topicForCode("01.01.01.02.01") === "caixa" && coment.topicForCode("DRE.18") === "resultado", null);
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

// ── Metas nos cards do B.I. ──
section("Metas nos cards");
const { cardGoal, goalsOf: goalsDe } = await src("lib/metas.js");
const metasEmpresa = goalsDe({ metasIndicadores: { liquidezCorrente: 1.2, pmr: 45 } });
const cardLiq = cardGoal("ratio_liquidez_corrente", 0.7, metasEmpresa);
const cardPmr = cardGoal("prazo_recebimento", 30, metasEmpresa);
check("Card de liquidez: fora da meta ≥ 1,2x", cardLiq?.label === "meta ≥ 1,2x" && cardLiq.ok === false, cardLiq);
check("Card de prazo: dentro da meta ≤ 45 dias", cardPmr?.label === "meta ≤ 45 dias" && cardPmr.ok === true, cardPmr);
check("Sem meta própria (só o padrão), o card não muda", cardGoal("ratio_margem_liquida", 2, metasEmpresa) === null && cardGoal("ratio_roe", 5, metasEmpresa) === null, null);

// ── Grupo = soma das empresas ──
// Duas cópias da empresa-exemplo num grupo; a segunda tem um Vínculo DFC
// próprio. Cada linha da DFC do grupo tem que ser a soma do que cada empresa
// mostra aberta sozinha (antes o grupo ignorava o vínculo da empresa).
section("Grupo = soma das empresas");
const { buildDfcDirect, buildReportTree: arvore, codigoDeExibicao } = await src("data/calculations.js");
setCompanyState();
const primeiraConta = buildDfcDirect().find((item) => item.codigo_gerencial === "DFC.OP.CLIENTES")?.contas?.[0];
const vinculo = { codigo_gerencial: primeiraConta?.codigo, destino: "DFC.OP.OUTROS" };
const empresaB = { ...company, id: "emp_teste_b", name: "Empresa B", dfcOverrides: [vinculo] };
const dfcPorLinha = (rows) => new Map(rows.map((item) => [item.codigo_gerencial, Number(item.saldo || 0)]));
const dfcA = dfcPorLinha(buildDfcDirect());
setCompanyState();
Object.assign(state, { companies: [company, empresaB], activeCompanyId: empresaB.id, dfcOverrides: empresaB.dfcOverrides });
const dfcB = dfcPorLinha(buildDfcDirect());
const ns = (empresa, codigo) => `${empresa.id}::${codigo}`;
const membro = (empresa) => ({
  accounts: empresa.accounts.map((conta) => ({ ...conta, classificacao: ns(empresa, conta.classificacao), companyId: empresa.id, companyName: empresa.name })),
  mappings: empresa.mappings.map((m) => ({ ...m, classificacao: ns(empresa, m.classificacao) })),
  journal: journal.map((entry) => ({ ...entry, classificacao: ns(empresa, entry.classificacao), companyId: empresa.id, companyName: empresa.name })),
});
const [mA, mB] = [membro(company), membro(empresaB)];
Object.assign(state, {
  groups: [{ id: "grp_teste", name: "Grupo teste", companyIds: [company.id, empresaB.id] }],
  activeGroupId: "grp_teste",
  activeCompanyId: "",
  accounts: [...mA.accounts, ...mB.accounts],
  mappings: [...mA.mappings, ...mB.mappings],
  journal: [...mA.journal, ...mB.journal],
  // Sobra de uma empresa aberta antes — o grupo não pode usar.
  dfcOverrides: [{ codigo_gerencial: primeiraConta?.codigo, destino: "DFC.FIN.CAPITAL" }],
});
const dfcGrupo = buildDfcDirect();
const divergentes = dfcGrupo
  .filter((item) => !near(item.saldo, (dfcA.get(item.codigo_gerencial) || 0) + (dfcB.get(item.codigo_gerencial) || 0)))
  .map((item) => ({ linha: item.codigo_gerencial, grupo: item.saldo, soma: (dfcA.get(item.codigo_gerencial) || 0) + (dfcB.get(item.codigo_gerencial) || 0) }));
check("O vínculo DFC da empresa B muda a DFC dela (teste válido)", Boolean(primeiraConta) && !near(dfcA.get("DFC.OP.OUTROS"), dfcB.get("DFC.OP.OUTROS")), { a: dfcA.get("DFC.OP.OUTROS"), b: dfcB.get("DFC.OP.OUTROS") });
check("DFC do grupo = soma das DFCs de cada empresa, linha a linha", divergentes.length === 0, divergentes.slice(0, 3));
const bpGrupo = arvore("BP");
check("Balanço do grupo = 2× o da empresa (ativo)", near(value(bpGrupo, "01"), 2 * expected.ativo), value(bpGrupo, "01"));
check("Código na tela sem o id da empresa", codigoDeExibicao([ns(company, "1.1.20.400.1"), ns(empresaB, "1.1.20.400.1")]) === "1.1.20.400.1" && codigoDeExibicao("1.1.10") === "1.1.10", codigoDeExibicao([ns(company, "1.1.20.400.1")]));
// A empresa B tem um balancete guardado do ano do período (balancetesAno,
// aqui com os saldos em dobro): aberta sozinha ela usa ele — o grupo também.
const ano = PERIOD.start.slice(0, 4);
const dobro = (conta) => ({ ...conta, saldo_anterior: 2 * conta.saldo_anterior, debito: 2 * conta.debito, credito: 2 * conta.credito, saldo_atual: 2 * conta.saldo_atual });
const empresaBAno = { ...empresaB, balancetesAno: { [ano]: { accounts: company.accounts.map(dobro), meta: company.lastBalanceteMeta } } };
const gruposTeste = state.groups;
setCompanyState();
Object.assign(state, { companies: [company, empresaBAno], activeCompanyId: empresaBAno.id });
const ativoB = value(arvore("BP"), "01");
Object.assign(state, {
  companies: [company, empresaBAno],
  groups: gruposTeste,
  activeGroupId: "grp_teste",
  activeCompanyId: "",
  accounts: [...mA.accounts, ...mB.accounts],
  mappings: [...mA.mappings, ...mB.mappings],
  journal: [...mA.journal, ...mB.journal],
});
const ativoGrupo = value(arvore("BP"), "01");
check("Balancete do ano: a empresa B usa o dela (ativo em dobro)", near(ativoB, 2 * expected.ativo), ativoB);
check("…e o grupo também: ativo do grupo = A + B", near(ativoGrupo, expected.ativo + ativoB), { grupo: ativoGrupo, soma: expected.ativo + ativoB });
// Aba do Painel com só o cartão "EBITDA": o "Consolidado + Individual" do
// grupo baixa o EBITDA consolidado e o de cada empresa.
const { buildTableWidgetExport } = await src("lib/dashboardExport.js");
const { buildPerCompanyReports } = await src("lib/groupExport.js");
const { moneyOrDash } = await src("lib/format.js");
const ebitdaDe = (relatorio) => relatorio?.rows.find((linha) => linha.codigo === "DEX.10")?.cells;
setCompanyState();
const ebitdaEmpresa = buildDashboardContext().ebitda;
Object.assign(state, {
  companies: [{ ...company, journal }, { ...empresaB, journal }],
  groups: gruposTeste,
  activeGroupId: "grp_teste",
  activeCompanyId: "",
  accounts: [...mA.accounts, ...mB.accounts],
  mappings: [...mA.mappings, ...mB.mappings],
  journal: [...mA.journal, ...mB.journal],
  reportCompare: false,
});
const ebitdaConsolidado = buildTableWidgetExport("executiva");
const ebitdaPorEmpresa = buildPerCompanyReports(gruposTeste[0], () => buildTableWidgetExport("executiva"));
const razaoDoGrupo = state.journal.length;
Object.assign(state, { reportCompare: true });
const ebitdaMensal = buildTableWidgetExport("executiva");
check(
  "Consolidado + Individual na aba EBITDA do Painel: grupo = 2× cada empresa, uma por empresa, mesmas colunas do cartão",
  ebitdaConsolidado?.reportName === "EBITDA" &&
    ebitdaDe(ebitdaConsolidado)?.saldo === moneyOrDash(2 * ebitdaEmpresa) &&
    ebitdaPorEmpresa.length === 2 &&
    ebitdaPorEmpresa.every(({ data }) => ebitdaDe(data)?.saldo === moneyOrDash(ebitdaEmpresa)) &&
    ebitdaPorEmpresa[1].data.companyName === "Empresa B" &&
    state.journal.length === razaoDoGrupo &&
    ebitdaMensal.columns.some((coluna) => /^\d{4}-\d{2}$/.test(coluna.key)),
  { consolidado: ebitdaDe(ebitdaConsolidado), empresa: moneyOrDash(ebitdaEmpresa), porEmpresa: ebitdaPorEmpresa.map(({ data }) => ebitdaDe(data)?.saldo), colunas: ebitdaMensal.columns.map((coluna) => coluna.key) }
);
setCompanyState();

// ── Razão no formato compacto ──
// A parte gravada no banco ficou ~6x menor; ler de volta tem que dar
// exatamente os mesmos lançamentos que o JSON de antes daria.
section("Razão compacto");
const { codificarParte, decodificarParte } = await src("lib/razaoCompacto.js");
const ordenado = (valor) => JSON.stringify(valor, (chave, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
const viaJson = (lista) => JSON.parse(JSON.stringify(lista));
const compacto = codificarParte(journal);
const devolta = decodificarParte(JSON.parse(JSON.stringify(compacto)));
check(`Razão da empresa-exemplo volta igual (${journal.length} lançamentos)`, ordenado(devolta) === ordenado(viaJson(journal)), devolta?.[0]);
check("…e ocupa bem menos", JSON.stringify(compacto).length < JSON.stringify(journal).length * 0.6, { compacto: JSON.stringify(compacto).length, antes: JSON.stringify(journal).length });
const estranhos = [
  { data: "2026-01-02", historico: "Ação ç ñ 😀", debito: 0, credito: -1.5, extra: null },
  { data: "2026-01-02", historico: "Ação ç ñ 😀", debito: 10, credito: 0 },
  { historico: "sem data", debito: 1e-7, credito: 3, valor: "texto", objeto: { a: [1, 2] }, indefinido: undefined },
  { data: "2026-01-03", historico: "", debito: 2, credito: 2, valor: 5 },
];
check("Campos faltando, null, número/texto misturados, objeto, unicode", ordenado(decodificarParte(viaJson(codificarParte(estranhos)))) === ordenado(viaJson(estranhos)), decodificarParte(viaJson(codificarParte(estranhos))));
check("Parte vazia e formato antigo (array) passam direto", decodificarParte(codificarParte([])).length === 0 && decodificarParte(estranhos) === estranhos, null);
check("Parte inválida → null (vira 'razão incompleto', nunca razão menor)", decodificarParte({ foo: 1 }) === null && decodificarParte(null) === null && decodificarParte({ ...codificarParte(estranhos), linhas: [[99]] }) === null, null);

// ── Cliente (só leitura) não vê "alteração não salva" ──
// Cliente troca período/abas e muda de tela — nada disso é gravado, e não é erro.
section("Cliente só leitura");
const { persistActiveCompany } = await src("lib/companies.js");
setCompanyState();
Object.assign(state, { isAdmin: false, isColaborador: false, userEmail: "cliente@exemplo.com", saveError: null, periodStart: "2026-02-01" });
let rejeitou = false;
await persistActiveCompany().catch(() => {
  rejeitou = true;
});
check("Empresa: cliente mexe no período e troca de tela → nada de erro", !rejeitou && state.saveError === null, state.saveError);
Object.assign(state, { activeGroupId: "grp_x", groups: [{ id: "grp_x", name: "Grupo X", companyIds: [COMPANY_ID] }], saveError: null });
rejeitou = false;
await persistActiveCompany().catch(() => {
  rejeitou = true;
});
check("Grupo: idem", !rejeitou && state.saveError === null, state.saveError);
Object.assign(state, { isAdmin: true, saveError: null });
setCompanyState();

// ── Módulos que o cliente vê (Parâmetros › Acessos) ──
section("Módulos por pessoa");
const { modulosLiberados, moduloDaRota, MODULOS_COMPLEMENTARES } = await src("lib/modulos.js");
check(
  "Equipe vê todos os módulos",
  MODULOS_COMPLEMENTARES.length >= 4 &&
    modulosLiberados({ isAdmin: true }).length === MODULOS_COMPLEMENTARES.length &&
    modulosLiberados({ isColaborador: true }).length === MODULOS_COMPLEMENTARES.length,
  modulosLiberados({ isAdmin: true })
);
check("Cliente sem ficha (ou ainda carregando) → só o B.I., sem menu", modulosLiberados({ modulosCliente: null }).length === 0 && modulosLiberados({ modulosCliente: [] }).length === 0, null);
check("Cliente vê só o que foi liberado (e ignora lixo)", JSON.stringify(modulosLiberados({ modulosCliente: ["carga-tributaria", "xyz"] })) === JSON.stringify(["carga-tributaria"]), modulosLiberados({ modulosCliente: ["carga-tributaria", "xyz"] }));
check("Rota → módulo (B.I. e outras telas = nenhum)", moduloDaRota("/empresa/orcamento") === "orcamento" && moduloDaRota("/empresa/analise-desempenho/x") === "analise-desempenho" && moduloDaRota("/empresa") === null && moduloDaRota("/empresa/dre") === null, null);

// ── Resumo no celular configurável (lib/resumoCelular.js) ──
section("Resumo do celular configurável");
const rc = await src("lib/resumoCelular.js");
const resumoPadrao = rc.configResumo(null);
check("Sem configuração = o resumo de sempre (e grava null)", JSON.stringify(resumoPadrao) === JSON.stringify(rc.PADRAO) && rc.paraGravar(resumoPadrao) === null, resumoPadrao);
const reordenado = rc.configResumo({ ordem: ["apresentacao", "resultado", "xyz"], numeros: ["margem", "nada", "receita"], maxAlertas: 99 });
check(
  "Ordem salva vale, bloco que faltava volta, lixo sai",
  reordenado.ordem.length === rc.BLOCOS.length && reordenado.ordem.indexOf("apresentacao") < reordenado.ordem.indexOf("resultado") && !reordenado.ordem.includes("xyz") && JSON.stringify(reordenado.numeros) === JSON.stringify(["margem", "receita"]) && reordenado.maxAlertas === 6,
  reordenado
);
check("Recado só aparece com texto; bloco escondido some", !rc.blocosVisiveis(resumoPadrao).includes("recado") && rc.blocosVisiveis(rc.configResumo({ recado: "Reunião dia 10", ocultos: ["caixa"] })).join() === rc.PADRAO.ordem.filter((id) => id !== "caixa").join(), null);
const analiseFake = {
  alerts: [
    { id: "sem_depara", severity: 2 },
    { id: "prejuizo", severity: 3 },
    { id: "cmp_lucro", severity: 2 },
    { id: "caixa_caiu", severity: 2 },
    { id: "receita_concentrada", severity: 1 },
  ],
  positives: [{ id: "caixa_subiu" }, { id: "liquidez" }, { id: "roe" }],
};
const doCliente = rc.alertasDoResumo(analiseFake, resumoPadrao, { equipe: false });
const daEquipe = rc.alertasDoResumo(analiseFake, resumoPadrao, { equipe: true });
check("Cliente não vê alerta de conferência (De/Para); equipe vê, marcado", !doCliente.alertas.some((a) => a.id === "sem_depara") && daEquipe.alertas.some((a) => a.id === "sem_depara" && a.soEquipe), { doCliente, daEquipe });
check("Mais grave primeiro, no máximo 3, 2 positivos", doCliente.alertas.length === 3 && doCliente.alertas[0].id === "prejuizo" && doCliente.positivos.length === 2, doCliente);
const escondendo = rc.alertasDoResumo(analiseFake, rc.configResumo({ alertasOcultos: ["comparativo", "prejuizo"], positivos: false, maxAlertas: 5 }), { equipe: false });
check("Tipos escondidos (cmp_* = comparativo) e sem positivos", escondendo.alertas.map((a) => a.id).join() === "caixa_caiu,receita_concentrada" && escondendo.positivos.length === 0, escondendo);
const idsDosAlertas = [...fs.readFileSync(path.join(ROOT, "src/lib/assistant/analysis.js"), "utf8").matchAll(/add\("([a-z_]+)", "[A-Za-z]+", \d/g)].map((m) => m[1]);
const semTipo = idsDosAlertas.filter((id) => !rc.ALERTAS.some((item) => item.id === rc.tipoDoAlerta(id)));
const lista = rc.analisesDoPeriodo(analiseFake, rc.configResumo({ alertasOcultos: ["caixa_caiu"] }));
check(
  "Painel lista TODAS as análises do período, com o motivo de cada uma que não aparece",
  lista.alertas.length === 5 && lista.alertas.find((a) => a.id === "caixa_caiu").marcado === false && lista.alertas.find((a) => a.id === "sem_depara").motivo === "só a equipe vê" && lista.positivos.find((p) => p.id === "roe").motivo.startsWith("não cabe") && lista.positivos.filter((p) => p.aparece).length === 2,
  lista
);
const idsPositivos = [...fs.readFileSync(path.join(ROOT, "src/lib/assistant/analysis.js"), "utf8").matchAll(/add\("([a-z_]+)", "[A-Za-z]+", [`"]/g)].map((m) => m[1]);
const positivoSemTipo = idsPositivos.filter((id) => !rc.POSITIVOS.some((item) => item.id === rc.tipoDoPositivo(id)));
check("Todo ponto positivo do assistente tem um tipo escolhível", idsPositivos.length > 15 && positivoSemTipo.length === 0, positivoSemTipo);
check("Todo alerta do assistente tem um tipo escolhível na configuração", idsDosAlertas.length > 20 && semTipo.length === 0, semTipo);
setCompanyState();
Object.assign(state, { isAdmin: true, resumoCelular: rc.paraGravar(rc.configResumo({ recado: "Oi", numeros: ["caixa"] })) });
await persistActiveCompany().catch(() => null);
const gravada = state.companies.find((item) => item.id === COMPANY_ID);
check("A configuração vai junto com a empresa ao gravar", gravada?.resumoCelular?.recado === "Oi" && JSON.stringify(gravada.resumoCelular.numeros) === '["caixa"]', gravada?.resumoCelular);
Object.assign(state, { resumoCelular: null });
setCompanyState();

// Replicar a configuração pra outras empresas: tudo vai, menos o recado
// (a não ser que peçam); a empresa ativa não é tocada.
const origem = rc.configResumo({ recado: "Recado da origem", alertasOcultos: ["prejuizo"], numeros: ["caixa", "margem"], maxAlertas: 5 });
const semRecado = rc.configParaReplicar(origem, { recado: "Recado do destino" });
const comRecado = rc.configParaReplicar(origem, { recado: "Recado do destino" }, { levarRecado: true });
check("Replicar leva análises/números e mantém o recado do destino (ou leva, se pedir)", semRecado.recado === "Recado do destino" && JSON.stringify(semRecado.alertasOcultos) === '["prejuizo"]' && semRecado.maxAlertas === 5 && comRecado.recado === "Recado da origem", { semRecado, comRecado });
const { applyResumoCelularToCompanies } = await src("lib/companies.js");
setCompanyState();
const outra = { ...company, id: "cmp_outra", name: "OUTRA", journalLoaded: false, resumoCelular: { recado: "Só dela" } };
Object.assign(state, { isAdmin: true, companies: [company, outra] });
const aplicadas = await applyResumoCelularToCompanies((atual) => rc.configParaReplicar(origem, atual), [COMPANY_ID, "cmp_outra"]).catch((error) => error);
const outraDepois = state.companies.find((item) => item.id === "cmp_outra");
check("Aplica só nas outras (a ativa fica de fora) e grava", aplicadas === 1 && outraDepois.resumoCelular.recado === "Só dela" && outraDepois.resumoCelular.maxAlertas === 5 && !state.companies.find((item) => item.id === COMPANY_ID).resumoCelular, { aplicadas, outraDepois: outraDepois.resumoCelular });
setCompanyState();

// ── Início (Landing.jsx): saudação, números do cartão do cliente, recentes ──
section("Início");
const inicio = await src("lib/inicio.js");
const rec = await src("lib/recentes.js");
check("Saudação pela hora e primeiro nome", inicio.saudacao(new Date(2026, 0, 1, 9)) === "Bom dia" && inicio.saudacao(new Date(2026, 0, 1, 15)) === "Boa tarde" && inicio.saudacao(new Date(2026, 0, 1, 21)) === "Boa noite" && inicio.primeiroNome("MARIA souza") === "Maria" && inicio.primeiroNome("") === "", null);
setCompanyState();
const antes = { id: state.activeCompanyId, journal: state.journal, periodStart: state.periodStart };
const nums = inicio.numerosDaEmpresa({ ...company, journal, journalLoaded: true });
check(
  "Cartão do cliente: lucro e receita do último mês e do ano (iguais ao B.I.)",
  nums && nums.mes === "2026-03" && Math.abs(nums.lucroAno - expected.lucro) < 0.01 && Math.abs(nums.receitaAno - expected.receitaLiquida) < 0.01 && Math.abs(nums.lucroMes) > 0,
  nums
);
check("Calcular o cartão não mexe na empresa aberta", state.activeCompanyId === antes.id && state.journal === antes.journal && state.periodStart === antes.periodStart, null);
check("Sem razão carregado → sem números (não inventa zero)", inicio.numerosDaEmpresa({ ...company, journalLoaded: false }) === null, null);
localStorage.removeItem("athosbi.recentes.v1");
rec.lembrarRecente({ tipo: "empresa", id: "a" });
rec.lembrarRecente({ tipo: "grupo", id: "g" });
rec.lembrarRecente({ tipo: "empresa", id: "a" });
check("Abertas por último: a mais recente primeiro, sem repetir", rec.recentes().map((item) => `${item.tipo}:${item.id}`).join() === "empresa:a,grupo:g", rec.recentes());

// ── Fechamento: o cliente só vê até o mês fechado (lib/fechamento.js) ──
section("Fechamento");
const fch = await src("lib/fechamento.js");
const { dataMonths: mesesComDados } = await src("lib/assistant/context.js");
const hojeTeste = new Date(2026, 9, 27); // 27/10/2026
check("Sem fechamento marcado = mês anterior ao atual (o mês corrente nunca aparece)", fch.mesFechadoDa({}, hojeTeste) === "2026-09" && fch.mesFechadoDa({ fechadoAte: "2026-08" }, hojeTeste) === "2026-08", null);
check(
  "Período cortado no mês fechado",
  JSON.stringify(fch.limitarPeriodo({ start: "2026-01-01", end: "2026-10-31" }, "2026-09")) === JSON.stringify({ start: "2026-01-01", end: "2026-09-30" }) &&
    JSON.stringify(fch.limitarPeriodo({ start: "2026-10-01", end: "2026-10-31" }, "2026-09")) === JSON.stringify({ start: "2026-09-01", end: "2026-09-30" }) &&
    JSON.stringify(fch.limitarPeriodo({ start: "2026-01-01", end: "2026-03-31" }, "2026-09")) === JSON.stringify({ start: "2026-01-01", end: "2026-03-31" }),
  null
);
setCompanyState();
Object.assign(state, { isAdmin: false, isColaborador: false, companies: [{ ...company, fechadoAte: "2026-02" }] });
const mesesCliente = mesesComDados();
Object.assign(state, { isAdmin: true });
const mesesEquipe = mesesComDados();
check("Cliente não vê os meses depois do fechamento; a equipe vê todos", mesesCliente.join() === "2026-01,2026-02" && mesesEquipe.includes("2026-03"), { mesesCliente, mesesEquipe });
check("Equipe não tem limite", fch.limiteDoCliente({ isAdmin: true }) === null && fch.limiteDoCliente({ isColaborador: true }) === null, null);
const grupoFch = { isAdmin: false, activeGroupId: "g", groups: [{ id: "g", companyIds: ["a", "b"] }], companies: [{ id: "a", fechadoAte: "2026-09" }, { id: "b", fechadoAte: "2026-07" }] };
check("Grupo: vale o fechamento mais atrasado das empresas", fch.limiteDoCliente(grupoFch, hojeTeste) === "2026-07", null);
const numsFechados = inicio.numerosDaEmpresa({ ...company, journal, journalLoaded: true }, { ate: "2026-02" });
setCompanyState();
const antesResumo = { id: state.activeCompanyId, journal: state.journal, periodStart: state.periodStart, orcamentos: state.orcamentos };
const resumoInicio = inicio.resumoDaEmpresa({ ...company, journal, journalLoaded: true }, { ate: "2026-03" });
check(
  "Início do cliente: resumo do celular do mês fechado (análise, comparação com o mês anterior)",
  resumoInicio && resumoInicio.mes === "2026-03" && resumoInicio.analysis?.facts && resumoInicio.analysis.comparison?.lucro && resumoInicio.prevLabel !== "" && Math.abs(resumoInicio.lucroAno - expected.lucro) < 0.01,
  resumoInicio && { mes: resumoInicio.mes, prevLabel: resumoInicio.prevLabel }
);
check("Montar o resumo não mexe na empresa aberta", state.activeCompanyId === antesResumo.id && state.journal === antesResumo.journal && state.periodStart === antesResumo.periodStart && state.orcamentos === antesResumo.orcamentos, null);
check("Cartão do Início para no mês fechado (fev)", numsFechados.mes === "2026-02" && numsFechados.lucroAno < expected.lucro && numsFechados.receitaAno < expected.receitaLiquida, numsFechados);
setCompanyState();

// ── Apresentações liberadas pro cliente ──
section("Apresentações liberadas");
const pres = await src("lib/presentations.js");
setCompanyState();
Object.assign(state, { isAdmin: true, presentations: [{ id: "p1", name: "A", slides: [], liberada: true }, { id: "p2", name: "B", slides: [] }] });
check("Cliente só vê as liberadas; equipe vê todas", pres.apresentacoesVisiveis(state.presentations, { isAdmin: false }).map((d) => d.id).join() === "p1" && pres.apresentacoesVisiveis(state.presentations, { isColaborador: true }).length === 2, null);
await pres.liberarApresentacao("p2", true).catch(() => null);
const liberou = state.presentations.find((d) => d.id === "p2")?.liberada === true;
await pres.liberarApresentacao("p1", false).catch(() => null);
check("Liberar e tirar do cliente", liberou && state.presentations.find((d) => d.id === "p1")?.liberada === false, state.presentations);
const copia = pres.duplicatePresentation("p2");
check("Cópia começa só da equipe", copia && copia.liberada === false && pres.deckCopyForOtherWorkspace(state.presentations[1]).liberada === false, copia);
Object.assign(state, { presentations: [] });
setCompanyState();

// ── Explicação ao clicar num item do Início (lib/glossario.js) ──
section("Explicações do Início");
const glo = await src("lib/glossario.js");
const semExplicacao = rc.NUMEROS.map((n) => n.id).filter((id) => !glo.GLOSSARIO[id]?.oque);
check("Todo quadrinho do resumo tem explicação", semExplicacao.length === 0, semExplicacao);
const fonteAnalise = fs.readFileSync(path.join(ROOT, "src/lib/assistant/analysis.js"), "utf8");
const assuntos = [...new Set([...fonteAnalise.matchAll(/add\("[a-z_]+", "([A-Za-z]+)", /g)].map((m) => m[1]))];
const assuntosSem = assuntos.filter((topic) => topic !== "balanco" && !glo.explicacaoDoAssunto(topic));
check("Todo assunto de alerta/positivo que o cliente vê tem explicação", assuntos.length > 10 && assuntosSem.length === 0, assuntosSem);
setCompanyState();
const antesSerie = { id: state.activeCompanyId, journal: state.journal, periodStart: state.periodStart };
const empresaSerie = { ...company, journal, journalLoaded: true };
const mesesSerie = inicio.mesesComDados(empresaSerie, { ate: "2026-02" });
check("Evolução: só os meses até o fechamento", mesesSerie.join() === "2026-01,2026-02", mesesSerie);
const serieReceita = inicio.serieDoItem(empresaSerie, "receita", { inicio: "2026-01", fim: "2026-03" });
const serieDespesas = inicio.serieDoItem(empresaSerie, "despesas", { inicio: "2026-01", fim: "2026-03" });
const serieCaixa = inicio.serieDoItem(empresaSerie, "caixa", { inicio: "2026-01", fim: "2026-03" });
check("Evolução: a receita mês a mês soma a do trimestre", serieReceita.length === 3 && Math.abs(serieReceita.reduce((soma, ponto) => soma + ponto.valor, 0) - expected.receitaLiquida) < 0.01, serieReceita);
check("Evolução: despesas positivas e caixa do último mês igual ao balanço", serieDespesas.length === 3 && serieDespesas.every((ponto) => ponto.valor >= 0) && Math.abs(serieCaixa[2]?.valor - expected.caixa) < 0.01, { serieDespesas, serieCaixa });
check("Montar a evolução não mexe na empresa aberta", state.activeCompanyId === antesSerie.id && state.journal === antesSerie.journal && state.periodStart === antesSerie.periodStart, null);
const sm = await src("lib/serieMensal.js");
check(
  "Rótulos do gráfico de evolução",
  sm.valorCurto(24412) === "24,4 mil" && sm.valorCurto(197400) === "197 mil" && sm.valorCurto(1250000) === "1,3 mi" && sm.valorCurto(-850) === "-850" && sm.rotuloMes("2026-09") === "set/26" && sm.variacaoEntre(100, 110).texto === "+10,0%" && sm.variacaoEntre(20, 18.5, "percent").texto === "-1,5 p.p." && sm.variacaoEntre(0, 5) === null,
  null
);

// ── Comparativo dos Demonstrativos: variação do mais antigo pro mais recente ──
section("Comparativo");
const { variacaoDoComparativo } = await src("lib/assistant/context.js");
const bAnterior = variacaoDoComparativo(2166971.1, 2037469.39, { inicioA: "2026-07-01", inicioB: "2026-04-01" });
const bDepois = variacaoDoComparativo(2037469.39, 2166971.1, { inicioA: "2026-04-01", inicioB: "2026-07-01" });
check("Receita que cresceu fica positiva com o B antes ou depois do A", Math.abs(bAnterior.diff - 129501.71) < 0.01 && Math.abs(bDepois.diff - 129501.71) < 0.01 && Math.abs(bDepois.diffPct - bAnterior.diffPct) < 1e-9 && bDepois.diffPct > 6.3 && bDepois.diffPct < 6.4, { bAnterior, bDepois });
check("Despesa que cresceu (mais negativa) fica negativa com o B depois do A", variacaoDoComparativo(-114801.48, -121862.29, { inicioA: "2026-04-01", inicioB: "2026-07-01" }).diff < 0, null);

// ── Apresentações: período próprio de cada bloco com dados ──
section("Período por bloco nas apresentações");
const pdb = await src("lib/periodoDoBloco.js");
const json = (valor) => JSON.stringify(valor);
const tri = { start: "2026-07-01", end: "2026-09-30" };
check("Bloco sem período próprio usa o filtro da apresentação", json(pdb.periodoDoBloco(null, tri)) === json(tri) && json(pdb.periodoDoBloco({ tipo: "filtro" }, tri)) === json(tri), null);
check(
  "Último mês, no ano, últimos N meses e fixo (relativos ao fim do filtro)",
  json(pdb.periodoDoBloco({ tipo: "ultimoMes" }, tri)) === json({ start: "2026-09-01", end: "2026-09-30" }) &&
    json(pdb.periodoDoBloco({ tipo: "ano" }, tri)) === json({ start: "2026-01-01", end: "2026-09-30" }) &&
    json(pdb.periodoDoBloco({ tipo: "ultimos", meses: 6 }, tri)) === json({ start: "2026-04-01", end: "2026-09-30" }) &&
    json(pdb.periodoDoBloco({ tipo: "ultimos", meses: 12 }, tri)) === json({ start: "2025-10-01", end: "2026-09-30" }) &&
    json(pdb.periodoDoBloco({ tipo: "fixo", inicio: "2026-02", fim: "2026-01" }, tri)) === json({ start: "2026-01-01", end: "2026-02-28" }),
  null
);
const cmpTri = pdb.comparacaoDoBloco("anterior", tri);
const cmpSem = pdb.comparacaoDoBloco("anterior", { start: "2026-04-01", end: "2026-09-30" });
const cmpAno = pdb.comparacaoDoBloco("ano", tri);
const cmpMes = pdb.comparacaoDoBloco("mes", tri);
check(
  "Variação compara com o mesmo tamanho: trimestre × trimestre anterior, semestre × semestre anterior, ano anterior, último mês",
  json(cmpTri.base) === json({ start: "2026-04-01", end: "2026-06-30" }) && cmpTri.rotulo === "vs abr-jun/26" &&
    json(cmpSem.base) === json({ start: "2025-10-01", end: "2026-03-31" }) &&
    json(cmpAno.base) === json({ start: "2025-07-01", end: "2025-09-30" }) &&
    cmpMes.atual.start === "2026-09-01" && cmpMes.base.start === "2026-08-01" && cmpMes.base.end === "2026-08-31",
  { cmpTri, cmpSem, cmpAno, cmpMes }
);
const subiu = pdb.variacaoDoNumero(110, 100, "money");
const caiuPp = pdb.variacaoDoNumero(18, 20, "percent");
check("Variação em % e em p.p.; sem base, sem setinha", subiu.up && subiu.text === "10%" && !caiuPp.up && caiuPp.text === "2 p.p." && pdb.variacaoDoNumero(5, 0, "money") === null, { subiu, caiuPp });
setCompanyState();
Object.assign(state, { isAdmin: true });
const { contextForPeriod: ctxDoPeriodo } = await src("lib/assistant/context.js");
const { widgetDefinition: widgetDef } = await src("lib/presentations.js");
const envTri = { ctx: ctxDoPeriodo(PERIOD.start, PERIOD.end), info: { start: PERIOD.start, end: PERIOD.end } };
const envMarco = pdb.envDoBloco({ kind: "kpi", periodo: { tipo: "ultimoMes" } }, envTri);
const receitaDe = (env) => widgetDef("dre_receita_liquida").value(env.ctx).value;
const receitaMarco = inicio.serieDoItem({ ...company, journal, journalLoaded: true }, "receita", { inicio: "2026-01", fim: "2026-03" })[2]?.valor;
check(
  "Número com período próprio: só março, sem mexer no filtro",
  envMarco.info.start === "2026-03-01" && Math.abs(receitaDe(envMarco) - receitaMarco) < 0.01 && Math.abs(receitaDe(envTri) - expected.receitaLiquida) < 0.01 && state.periodStart === PERIOD.start && pdb.envDoBloco({ kind: "text", periodo: { tipo: "ultimoMes" } }, envTri) === envTri,
  { marco: receitaDe(envMarco), receitaMarco }
);
const ctxJan = ctxDoPeriodo("2026-01-01", "2026-01-31");
const ctxFev = ctxDoPeriodo("2026-02-01", "2026-02-28");
const defReceita = widgetDef("dre_receita_liquida");
const partesReceita = pdb.partesDaComparacao(defReceita, ctxFev, ctxJan);
const totalReceita = defReceita.value(ctxFev).value - defReceita.value(ctxJan).value;
const serieTri = pdb.serieDoNumero(defReceita, envTri.ctx);
check(
  "Comparação: o que mais mudou na receita líquida (receita bruta e deduções) fecha com a diferença; mês a mês do número",
  partesReceita.length === 2 && Math.abs(partesReceita.reduce((soma, parte) => soma + parte.diff, 0) - totalReceita) < 0.01 && serieTri.length === 3 && serieTri[0].mes === "2026-01" && pdb.serieDoNumero(defReceita, ctxJan).length === 1,
  { partesReceita, totalReceita }
);
const mesesEvo = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
check(
  "Evolução: últimos N meses até o fim do período, sem passar do primeiro mês com dado; acumulado soma os meses",
  json(pdb.periodoDaEvolucao(mesesEvo, "2026-03-31", 3)) === json({ start: "2026-01-01", end: "2026-03-31" }) &&
    json(pdb.periodoDaEvolucao(mesesEvo, "2026-03-31", 12)) === json({ start: "2025-11-01", end: "2026-03-31" }) &&
    json(pdb.periodoDaEvolucao(mesesEvo, "2026-03-31", 0)) === json({ start: "2025-11-01", end: "2026-03-31" }) &&
    pdb.acumular([{ valor: 10 }, { valor: -3 }, { valor: 5 }]).map((ponto) => ponto.valor).join() === "10,7,12" &&
    pdb.numeroDeSaldo(widgetDef("dre_receita_liquida")) === false,
  null
);
check("Mesmo período em vários blocos calcula uma vez", pdb.envDoBloco({ kind: "widget", periodo: { tipo: "ultimoMes" } }, envTri).ctx === envMarco.ctx, null);
setCompanyState();

// ── Sessão vencida: o cliente do Supabase renova e repete a chamada ──
section("Sessão vencida");
const { respostaDeTokenVencido } = await src("lib/supabaseClient.js");
check(
  "Reconhece token vencido do banco e dos arquivos; não confunde com outros erros",
  respostaDeTokenVencido(401, '{"code":"PGRST303","message":"JWT expired"}') &&
    respostaDeTokenVencido(400, '{"statusCode":"403","error":"Unauthorized","message":"\\"exp\\" claim timestamp check failed"}') &&
    !respostaDeTokenVencido(401, '{"code":"42501","message":"permission denied"}') &&
    !respostaDeTokenVencido(500, "JWT expired"),
  null
);

// ── Central: uso do portal (lib/uso.js) ──
section("Central");
const uso = await src("lib/uso.js");
check(
  "Nome de cada tela (rotas do app e abas do B.I.)",
  uso.nomeDaTela("/") === "Início" &&
    uso.nomeDaTela("/empresa/demonstrativos") === "Demonstrativos" &&
    uso.nomeDaTela("/empresa/apresentacoes/pr_1") === "Apresentação aberta" &&
    uso.nomeDaTela("/empresa/painel/tab_1", [{ id: "tab_0", name: "Geral", subTabs: [{ id: "tab_1", name: "Receitas" }] }]) === "B.I. · Receitas" &&
    uso.nomeDaTela("/parametros/de-para") === "Parâmetros · De para" &&
    uso.nomeDaTela("/reforma/simulacao/9") === "Reforma Tributária",
  null
);
const eventos = [
  { email: "a@x.com", tipo: "acesso", dispositivo: "celular", criado_em: "2026-10-26T13:00:00Z" },
  { email: "a@x.com", tipo: "tela", tela: "Início", visita: "v1", empresa: "", segundos: 40, criado_em: "2026-10-26T13:01:00Z" },
  { email: "a@x.com", tipo: "tela", tela: "B.I. · Geral", visita: "v2", empresa: "QUAENT", segundos: 300, criado_em: "2026-10-26T13:06:00Z" },
  { email: "a@x.com", tipo: "tela", tela: "B.I. · Geral", visita: "v2", empresa: "QUAENT", segundos: 60, criado_em: "2026-10-26T13:08:00Z" },
  { email: "b@x.com", tipo: "acesso", dispositivo: "computador", criado_em: "2026-10-27T18:00:00Z" },
  { email: "b@x.com", tipo: "tela", tela: "Demonstrativos", visita: "v3", empresa: "CONCENT", segundos: 120, criado_em: "2026-10-27T18:05:00Z" },
  { email: "c@x.com", tipo: "acesso", dispositivo: "computador", criado_em: "2026-09-01T12:00:00Z" },
];
const rUso = uso.resumoDeUso(eventos, { inicio: new Date(2026, 9, 21), fim: new Date(2026, 9, 28) });
check(
  "Resumo da Central: acessos, pessoas, tempo, telas (visita em dois pedaços conta uma vez), pessoas e aparelhos",
  rUso.acessos === 2 && rUso.pessoas === 2 && rUso.segundos === 520 && rUso.porDia.length === 7 &&
    rUso.telas[0].tela === "B.I. · Geral" && rUso.telas[0].segundos === 360 && rUso.telas[0].visitas === 1 &&
    rUso.pessoasLista[0].email === "a@x.com" && rUso.pessoasLista[0].tela === "B.I. · Geral" && rUso.pessoasLista[0].dispositivo === "celular" &&
    rUso.empresas[0].empresa === "QUAENT" && rUso.dispositivos.celular === 1 && rUso.dispositivos.computador === 1 &&
    rUso.horarios.flat().reduce((soma, valor) => soma + valor, 0) === 2,
  rUso
);
const pistas = uso.pistasDeUso(rUso, { naoEntraram: 2 });
check("Pistas pra melhorar: tela com mais tempo, celular e quem não entrou", pistas.some((pista) => pista.tipo === "foco" && pista.texto.includes("B.I. · Geral")) && pistas.some((pista) => pista.tipo === "celular") && pistas.some((pista) => pista.texto.startsWith("2 clientes")), pistas);
check(
  "Duração e 'há quanto tempo'",
  uso.duracao(45) === "45 s" && uso.duracao(720) === "12 min" && uso.duracao(4800) === "1 h 20 min" && uso.duracao(7200) === "2 h" &&
    uso.haQuanto("2026-10-28T10:00:00Z", new Date("2026-10-28T10:30:00Z")) === "há 30 min" && uso.haQuanto("2026-10-27T09:00:00Z", new Date("2026-10-28T10:00:00Z")) === "ontem",
  null
);

// ── Ambientes: oficial × teste (lib/ambiente.js, docs/AMBIENTES.md) ──
section("Ambientes");
const { ambienteDe } = await src("lib/ambiente.js");
check(
  "Banco oficial = oficial; qualquer outro banco = teste; VITE_AMBIENTE manda",
  ambienteDe({ VITE_SUPABASE_URL: "https://ijmkvxtdlthyxpawncbs.supabase.co" }) === "oficial" &&
    ambienteDe({ VITE_SUPABASE_URL: "https://sbpmstnfdojrsfksakhy.supabase.co" }) === "teste" &&
    ambienteDe({ VITE_SUPABASE_URL: "https://ijmkvxtdlthyxpawncbs.supabase.co", VITE_AMBIENTE: "teste" }) === "teste" &&
    ambienteDe({}) === "teste",
  null
);
const { hubLigado } = await src("lib/hub.js");
check(
  "Hub novo: só no site de teste e só pro dono (nem cliente, nem colaborador, nem no oficial)",
  hubLigado({ userEmail: "IzaiasContac@gmail.com " }, true) &&
    !hubLigado({ userEmail: "izaiascontac@gmail.com" }, false) &&
    !hubLigado({ userEmail: "contac@gmail.com", isAdmin: true }, true) &&
    !hubLigado({ userEmail: "cliente@empresa.com" }, true) &&
    !hubLigado({}, true),
  null
);
const { baseDeTeste } = await import(path.join(ROOT, "scripts/gerar-base-de-teste.mjs"));
const base = baseDeTeste();
const fechaPartidas = base.companies.every((empresa) => Math.abs(empresa.journal.reduce((soma, entry) => soma + entry.debito - entry.credito, 0)) < 0.05);
check(
  "Base do site de teste: 3 empresas fictícias de jan a set, partidas dobradas fechando, e o grupo",
  base.companies.length === 3 && fechaPartidas && base.companies.every((empresa) => empresa.journalLoaded && empresa.fechadoAte === "2026-09" && empresa.journal.some((entry) => entry.data.startsWith("2026-09"))) && base.groups[0].companyIds.length === 3,
  null
);

const robo = await import(path.join(ROOT, "scripts/copiar-oficial-para-teste.mjs"));
const recusa = (oficial, teste) => {
  try {
    robo.conferirEnderecos(oficial, teste);
    return false;
  } catch {
    return true;
  }
};
const lotesCopia = robo.emLotes([{ a: "x".repeat(60) }, { a: "y".repeat(60) }, { a: "z".repeat(300) }, { a: "w" }], 150);
const sqlCopia = fs.readFileSync(path.join(ROOT, "supabase/teste/copia_do_oficial.sql"), "utf8");
const tabelasSql = (sqlCopia.match(/select array\[([\s\S]*?)\]::text\[\]/) || [])[1]?.match(/'([a-z_]+)'/g)?.map((nome) => nome.slice(1, -1)) || [];
check(
  "Cópia do oficial pro teste: nunca grava no oficial, lotes por tamanho, mesmas tabelas no robô e no banco",
  recusa("https://sbpmstnfdojrsfksakhy.supabase.co", "https://ijmkvxtdlthyxpawncbs.supabase.co") &&
    recusa("https://ijmkvxtdlthyxpawncbs.supabase.co", "https://ijmkvxtdlthyxpawncbs.supabase.co") &&
    !recusa("https://ijmkvxtdlthyxpawncbs.supabase.co", "https://sbpmstnfdojrsfksakhy.supabase.co") &&
    lotesCopia.map((lote) => lote.length).join() === "2,1,1" &&
    tabelasSql.join() === robo.TABELAS.map(([tabela]) => tabela).join(),
  { lotes: lotesCopia.map((lote) => lote.length), tabelasSql }
);
// Banco de mentira: página com mais de 3 linhas estoura o tempo da API.
const linhasFalsas = Array.from({ length: 10 }, (_, i) => ({ id: i }));
const paginasPedidas = [];
const bancoFalso = (resposta) => ({
  from: () => {
    const consulta = { select: () => consulta, order: () => consulta, range: async (de, ate) => resposta(de, ate) };
    return consulta;
  },
});
const lento = bancoFalso((de, ate) => {
  paginasPedidas.push(ate - de + 1);
  return ate - de + 1 > 3 ? { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" }, status: 500 } : { data: linhasFalsas.slice(de, ate + 1), error: null, status: 200 };
});
const lidas = [];
for await (const pagina of robo.lerEmPaginas(lento, "t", "id", 8)) lidas.push(...pagina);
let chaveRuim = "";
try {
  for await (const pagina of robo.lerEmPaginas(bancoFalso(() => ({ data: null, error: { message: "Invalid API key" }, status: 401 })), "t", "id")) lidas.push(pagina);
} catch (error) {
  chaveRuim = error.message;
}
const versaoSql = Number((sqlCopia.match(/versao_da_copia\(\)[\s\S]*?select (\d+)/) || [])[1]);
check(
  "Cópia: página pesada demais é pedida de novo pela metade; chave errada avisa o segredo; SQL do teste sem delete e na versão do robô",
  lidas.map((linha) => linha.id).join() === "0,1,2,3,4,5,6,7,8,9" &&
    paginasPedidas.join() === "8,4,2,2,2,2,2,2" &&
    /OFICIAL_SUPABASE_SERVICE_KEY/.test(chaveRuim) &&
    !/delete from/i.test(sqlCopia) &&
    /alter role service_role set statement_timeout/.test(sqlCopia) &&
    versaoSql === robo.VERSAO_DA_COPIA,
  { paginasPedidas, chaveRuim, versaoSql }
);

console.log(`\n${total - failures} de ${total} testes passaram.`);
if (failures) {
  console.log(`${failures} FALHA(S).`);
  process.exit(1);
}
