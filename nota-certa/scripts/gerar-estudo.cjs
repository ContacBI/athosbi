const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, LevelFormat, BorderStyle, Header, Footer, PageNumber, PageBreak, ExternalHyperlink, LineRuleType,
} = require("docx");

// Estudo: notas sem erro na Reforma Tributária (IBS/CBS) — validador antes e
// depois da emissão, matriz fiscal e cClassTrib.
// Uso (precisa do pacote "docx"): node gerar-estudo.cjs "../docs/Nota Certa - Estudo (IBS-CBS).docx"

const DADOS = path.join(__dirname, "..", "dados", "anexos-lc214.json");

const NAVY = "14202B";
const ORANGE = "D9622B";
const MUTED = "5B6670";
const LIGHT = "F3F5F7";
const FONT = "Calibri";
const GREEN = "1D7A55";
const GREEN_BG = "E6F4EC";
const YELLOW = "8A5A00";
const YELLOW_BG = "FFF4D6";
const RED = "B42318";
const RED_BG = "FDECEA";
const BLUE = "1F4E8C";
const BLUE_BG = "EAF1FB";
const W = 9638; // A4 com margens de 2 cm

// ---------------------------------------------------------------------------
// Blocos de texto

const run = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });

// "texto com **negrito**" → trechos
function rich(text, base = {}) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith("**") && part.endsWith("**") ? run(part.slice(2, -2), { ...base, bold: true }) : run(part, base)));
}

function P(text, { color, italics, size, after = 120, before, keepNext, align, bold } = {}) {
  return new Paragraph({
    alignment: align,
    keepNext,
    spacing: { after, ...(before != null ? { before } : {}) },
    children: rich(text, { color, italics, size, bold }),
  });
}

const muted = (text, opts = {}) => P(text, { color: MUTED, italics: true, ...opts });

function B(text, level = 0) {
  return new Paragraph({ numbering: { reference: "bullets", level }, spacing: { after: 60 }, children: rich(text) });
}

let stepInstance = 0;
function steps(list) {
  stepInstance += 1;
  const instance = stepInstance;
  return list.map((text) => new Paragraph({ numbering: { reference: "steps", level: 0, instance }, spacing: { after: 70 }, children: rich(text) }));
}

const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [run(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [run(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [run(text)] });

function label(text) {
  return new Paragraph({ keepNext: true, spacing: { before: 140, after: 50 }, children: [run(text.toUpperCase(), { bold: true, size: 17, color: ORANGE, characterSpacing: 20 })] });
}

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

// ---------------------------------------------------------------------------
// Tabelas

const line = { style: BorderStyle.SINGLE, size: 4, color: "D5DBE0" };
const borders = { top: line, bottom: line, left: line, right: line };

// Conteúdo de célula: "texto" | ["parágrafo", "parágrafo"] | { t, fill, color, bold, align }
function cellParagraphs(content, { size, color, bold, align, keepNext }) {
  const list = Array.isArray(content) ? content : [content];
  return list.map((text, index) => {
    const bullet = String(text).startsWith("• ");
    return new Paragraph({
      alignment: align,
      keepNext,
      numbering: bullet ? { reference: "cellbullets", level: 0 } : undefined,
      spacing: { after: index === list.length - 1 ? 0 : 60 },
      children: rich(bullet ? String(text).slice(2) : text, { size, color, bold }),
    });
  });
}

function cell(content, width, { fill = null, color = "222222", bold = false, size = 17, align = AlignmentType.LEFT, span, keepNext } = {}) {
  const spec = content && typeof content === "object" && !Array.isArray(content) ? content : { t: content };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: span,
    borders,
    shading: spec.fill || fill ? { fill: spec.fill || fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: cellParagraphs(spec.t ?? "", { size: spec.size || size, color: spec.color || color, bold: spec.bold ?? bold, align: spec.align || align, keepNext }),
  });
}

function table(headers, rows, widths, { size = 17, zebra = true, headFill = NAVY } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  if (total !== W) throw new Error(`Larguras somam ${total}, deviam somar ${W}: ${headers.join(" | ")}`);
  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((text, i) => cell(text, widths[i], { fill: headFill, color: "FFFFFF", bold: true, size })),
  });
  const body = rows.map((row, r) => {
    if (row.length !== widths.length) throw new Error(`Linha com ${row.length} colunas (esperado ${widths.length}): ${JSON.stringify(row).slice(0, 80)}`);
    return new TableRow({ cantSplit: true, children: row.map((content, i) => cell(content, widths[i], { size, fill: zebra && r % 2 === 1 ? LIGHT : null })) });
  });
  return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: [head, ...body] }), spacer(160)];
}

// Quadro de destaque (borda grossa à esquerda, fundo claro).
function callout(title, lines, { fill = BLUE_BG, color = BLUE } = {}) {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const children = [
    ...(title ? [new Paragraph({ spacing: { after: 80 }, children: [run(title, { bold: true, color, size: 21 })] })] : []),
    ...lines.map((text, i) =>
      text.startsWith("• ")
        ? new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: i === lines.length - 1 ? 0 : 50 }, children: rich(text.slice(2)) })
        : new Paragraph({ spacing: { after: i === lines.length - 1 ? 0 : 80 }, children: rich(text) })
    ),
  ];
  return [
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: W, type: WidthType.DXA },
              borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 24, color } },
              shading: { fill, type: ShadingType.CLEAR, color: "auto" },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              children,
            }),
          ],
        }),
      ],
    }),
    spacer(160),
  ];
}

// Esboço de tela: grade de 12 colunas; cada linha é uma lista de células com
// `span` (somando 12).
const GRID = Array.from({ length: 12 }, (_, i) => (i === 11 ? W - 803 * 11 : 803));
function tela(titulo, linhas, legenda = "Esboço ilustrativo — o visual final será definido no desenvolvimento do app.") {
  const spanWidth = (start, span) => GRID.slice(start, start + span).reduce((a, b) => a + b, 0);
  const rows = [[{ t: titulo, span: 12, fill: NAVY, color: "FFFFFF", bold: true, size: 17 }], ...linhas].map((cells) => {
    const sum = cells.reduce((a, c) => a + (c.span || 12), 0);
    if (sum !== 12) throw new Error(`Linha do esboço "${titulo}" soma ${sum}`);
    let start = 0;
    return new TableRow({
      cantSplit: true,
      children: cells.map((c) => {
        const span = c.span || 12;
        const width = spanWidth(start, span);
        start += span;
        return cell(c, width, { span: span > 1 ? span : undefined, size: c.size || 16, fill: c.fill || null, color: c.color || "222222", bold: c.bold || false, align: c.align, keepNext: true });
      }),
    });
  });
  return [
    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: GRID, rows }),
    new Paragraph({ spacing: { before: 60, after: 200 }, children: [run(legenda, { italics: true, size: 16, color: MUTED })] }),
  ];
}

const link = (text, url) => new ExternalHyperlink({ link: url, children: [run(text, { color: BLUE, underline: {}, size: 18 })] });

// ---------------------------------------------------------------------------

async function main() {
  const dados = JSON.parse(fs.readFileSync(DADOS, "utf8"));
  const { tratamentos: TRATAMENTOS, fonte: FONTE, ncm: NCM, nbs: NBS } = dados;

  // Em quais tratamentos (cClassTrib) dos anexos o código se enquadra — mesma
  // regra da Calculadora da Receita: o código começa por um prefixo do anexo;
  // se uma exceção o cobre, só vale havendo outro vínculo sem exceção.
  const enquadramentosLc214 = (codigo, tipo = "mercadoria") => {
    const digitos = String(codigo).replace(/\D/g, "");
    const porTratamento = new Map();
    for (const [prefixo, cClassTrib, , excecoes] of tipo === "servico" ? NBS : NCM) {
      if (!digitos.startsWith(prefixo)) continue;
      if (!porTratamento.has(cClassTrib)) porTratamento.set(cClassTrib, []);
      porTratamento.get(cClassTrib).push(excecoes);
    }
    return [...porTratamento]
      .filter(([, vinculos]) => !vinculos.some((ex) => ex.some((e) => digitos.startsWith(e))) || vinculos.some((ex) => ex.length === 0))
      .map(([cClassTrib]) => ({ cClassTrib }));
  };

  // Confere os exemplos do texto contra a base dos anexos (se a base mudar,
  // o documento não sai com exemplo errado).
  const confere = (codigo, tipo, esperado) => {
    const achados = enquadramentosLc214(codigo, tipo).map((e) => e.cClassTrib);
    esperado.forEach((c) => {
      if (!achados.includes(c)) throw new Error(`Exemplo ${codigo}: esperava ${c}, achei ${achados.join(",")}`);
    });
    return achados;
  };
  confere("10063021", "mercadoria", ["200003"]);
  confere("34011190", "mercadoria", ["200035"]);
  confere("90183119", "mercadoria", ["200030", "200005"]);
  confere("122012000", "servico", ["200028"]);
  if (enquadramentosLc214("84713012").length) throw new Error("Notebook deixou de ser tributação integral na base");

  const body = [];
  const add = (...items) => items.flat().forEach((item) => body.push(item));

  // ===== Capa =================================================================
  add(
    new Paragraph({ spacing: { before: 2200, after: 240, line: 240 }, children: [run("NOTA CERTA · ESTUDO", { bold: true, size: 22, color: ORANGE, characterSpacing: 60 })] }),
    new Paragraph({ spacing: { before: 0, after: 200, line: 252, lineRule: LineRuleType.AUTO }, children: [run("Nota fiscal sem erro na Reforma Tributária", { bold: true, size: 60, color: NAVY })] }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 6 } },
      spacing: { after: 300 },
      children: [run("Contexto da reforma, IBS e CBS, NCM, CST, cClassTrib, matriz fiscal — e como seria o nosso app: um assistente para emitir certo e um conferidor de XML", { size: 26, color: MUTED })],
    }),
    P("Outubro de 2026", { color: MUTED, size: 22 }),
    spacer(1600),
    ...callout("Importante", [
      "Este é um documento de estudo e planejamento. Ele **não substitui parecer tributário**. As regras da reforma ainda estão mudando: datas, versões de notas técnicas e tabelas oficiais são atualizadas com frequência.",
      "Os pontos marcados com **(conferir)** vieram de fontes secundárias (artigos, blogs técnicos) ou mudam com frequência. Confirme no texto oficial antes de virarem regra no sistema. As fontes estão no último capítulo.",
    ], { fill: YELLOW_BG, color: YELLOW }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ===== Sumário ==============================================================
  const CAPITULOS = [
    ["Resumo em uma página", "o problema, a proposta e o que decidir agora"],
    ["Reforma Tributária: o contexto completo", "leis, cronograma, alíquotas, crédito, split payment, Simples, apuração assistida, multas, mitos"],
    ["Conceitos para emitir certo", "NCM, NBS, CFOP, CST, cClassTrib, cCredPres, campos da nota, base e cálculo, matriz fiscal"],
    ["Onde os erros nascem", "a cadeia do erro, do cadastro do produto até a apuração"],
    ["Como o app funcionaria", "telas, jornadas passo a passo, esboços e ideias"],
    ["Regras de validação", "o catálogo completo do que o sistema confere"],
    ["Exemplos resolvidos", "cinco casos com números"],
    ["Dados oficiais e integrações", "tabelas, Calculadora da Receita, de onde vêm os XMLs"],
    ["Como construir o app", "app separado, tabelas, motor de regras, privacidade"],
    ["Versão do escritório x versão do cliente", "quem faz o quê"],
    ["O que precisamos", "checklist"],
    ["Plano de trabalho", "fases com critério de pronto"],
    ["Decisões a tomar", "opções e recomendação"],
    ["Riscos e cuidados", ""],
    ["Glossário", ""],
    ["Fontes e como manter atualizado", ""],
  ];
  add(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run("Sumário")] }),
    ...CAPITULOS.map(([titulo, desc], i) => new Paragraph({ spacing: { after: 90 }, children: [run(`${i + 1}. ${titulo}`, { bold: true, color: NAVY }), ...(desc ? [run(`  —  ${desc}`, { color: MUTED })] : [])] })),
    spacer(200),
    label("Como ler"),
    P("Quem tem pouco tempo: capítulo 1 (resumo), 5 (como o app funcionaria) e 13 (decisões). O capítulo 2 é a base para conversar com o chefe e com os clientes sobre a reforma. Os capítulos 3, 6 e 7 são o “manual técnico”: o que é cada código e o que o sistema vai conferir.")
  );

  // ===== 1. Resumo ============================================================
  add(
    H1("1. Resumo em uma página"),
    label("O problema"),
    P("A partir de **2027** a CBS passa a ser cobrada de verdade (substitui PIS e Cofins) e a apuração do IBS e da CBS passa a ser **assistida**: a Receita Federal e o Comitê Gestor do IBS montam o imposto do mês a partir das notas emitidas e recebidas. O que a empresa não contestar no prazo vira dívida confessada. Na prática, **a nota fiscal passa a ser a própria apuração**."),
    P("Por isso, uma nota errada vira imposto errado. O erro afeta quem vende e também o crédito de quem compra. E consertar depois é caro:"),
    B("cancelar fora do prazo dá multa de **33%** do “tributo de referência”; cancelar depois do fato gerador, **66%** (LC 227/2026) **(conferir)**;"),
    B("a correção vira nota de crédito ou de débito, com retrabalho para o cliente e para o escritório."),
    label("O objetivo"),
    P("**O cliente não errar ao emitir.** Atacamos o erro onde ele nasce: no cadastro do produto (NCM), no cadastro do comprador e na regra fiscal usada pelo sistema emissor (ERP). E conferimos cada nota logo depois de emitida, enquanto ainda dá para cancelar sem multa."),
    label("A proposta"),
    P("Um **app próprio, separado do AthosBI**, com o nome de trabalho **Nota Certa**. Cada cliente tem uma base única com:"),
    B("cadastro fiscal da empresa;"),
    B("catálogo de produtos e serviços com NCM/NBS conferido;"),
    B("perfil dos compradores;"),
    B("**matriz fiscal** aprovada pelo escritório;"),
    B("tabelas oficiais versionadas."),
    P("Sobre essa base funcionam duas ferramentas:"),
    ...table(
      ["Ferramenta", "Quando", "O que faz", "Resultado"],
      [
        ["**A. Assistente de emissão**", "Antes de emitir", "O usuário informa a operação, o comprador e os itens. O app diz como a nota deve sair: CFOP, CST, cClassTrib, base, alíquotas e valores. Também avisa dos riscos.", "Espelho da nota para o faturamento e tabela de parametrização para o ERP"],
        ["**B. Conferidor de XML**", "Logo depois de emitir (e no fechamento do mês)", "Lê os XMLs autorizados e compara com a matriz e com as regras oficiais. Também recalcula os valores.", "Sinal verde, amarelo ou vermelho por nota, o que corrigir, o prazo para cancelar e a ação recomendada"],
      ],
      [2000, 1700, 3638, 2300]
    ),
    label("Quem usa"),
    B("**Escritório:** vê todos os clientes, monta e aprova a matriz, confere em lote e acompanha a carteira."),
    B("**Cliente:** vê só a sua empresa. Cadastra produtos (que o escritório aprova), usa o assistente antes de emitir e confere os próprios XMLs. O acesso é por e-mail, no mesmo modelo que já usamos no AthosBI."),
    label("O que já temos (no AthosBI) para reaproveitar"),
    B("O modelo do módulo Reforma: cadastro de empresas, liberação de acesso por e-mail e simulador de impacto."),
    B(`Base dos anexos da LC 214: **${NCM.length} regras por NCM**, **${NBS.length} por NBS** e **${Object.keys(TRATAMENTOS).length} tratamentos (cClassTrib)** com redução ou alíquota zero. Vem da Calculadora oficial da Receita (dados ${FONTE.dados}). Já sugere o enquadramento de cada NCM/NBS.`),
    B("Leitura do resumo fiscal das notas da Domínio (vendas e compras por NCM), sempre só leitura."),
    label("O que decidir agora (detalhes no capítulo 13)"),
    ...steps([
      "**Clientes piloto:** 3 a 5, com perfis diferentes (comércio com Cesta Básica, distribuidor de produtos de saúde, prestador de serviço, alguém do Simples).",
      "**Escopo inicial:** NF-e modelo 55 primeiro, depois NFS-e nacional e NFC-e.",
      "**XMLs para teste:** 20 a 50 notas reais de cada piloto, por upload. Elas ficam fora do código, e o que entrar nos testes automáticos é anonimizado.",
    ])
  );

  // ===== 2. Contexto da Reforma ==============================================
  add(
    H1("2. Reforma Tributária: o contexto completo"),
    muted("Este capítulo é a base para conversar com o chefe e com os clientes. Ele explica o que muda, quando muda e por que a nota fiscal ficou tão importante."),

    H2("2.1 Por que existe a reforma"),
    P("O sistema atual de tributos sobre o consumo tem cinco tributos com regras diferentes:"),
    B("PIS e Cofins (federais, com regimes cumulativo e não cumulativo);"),
    B("IPI (federal);"),
    B("ICMS (27 legislações estaduais);"),
    B("ISS (mais de 5.500 legislações municipais)."),
    P("Os problemas mais citados:"),
    B("**Cumulatividade:** imposto sobre imposto e crédito restrito."),
    B("**Guerra fiscal** entre estados."),
    B("**Disputa** sobre o que é mercadoria e o que é serviço."),
    B("**Custo enorme** para cumprir as obrigações acessórias."),
    B("**Muito contencioso** na Justiça."),
    P("A reforma troca esse conjunto por um **IVA dual**: dois tributos com a mesma base e as mesmas regras, um federal e um subnacional, além de um imposto seletivo."),

    H2("2.2 O que sai e o que entra"),
    ...table(
      ["Hoje", "Passa a ser", "De quem é", "Observação"],
      [
        ["PIS e Cofins", "**CBS** — Contribuição sobre Bens e Serviços", "União", "Começa em 2027 com alíquota cheia (2026 é ano de teste)"],
        ["ICMS e ISS", "**IBS** — Imposto sobre Bens e Serviços", "Estados, DF e municípios (Comitê Gestor do IBS)", "Entra aos poucos de 2029 a 2032; ICMS e ISS acabam em 2033"],
        ["IPI", "**IS** — Imposto Seletivo (e IPI zerado)", "União", "IS sobre produtos prejudiciais à saúde e ao meio ambiente a partir de 2027; IPI fica só para proteger a Zona Franca de Manaus"],
      ],
      [1500, 2800, 2400, 2938]
    ),

    H2("2.3 Os princípios que mudam o dia a dia"),
    B("**Não cumulatividade plena:** quase tudo o que a empresa compra para a atividade gera crédito (bens, serviços, energia, aluguel, intangíveis). A exceção principal é o uso e consumo pessoal."),
    B("**Cobrança no destino:** o IBS fica com o estado e o município de **quem compra**, não de quem vende. Isso acaba com a guerra fiscal."),
    B("**Imposto “por fora”:** o IBS e a CBS não entram na própria base e aparecem **destacados na nota**. O preço passa a ser “valor + tributo”."),
    B("**Legislação única:** a mesma lei e o mesmo regulamento para o país todo. Cada ente só define a sua alíquota."),
    B("**Neutralidade:** o imposto não deve influenciar as decisões de negócio."),
    B("**Justiça tributária:** cesta básica com alíquota zero e devolução de imposto (cashback) para famílias de baixa renda."),

    H2("2.4 As normas que importam"),
    ...table(
      ["Norma", "O que é", "Por que importa para o nosso app"],
      [
        ["Emenda Constitucional 132/2023", "A emenda da reforma (dez/2023)", "Cria IBS, CBS e IS e a transição até 2033"],
        ["Lei Complementar 214/2025", "Lei que institui IBS, CBS e IS (jan/2025)", "Base, alíquotas, anexos I a XV com reduções e alíquota zero, créditos, apuração, documentos fiscais"],
        ["Lei Complementar 227/2026", "Lei do Comitê Gestor do IBS, que também alterou a LC 214 (origem: PLP 108/2024)", "Multas de cancelamento (art. 341-G), regras de devolução e cancelamento, benefícios que não se somam **(conferir)**"],
        ["NT 2025.002 (NF-e e NFC-e)", "Nota Técnica do leiaute da nota com IBS/CBS", "Campos (grupo UB), validações e rejeições. Tem várias versões; usar sempre a vigente"],
        ["Informe Técnico 2025.002", "Tabelas oficiais CST/cClassTrib e cCredPres", "É o “dicionário” que o validador usa. Também tem várias versões e datas de vigência"],
        ["Leiaute da NFS-e nacional (anexos VII e VIII)", "Documento nacional de serviço com IBS/CBS", "Indicador da operação (cIndOp) e a correlação serviço × NBS × cClassTrib"],
        ["Atos Conjuntos RFB/CGIBS", "Normas operacionais do período de teste", "Datas de obrigatoriedade, apuração assistida, cronograma de rejeições"],
        ["Ajustes SINIEF e Resoluções CGSN", "Convênios das SEFAZ e normas do Simples", "Notas de crédito e débito; opção do Simples pelo regime regular do IBS/CBS"],
      ],
      [2500, 3138, 4000]
    ),

    H2("2.5 Cronograma de transição"),
    ...table(
      ["Ano", "CBS", "IBS", "Tributos antigos", "O que muda na prática"],
      [
        ["**2026**", "0,9% (teste)", "0,1% (teste)", "PIS, Cofins, ICMS, ISS e IPI normais", [
          "• Ano de aprendizado.",
          "• Destaque do IBS/CBS obrigatório na NF-e do regime regular desde 03/08/2026 e na NFS-e desde 01/10/2026.",
          "• A rejeição por falta do grupo (rejeição 1115) está suspensa, sem data nova **(conferir)**.",
          "• O valor é compensável com PIS/Cofins, e quem cumpre as obrigações acessórias fica dispensado de recolher (art. 348) **(conferir)**.",
          "• Apuração assistida só informativa.",
        ]],
        ["**2027**", "Alíquota cheia, ainda a definir (menos 0,1 ponto)", "0,1% (0,05% estadual + 0,05% municipal)", "PIS e Cofins **extintos**; IPI zerado (exceto ZFM); começa o Imposto Seletivo", [
          "• **CBS de verdade.**",
          "• Simples e MEI também preenchem os campos.",
          "• A apuração assistida passa a valer como confissão de dívida.",
          "• Erro na nota passa a custar dinheiro.",
        ]],
        ["**2028**", "Cheia", "0,1%", "ICMS e ISS normais", ["Split payment previsto para virar obrigatório **(conferir)**."]],
        ["**2029 a 2032**", "Cheia", "Sobe aos poucos", "ICMS e ISS caem para 90%, 80%, 70% e 60% das alíquotas", [
          "• Os dois sistemas convivem: a nota tem ICMS/ISS e IBS/CBS.",
          "• Cada estado e município passa a ter a sua alíquota de IBS.",
        ]],
        ["**2033**", "Cheia", "Cheia", "ICMS e ISS **extintos**", ["Sistema novo completo."]],
      ],
      [900, 1500, 1500, 2100, 3638]
    ),
    ...callout("Alíquota de referência: ainda não definida", [
      "A alíquota “cheia” (de referência) da CBS e do IBS será fixada pelo Senado. A expectativa é até **15/12/2026** **(conferir)**.",
      "As estimativas giram em torno de **26,5% a 28% somando CBS e IBS**. Para a CBS sozinha, fala-se em perto de 9%.",
      "Existe uma trava: se a carga passar do teto previsto, o governo precisa propor a redução de benefícios.",
      "No app, **toda alíquota é um parâmetro por ano**, editável pelo escritório. Isso já é assim no simulador da Reforma do AthosBI.",
    ]),

    H2("2.6 Alíquotas: cheia, reduzida e zero"),
    P("A regra geral é a alíquota cheia. A LC 214 traz reduções para setores e produtos específicos, quase sempre definidos por **NCM** (produtos) ou **NBS** (serviços) nos anexos. É por isso que o NCM correto ficou tão importante: **o NCM decide se o produto paga 100%, 40% ou zero**."),
    ...table(
      ["Tratamento", "Redução", "Exemplos", "Onde está"],
      [
        ["Alíquota zero", "100%", "Cesta Básica Nacional (arroz, feijão, leite, carnes…); hortícolas, frutas e ovos; alguns dispositivos médicos e de acessibilidade; alguns medicamentos", "Anexos I, XII, XIII, XIV e XV (arts. 125, 144 a 148)"],
        ["Redução de 60%", "60%", "Educação; saúde; dispositivos médicos; acessibilidade; medicamentos; alimentos; higiene pessoal e limpeza; insumos agropecuários; produções culturais nacionais; soberania; segurança da informação", "Anexos II a XI (arts. 128 a 142)"],
        ["Redução de 30%", "30%", "Serviços de profissões intelectuais regulamentadas (advogados, contadores, engenheiros, arquitetos, economistas…)", "Art. 127"],
        ["Alíquota cheia", "0%", "Todo o resto", "Regra geral"],
      ],
      [1700, 1000, 4638, 2300]
    ),
    P("Detalhes que pegam:"),
    B("**Benefício condicionado ao comprador.** Alguns itens só têm alíquota zero quando vendidos a órgão público ou a entidade de saúde imune com CEBAS (SUS). O mesmo produto vendido a um hospital privado tem só 60% de redução."),
    B("**Benefício que depende da descrição, não só do NCM.** Alguns itens dos anexos citam o produto (ex.: “Seringas, mesmo com agulhas”), e o mesmo NCM pode abranger outras coisas."),
    B("**Medicamentos:** dependem do registro na Anvisa e de listas próprias, não só do NCM **(conferir)**."),
    B("**Benefícios não se somam:** quando há mais de um, aplica-se um só (LC 227) **(conferir)**."),

    H2("2.7 Regimes diferenciados e específicos"),
    P("Alguns setores têm regras próprias e ficam **fora do escopo inicial** do validador, sinalizados para revisão manual:"),
    B("combustíveis (tributação monofásica);"),
    B("serviços financeiros e seguros;"),
    B("planos de saúde;"),
    B("concursos de prognósticos e apostas;"),
    B("bens imóveis e construção;"),
    B("cooperativas;"),
    B("bares, restaurantes, hotelaria, parques e agências de turismo;"),
    B("sociedades anônimas do futebol;"),
    B("transporte coletivo de passageiros;"),
    B("produtor rural não contribuinte, com **crédito presumido** para quem compra dele;"),
    B("Zona Franca de Manaus e áreas de livre comércio."),

    H2("2.8 Crédito: amplo, mas condicionado"),
    P("O crédito passa a ser **financeiro**: tudo o que a empresa compra para a atividade gera crédito do IBS e da CBS destacados na nota de compra. Mas o crédito tem condições:"),
    B("**nota fiscal idônea e correta** (classificação, valores e destaque);"),
    B("**tributo efetivamente pago** pelo fornecedor (extinção do débito), seja por split payment, por recolhimento do próprio fornecedor ou pelo adquirente **(conferir)**;"),
    B("compra de fornecedor do **Simples** que recolhe dentro do DAS: crédito só do valor de IBS/CBS pago no DAS, bem menor;"),
    B("devolução ou cancelamento: o vendedor estorna o débito e o comprador estorna o crédito, nas alíquotas da operação original **(conferir)**."),
    P("Consequência comercial: **quem emite nota errada prejudica o crédito do próprio cliente**. Na disputa por clientes empresariais, emitir certo vira diferencial."),

    H2("2.9 Split payment"),
    P("O **split payment** (pagamento dividido) separa o imposto no momento do pagamento eletrônico (Pix, cartão, boleto). O banco ou a credenciadora manda a parte do IBS/CBS direto para o fisco, e o vendedor recebe o valor líquido."),
    P("Isso muda o fluxo de caixa das empresas e liga o crédito do comprador ao pagamento. A obrigatoriedade foi adiada e está prevista para **2028** **(conferir)**. Até lá, o recolhimento é por guia, com opção de recolhimento pelo adquirente."),

    H2("2.10 Cashback"),
    P("Famílias de baixa renda inscritas no CadÚnico recebem de volta parte do IBS/CBS pago. Os percentuais são maiores em gás de cozinha, energia, água, esgoto e telecomunicações. Para o validador, isso aparece nos campos de devolução de tributos (gDevTrib) das notas a consumidor final, quando aplicável **(conferir)**."),

    H2("2.11 Simples Nacional e MEI"),
    P("A empresa do Simples continua no regime e tem dois caminhos para o IBS/CBS:"),
    ...table(
      ["Opção", "Como funciona", "Bom para"],
      [
        ["**Dentro do DAS** (padrão)", "IBS/CBS continuam embutidos no DAS. O comprador só aproveita de crédito o valor efetivamente pago no DAS, pequeno (no comércio, na primeira faixa, perto de 0,6%) **(conferir)**", "Quem vende principalmente para consumidor final"],
        ["**Regime híbrido**", "IBS/CBS recolhidos “por fora”, como no regime regular, e o resto continua no DAS. O cliente empresarial aproveita o crédito cheio e a empresa também toma crédito das compras", "Quem vende para outras empresas (B2B), que vão preferir fornecedor que gera crédito"],
      ],
      [2200, 4938, 2500]
    ),
    P("A opção é semestral e vale pelo semestre inteiro. A janela e as datas são definidas em resolução do CGSN; a Resolução CGSN 194/2026 é citada com janela de 01/09 a 30/10/2026 **(conferir)**. A partir de 2027, as notas do Simples e do MEI também precisam trazer os campos de IBS/CBS **(conferir)**."),
    P("Para o escritório, este é um tema de **consultoria** com cada cliente do Simples. O simulador da Reforma no AthosBI já ajuda nessa conta."),

    H2("2.12 Imposto Seletivo (IS)"),
    P("Começa em 2027 e incide uma vez só, na produção ou importação, sobre bens prejudiciais à saúde ou ao meio ambiente. Exemplos:"),
    B("cigarros e bebidas alcoólicas;"),
    B("bebidas açucaradas;"),
    B("veículos, embarcações e aeronaves;"),
    B("extração de minérios;"),
    B("apostas."),
    P("Fica fora do escopo inicial do validador: só sinalizamos quando o NCM do item é de produto sujeito ao IS."),

    H2("2.13 Apuração assistida"),
    P("Todo mês, a Receita (CBS) e o Comitê Gestor (IBS) montam uma **apuração pré-pronta** a partir de três fontes:"),
    B("os débitos das notas emitidas;"),
    B("os créditos das notas recebidas;"),
    B("os pagamentos já feitos."),
    P("A empresa confere e pode ajustar. **Se não fizer nada no prazo, a apuração é considerada confirmada** e o saldo vira débito constituído, uma confissão de dívida (arts. 45 e 46 da LC 214). Isso vale a partir de 2027; em 2026 a apuração é só informativa (Ato Conjunto RFB/CGIBS 1/2025)."),
    ...callout("O que isso significa", [
      "• A apuração deixa de ser algo que o escritório “faz” no fim do mês. Ela passa a ser **o espelho das notas**.",
      "• Nota errada = apuração errada. Nota cancelada fora de hora = ajuste a fazer na apuração.",
      "• O escritório deixa de calcular e passa a **conferir e corrigir**. O nosso app entra exatamente aí: conferir as notas antes que elas virem apuração.",
      "• O Comitê Gestor publica um manual da API da apuração (versão 1.10, set/2026) **(conferir)**. No futuro dá para cruzar automaticamente as notas com a apuração assistida.",
    ], { fill: GREEN_BG, color: GREEN }),

    H2("2.14 Cancelamento, correção e multas"),
    label("Prazo para cancelar"),
    B("Regra geral: **24 horas** depois da autorização. Algumas UFs aceitam até **168 horas** (7 dias), e o cancelamento extemporâneo depende de cada SEFAZ. **Não existe prazo único nacional**, por isso o prazo de cada cliente fica no cadastro."),
    B("Não se cancela nota de mercadoria que **já circulou**. Nesse caso, o caminho é devolução ou nota de crédito."),
    B("O cancelamento é feito pelo evento 110111."),
    label("Multas novas (LC 227/2026, art. 341-G, XVII) (conferir)"),
    B("**33%** do tributo de referência: cancelar fora do prazo legal."),
    B("**66%** do tributo de referência: cancelar depois da ocorrência do fato gerador."),
    B("O “tributo de referência” é definido na lei para calcular essas multas. Uma das fontes cita 6% (CBS) e 12% (IBS) do valor da operação em 2026."),
    B("Exemplo ilustrativo, se for 18% do valor: numa nota de R$ 10.000, o tributo de referência é R$ 1.800, e a multa é **R$ 594** (33%) ou **R$ 1.188** (66%)."),
    B("Em 2026 existe autorregularização sem multa depois de intimação (art. 348) **(conferir)**."),
    label("O que dá para corrigir sem cancelar"),
    ...table(
      ["Situação", "Ferramenta", "Observação"],
      [
        ["Erro percebido no prazo e mercadoria que não saiu", "**Cancelar e emitir de novo**", "O melhor caminho. Por isso o app conta as horas desde a autorização"],
        ["Erro de texto que não mexe em valor de imposto", "Carta de correção (CC-e)", "**Não pode** alterar base, alíquota, valores, quantidade ou nada que mude o imposto"],
        ["Imposto ou valor destacado **a maior**", "**Nota de crédito** (finalidade 5)", "Tipo 04, redução de valores; ou devolução"],
        ["Imposto ou valor destacado **a menor**", "Nota complementar (finalidade 2) ou **nota de débito** (finalidade 6), conforme o caso", "Conferir o tipo correto na NT vigente **(conferir)**"],
        ["Mercadoria devolvida", "Nota de devolução (finalidade 4)", "Mesma classificação e **alíquotas da operação original**"],
        ["Cancelamento que não entrou na apuração", "Nota de débito tipo 03", "Débitos de notas não processadas na apuração"],
      ],
      [3000, 2800, 3838]
    ),
    ...callout("A sua pergunta: “nota emitida errada e cancelada perde grande parte do crédito?”", [
      "**Parcialmente correto.** Não existe na lei uma regra de “perder o crédito” por cancelar. O custo real vem de três lugares:",
      "• **Multa** de 33% ou 66% do tributo de referência no cancelamento fora do prazo ou depois do fato gerador (LC 227) **(conferir)**.",
      "• **Crédito do comprador** depende de nota correta e de tributo pago. Nota errada ou cancelada trava ou estorna o crédito do cliente do nosso cliente.",
      "• **Apuração assistida:** nota não cancelada a tempo entra como débito. Ajustar dá trabalho e, a partir de 2027, o que não for contestado vira dívida confessada.",
      "**Conclusão:** o custo do erro é real e alto. **Prevenir sai muito mais barato do que corrigir**, e essa é a justificativa do produto.",
    ], { fill: YELLOW_BG, color: YELLOW }),

    H2("2.15 Nota de crédito e nota de débito"),
    P("São tipos novos de NF-e, criados para ajustar valores de IBS/CBS sem cancelar a nota original. Elas sempre referenciam a nota original."),
    ...table(
      ["Nota de débito (finNFe = 6) — tipo", "Para quê"],
      [
        ["01", "Transferência de créditos para cooperativas"],
        ["02", "Anulação de crédito por saídas imunes ou isentas"],
        ["03", "Débitos de notas fiscais não processadas na apuração"],
        ["04", "Multa e juros"],
        ["05", "Transferência de crédito na sucessão"],
        ["06", "Pagamento antecipado"],
        ["07", "Perda em estoque"],
        ["08", "Desenquadramento do Simples Nacional"],
      ],
      [3000, 6638]
    ),
    ...table(
      ["Nota de crédito (finNFe = 5) — tipo", "Para quê"],
      [
        ["01", "Multa e juros"],
        ["02", "Apropriação de crédito presumido de IBS sobre saldo devedor na ZFM"],
        ["03", "Retorno por recusa na entrega ou por não localização do destinatário"],
        ["04", "Redução de valores ou de quantidades"],
        ["05", "Transferência de crédito na sucessão"],
        ["06", "Retorno por recusa parcial (incluído na versão 1.36 da NT)"],
      ],
      [3000, 6638]
    ),
    muted("Tabelas conforme a NT 2025.002 e publicações técnicas (nfe.io, Inventti). Os tipos podem mudar a cada versão da NT (conferir)."),

    H2("2.16 O que muda na prática para as empresas"),
    ...table(
      ["Área", "Impacto", "O que fazer agora"],
      [
        ["Cadastro de produtos", "O NCM passa a decidir a alíquota do IBS/CBS", "Revisar NCM e descrição de todos os itens; classificar cada um (cClassTrib)"],
        ["Sistema emissor (ERP)", "Precisa dos campos novos e da regra fiscal por produto e operação", "Atualizar o ERP; parametrizar CST, cClassTrib e alíquotas por ano"],
        ["Preços", "O imposto passa a ser “por fora” e a carga muda por setor", "Refazer a formação de preço; simular 2027 a 2033"],
        ["Contratos longos", "O preço pode precisar de reequilíbrio", "Revisar cláusulas de reajuste por mudança tributária"],
        ["Caixa", "O split payment retém o imposto no recebimento", "Projetar o fluxo de caixa com a retenção"],
        ["Compras", "O crédito depende de fornecedor que emite certo e paga", "Preferir fornecedores que geram crédito; conferir as notas recebidas"],
        ["Simples Nacional", "O cliente B2B pode preferir quem gera crédito cheio", "Avaliar o regime híbrido a cada semestre"],
        ["Faturamento", "Erro custa multa e crédito", "Treinar a equipe; conferir as notas no mesmo dia"],
      ],
      [1900, 3500, 4238]
    ),

    H2("2.17 Mitos e verdades"),
    ...table(
      ["O que se ouve", "Na verdade"],
      [
        ["“Em 2026 eu já pago CBS.”", "Em 2026 é teste. O valor é compensável com PIS/Cofins, e quem cumpre as obrigações fica dispensado de recolher **(conferir)**. Mas os campos já são obrigatórios na nota."],
        ["“A SEFAZ rejeita se a classificação estiver errada.”", "**Não.** A SEFAZ confere formato, existência do código e compatibilidade entre CST e cClassTrib. Ela **não sabe** se aquele produto, para aquele comprador, merece aquele cClassTrib. Esse é o buraco que o nosso app cobre."],
        ["“O ERP resolve sozinho.”", "O ERP calcula a partir do cadastro e da regra fiscal que alguém configurou. Cadastro errado gera nota errada, em massa."],
        ["“A alíquota vai ser 26,5%.”", "Ainda não está definida. As estimativas vão de 26,5% a 28% somando CBS e IBS."],
        ["“Simples não muda nada.”", "Muda: os clientes empresariais vão comparar o crédito que cada fornecedor gera, e existe a opção híbrida."],
        ["“Cancelou, perdeu o crédito.”", "Não exatamente. Há multas por cancelamento fora do prazo e reflexos no crédito do comprador (ver 2.14)."],
        ["“Carta de correção conserta o imposto.”", "Não. A CC-e não pode mexer em nada que altere o valor do imposto."],
      ],
      [3300, 6338]
    )
  );

  // ===== 3. Conceitos =========================================================
  const tratamentosLinhas = Object.entries(TRATAMENTOS).map(([codigo, t]) => [
    `**${codigo}**`,
    t.reducao === 100 ? "Zero" : `${t.reducao}%`,
    t.titulo,
    `Anexo ${t.anexo}, ${t.artigo}`,
    t.condicao ? { t: t.condicao, color: RED } : "—",
  ]);

  add(
    H1("3. Conceitos para emitir certo"),
    muted("Os códigos que decidem se a nota está certa, com exemplos reais da base dos anexos que já temos."),

    H2("3.1 NCM e NBS"),
    P("O **NCM** (Nomenclatura Comum do Mercosul) é o código de **8 dígitos** que classifica cada mercadoria. A estrutura é hierárquica:"),
    ...table(
      ["Dígitos", "Nível", "Exemplo: 1006.30.21"],
      [
        ["2", "Capítulo", "10 — Cereais"],
        ["4", "Posição", "1006 — Arroz"],
        ["6", "Subposição", "1006.30 — Arroz semibranqueado ou branqueado"],
        ["7 e 8", "Item e subitem", "1006.30.21 — o detalhe do tipo de arroz"],
      ],
      [1400, 2200, 6038]
    ),
    P("A **NBS** (Nomenclatura Brasileira de Serviços) é o equivalente para serviços, com **9 dígitos**, e passou a ser usada na NFS-e com a reforma."),
    label("Por que o NCM ficou tão importante"),
    P("Antes, um NCM errado afetava principalmente IPI, ICMS-ST e algumas obrigações. **Agora ele decide a alíquota do IBS/CBS**: se o NCM está num anexo, o produto pode ter 60% de redução ou alíquota zero. NCM errado leva a cClassTrib errado, imposto errado, crédito errado do comprador e multa."),
    label("Quem é responsável"),
    P("A classificação fiscal é responsabilidade do **contribuinte**. Ela segue as Regras Gerais de Interpretação do Sistema Harmonizado; em caso de dúvida, cabe Solução de Consulta à Receita. O escritório ajuda, e o app organiza, sugere e registra quem aprovou e com qual justificativa."),
    label("Erros comuns no cadastro de NCM"),
    B("NCM **genérico** (“outros”) quando existe um subitem específico, e o subitem específico às vezes é o que tem benefício."),
    B("**Copiar o NCM do fornecedor** sem conferir. O fornecedor também erra, e o produto pode ter sido transformado."),
    B("NCM **inexistente ou vencido** (a tabela muda por resoluções da Gecex), ou com menos de 8 dígitos."),
    B("Descrição **vaga** (“kit”, “diversos”, “material”), que impede conferir o enquadramento nos anexos."),
    B("O **mesmo produto com NCMs diferentes** em notas diferentes, ou o mesmo código interno usado para produtos diferentes."),
    B("**Kits e conjuntos** com itens de tratamentos diferentes."),

    H2("3.2 CFOP"),
    P("O **CFOP** (Código Fiscal de Operações e Prestações) continua existindo e diz o tipo de operação. O primeiro dígito indica a direção e o alcance:"),
    B("**5** — saída dentro do estado;"),
    B("**6** — saída para outro estado;"),
    B("**7** — saída para o exterior;"),
    B("**1, 2 e 3** — as entradas equivalentes."),
    P("Exemplos: 5102 = venda de mercadoria comprada de terceiros; 1202 = devolução de venda. O CFOP ajuda o validador a entender a operação (venda, devolução, remessa, bonificação) e a conferir se a classificação do IBS/CBS combina com ela."),

    H2("3.3 CST do IBS/CBS"),
    P("O **CST** (Código de Situação Tributária) do IBS/CBS tem **3 dígitos** e diz a “família” do tratamento. É diferente do CST do ICMS e do PIS/Cofins, que continuam na nota durante a transição."),
    ...table(
      ["CST", "Significado", "Uso típico"],
      [
        ["000", "Tributação integral", "A maioria das vendas"],
        ["010 / 011", "Alíquotas uniformes (011: reduzidas)", "Regimes específicos (ex.: setor financeiro)"],
        ["200", "Alíquota reduzida (inclui a alíquota zero)", "Produtos e serviços dos anexos: 60%, 30%, zero"],
        ["210 a 222", "Variações de redução, alíquota fixa e redução de base", "Regimes específicos **(conferir as descrições na tabela vigente)**"],
        ["400", "Isenção", "Hipóteses de isenção previstas"],
        ["410", "Imunidade e não incidência", "Exportação, entidades imunes etc."],
        ["510 / 515", "Diferimento (515: com redução)", "Operações com imposto diferido"],
        ["550", "Suspensão", "Regimes aduaneiros e similares"],
        ["620", "Tributação monofásica", "Combustíveis"],
        ["800", "Transferência de crédito", "Sucessão, cooperativas"],
        ["810 / 811", "Ajustes", "ZFM e outros ajustes"],
        ["820", "Tributação em declaração de regime específico", "Setores com declaração própria"],
        ["830", "Exclusão de base de cálculo", "Hipóteses de exclusão **(conferir)**"],
      ],
      [1300, 4000, 4338]
    ),
    muted("Lista resumida. As fontes divergem em alguns códigos e descrições; o sistema usa sempre a tabela oficial vigente (Informe Técnico 2025.002), versionada."),

    H2("3.4 cClassTrib — a classificação tributária"),
    P("O **cClassTrib** é o código de **6 dígitos** que diz exatamente **qual hipótese da lei** se aplica ao item. Os 3 primeiros dígitos são o CST, e os 3 últimos, a hipótese dentro dele. Exemplos:"),
    B("**000001** = CST 000 + situação tributada integralmente;"),
    B("**200003** = CST 200 + Cesta Básica Nacional (Anexo I, alíquota zero)."),
    P("A tabela oficial tem cerca de 160 a 170 códigos e muitas versões; a v1.60 é de 23/06/2026 e a v1.70 de 01/10/2026 **(conferir)**. Cada linha da tabela determina:"),
    B("a **descrição e o artigo** da LC 214 que fundamentam o código;"),
    B("o **percentual de redução** do IBS e da CBS (ex.: 60%, 100%);"),
    B("quais **grupos da nota** são obrigatórios, permitidos ou proibidos (redução, diferimento, crédito presumido, tributação regular…);"),
    B("em quais **documentos** pode ser usado (NF-e, NFC-e, NFS-e, CT-e…);"),
    B("as **datas de vigência** (início e fim)."),
    label(`Os ${Object.keys(TRATAMENTOS).length} códigos de redução e alíquota zero que já temos na base`),
    ...table(["cClassTrib", "Redução", "Tratamento", "Base legal", "Condição"], tratamentosLinhas, [1100, 900, 3238, 1900, 2500], { size: 16 }),
    ...callout("O que a SEFAZ confere — e o que ela não confere", [
      "**Confere:** se o cClassTrib existe na tabela vigente; se é compatível com o CST; se pode ser usado naquele modelo de documento. Os erros correspondentes são as rejeições 1023, 1024 e 1025 **(conferir os números na NT)**.",
      "**Não confere:** se aquele produto, naquela operação, para aquele comprador, **merece** aquele cClassTrib. Uma seringa vendida a hospital privado com o código de alíquota zero do SUS (200005) passa na SEFAZ, mas está errada: o correto é 200030 (redução de 60%).",
      "**Esse buraco é o valor do nosso produto.**",
    ], { fill: GREEN_BG, color: GREEN }),

    H2("3.5 cCredPres — crédito presumido"),
    P("O **cCredPres** é o código do **crédito presumido** de IBS/CBS. É usado em casos como:"),
    B("compra de produtor rural não contribuinte;"),
    B("compra de resíduos e materiais recicláveis de pessoa física;"),
    B("Zona Franca de Manaus."),
    P("A tabela oficial vem junto com a do cClassTrib. O validador confere se o crédito presumido só aparece quando previsto e se o código combina com a operação."),

    H2("3.6 Os campos de IBS/CBS na NF-e"),
    P("Na NF-e e na NFC-e, cada item ganhou um grupo de IBS/CBS (grupo UB da NT 2025.002). Os principais campos e o que o validador faz com cada um:"),
    ...table(
      ["Campo", "O que é", "O que conferimos"],
      [
        ["CST", "Situação tributária do IBS/CBS (3 dígitos)", "Existe na tabela; combina com o cClassTrib"],
        ["cClassTrib", "Classificação tributária (6 dígitos)", "Existe, está vigente, combina com o CST e o documento; **é o correto pela matriz**"],
        ["vBC", "Base de cálculo", "É o valor da operação pelas regras do art. 12 (ver 3.8)"],
        ["pIBSUF / vIBSUF", "Alíquota e valor do IBS estadual", "Alíquota do ano; valor = base × alíquota efetiva"],
        ["pIBSMun / vIBSMun", "Alíquota e valor do IBS municipal", "Idem"],
        ["vIBS", "Total do IBS do item", "Soma estadual + municipal"],
        ["pCBS / vCBS", "Alíquota e valor da CBS", "Alíquota do ano; valor = base × alíquota efetiva"],
        ["gRed (pRedAliq, pAliqEfet)", "Redução de alíquota", "Percentual igual ao previsto para o cClassTrib; alíquota efetiva calculada certo"],
        ["gDif", "Diferimento", "Só aparece com CST de diferimento"],
        ["gDevTrib", "Devolução de tributos (cashback)", "Só quando aplicável"],
        ["gCredPres", "Crédito presumido (cCredPres, percentual, valor)", "Só quando previsto"],
        ["gTribRegular", "Como seria a tributação regular", "Exigido em algumas hipóteses"],
        ["gTribCompraGov", "Compras governamentais", "Destinatário é ente público"],
        ["IBSCBSTot", "Totais da nota", "Soma dos itens"],
        ["finNFe, tpNFCredito, tpNFDebito, NFref", "Finalidade, tipos de crédito/débito, nota referenciada", "Coerência com a operação e referência à nota original"],
      ],
      [2600, 3200, 3838]
    ),
    muted("Os nomes dos campos seguem a NT 2025.002 e mudam entre versões. A implementação usa a versão vigente e guarda qual versão foi usada em cada conferência (conferir)."),

    H2("3.7 NFS-e nacional"),
    P("Os serviços usam a **NFS-e nacional** (a DPS, declaração de prestação de serviço, vira NFS-e no Ambiente de Dados Nacional, o ADN). Com a reforma, ela ganhou o grupo IBSCBS, com CST, cClassTrib e valores, e dois elementos importantes:"),
    B("**cIndOp** — indicador da operação, 6 dígitos (Anexo VII). Define, entre outras coisas, o **local da incidência**: para qual município e estado vai o IBS."),
    B("**Anexo VIII** — relaciona o item da lista de serviços × NBS × cClassTrib × cIndOp. Ou seja, **o próprio governo publica uma “matriz” dos serviços**, que o app usa como base."),
    P("O destaque na NFS-e é obrigatório desde 01/10/2026, sem rejeição por falta do grupo até 31/12/2026 **(conferir)**."),

    H2("3.8 Base de cálculo"),
    P("Pelo art. 12 da LC 214, a base é o **valor da operação**:"),
    B("**Entram:** o preço, o frete, o seguro, os juros, as multas, os encargos e outras despesas cobradas do comprador."),
    B("**Não entram:** o próprio IBS e a CBS; o IPI; os **descontos incondicionais**, que precisam constar na nota."),
    B("**Desconto condicional** (que depende de evento futuro, como pagar em dia) **continua na base**."),
    B("**ICMS, ISS, PIS e Cofins durante a transição:** as fontes divergem sobre a exclusão em cada ano, e a NT traz uma fórmula própria de validação **(conferir)**. No app, isso fica como **parâmetro por ano**, definido pelo escritório."),

    H2("3.9 Como calcular — exemplos"),
    P("A fórmula do item:"),
    B("**alíquota efetiva** = alíquota × (1 − redução);"),
    B("**valor** = base × alíquota efetiva, com arredondamento em 2 casas."),
    P("Exemplos com base de R$ 10.000,00:"),
    ...table(
      ["Cenário", "Classificação", "CBS", "IBS (UF + Mun)", "Total"],
      [
        ["2026 — tributação integral", "CST 000 / 000001", "0,9% → R$ 90,00", "0,1% + 0% → R$ 10,00", "**R$ 100,00**"],
        ["2026 — redução de 60%", "CST 200 / 200030", "0,36% → R$ 36,00", "0,04% → R$ 4,00", "**R$ 40,00**"],
        ["2026 — alíquota zero", "CST 200 / 200003", "R$ 0,00", "R$ 0,00", "**R$ 0,00**"],
        ["2027 (CBS ilustrativa de 9%) — integral", "CST 000 / 000001", "9,0% → R$ 900,00", "0,05% + 0,05% → R$ 10,00", "**R$ 910,00**"],
        ["2027 (CBS ilustrativa de 9%) — 60%", "CST 200 / 200030", "3,6% → R$ 360,00", "0,02% + 0,02% → R$ 4,00", "**R$ 364,00**"],
      ],
      [2600, 1800, 1800, 2038, 1400]
    ),
    muted("Em 2026 o IBS de teste é de 0,1%, estadual, e o municipal fica zerado (conferir). A CBS de 2027 depende da alíquota de referência ainda não publicada; o 9% é só para ilustrar."),
    P("Leitura do exemplo: em 2027, **classificar uma seringa como 200005 (zero) em vez de 200030 (60%)** para um hospital privado deixa de destacar cerca de **R$ 364 a cada R$ 10 mil** vendidos. Somando todas as notas do mês, isso vira autuação com multa."),

    H2("3.10 Matriz fiscal"),
    P("A **matriz fiscal** é o “gabarito” fiscal da empresa. É uma tabela de regras que diz, para cada combinação de:"),
    B("**o quê** — produto ou serviço, pelo NCM/NBS e pela descrição;"),
    B("**qual operação** — venda, devolução, bonificação, remessa, transferência…;"),
    B("**para quem** — empresa do regime regular, Simples, consumidor final, órgão público, entidade imune/SUS, exterior;"),
    B("**de onde para onde** — dentro do estado, para outro estado, exterior;"),
    B("**quando** — a regra vale a partir de uma data e pode mudar ano a ano na transição;"),
    P("…qual deve ser o resultado na nota:"),
    B("CFOP;"),
    B("CST e cClassTrib do IBS/CBS;"),
    B("redução e crédito presumido;"),
    B("os tributos antigos durante a transição (ICMS, PIS/Cofins, IPI);"),
    B("as observações obrigatórias."),
    P("Exemplo de matriz de uma empresa fictícia, a Distribuidora Exemplo (São Paulo, Lucro Presumido):"),
    ...table(
      ["Produto (NCM)", "Operação", "Destinatário", "CFOP", "CST", "cClassTrib", "Redução", "Observação"],
      [
        ["Arroz 5 kg (1006.30.21)", "Venda", "Qualquer", "5102 / 6102", "200", "200003", "Zero", "Cesta Básica — Anexo I, item 1"],
        ["Sabonete 90 g (3401.11.90)", "Venda", "Qualquer", "5102 / 6102", "200", "200035", "60%", "Higiene — Anexo VIII, item 1"],
        ["Seringa com agulha (9018.31.19)", "Venda", "Empresa ou consumidor", "5102 / 6102", "200", "200030", "60%", "Dispositivo médico — Anexo IV, item 59"],
        ["Seringa com agulha (9018.31.19)", "Venda", { t: "Órgão público ou entidade SUS com CEBAS", color: RED }, "5102 / 6102", "200", "200005", "Zero", "Art. 144, II — exige comprovar o perfil do comprador"],
        ["Notebook (8471.30.12)", "Venda", "Qualquer", "5102 / 6102", "000", "000001", "—", "Sem benefício"],
        ["Qualquer item", "Devolução de venda", "—", "1202 / 2202", "Igual à original", "Igual à original", "Igual", "Alíquotas da operação original"],
      ],
      [1700, 900, 1500, 1000, 700, 1000, 838, 2000],
      { size: 15 }
    ),
    muted("Enquadramentos dos anexos conferidos com a base da Calculadora da Receita (pasta nota-certa/dados). Os NCMs de 8 dígitos são exemplos ilustrativos."),
    P("**Quem monta a matriz:** o escritório, com a ajuda do app. O app sugere a regra a partir do NCM e do questionário de operações, e o escritório revisa e aprova. **A matriz aprovada vira três coisas:**"),
    B("a regra que o validador usa para conferir as notas;"),
    B("a tabela de parametrização para o ERP do cliente;"),
    B("o “manual de emissão” do pessoal do faturamento.")
  );

  // ===== 4. Onde os erros nascem =============================================
  add(
    H1("4. Onde os erros nascem"),
    P("Quase nenhum erro nasce na hora de apertar “emitir”. Ele nasce antes, num cadastro, e se repete em todas as notas seguintes. **Por isso o app precisa agir primeiro nos cadastros e na parametrização**, e só depois conferir as notas."),
    ...table(
      ["Onde nasce", "Erro típico", "Consequência", "Como o app evita"],
      [
        ["**1. Cadastro do produto**", "NCM genérico, errado ou vencido; descrição vaga", "cClassTrib errado em todas as notas daquele produto", "Valida o NCM, mostra a descrição oficial, sugere o anexo e exige aprovação do escritório"],
        ["**2. Parametrização do ERP**", "Regra fiscal sem cClassTrib ou com o código errado; alíquota do ano errada", "Erro em massa", "Tabela pronta para o ERP gerada da matriz aprovada; conferência das primeiras notas"],
        ["**3. Cadastro do comprador**", "Órgão público cadastrado como empresa comum; UF ou município errados; Simples tratado como regular", "Benefício condicionado usado errado; IBS para o lugar errado", "Perfil automático pelo CNPJ (natureza jurídica, Simples, endereço) e alertas"],
        ["**4. Na hora de emitir**", "Operação errada (venda × bonificação × remessa); desconto condicional como incondicional; frete fora da base", "Base e valores errados", "Assistente “como a nota deve ficar” e pré-conferência"],
        ["**5. Depois de emitir**", "Erro não percebido dentro do prazo", "Cancelamento com multa, nota de crédito ou débito, apuração errada", "Conferência do XML no mesmo dia e relógio do prazo de cancelamento"],
        ["**6. Mudança de regra**", "Tabela de cClassTrib nova; fim de vigência de um código; alíquota nova", "Código rejeitado ou fora da regra", "Tabelas versionadas e aviso dos produtos e clientes afetados"],
      ],
      [1900, 2500, 2300, 2938]
    ),
    ...callout("Princípio do produto", [
      "**Prevenir na origem, conferir logo depois, corrigir dentro do prazo.**",
      "Cada erro encontrado numa nota vira uma tarefa de “corrigir a origem”: ajustar o cadastro do produto, do comprador ou a regra do ERP. Assim o mesmo erro não se repete na nota seguinte.",
    ], { fill: GREEN_BG, color: GREEN })
  );

  // ===== 5. Como o app funcionaria ===========================================
  add(
    H1("5. Como o app funcionaria"),
    muted("Ideias de produto: telas, jornadas passo a passo e esboços. Nada aqui está fechado. É o ponto de partida para decidirmos juntos."),

    H2("5.1 Visão geral: uma base, três momentos"),
    ...table(
      ["Momento", "O que acontece", "Telas"],
      [
        ["**Antes** (implantação e cadastros)", "Cadastro fiscal da empresa, catálogo de produtos com NCM conferido, perfil dos compradores, matriz aprovada, tabela para o ERP", "Empresa · Produtos · Compradores · Matriz"],
        ["**Na hora** (emitir)", "O faturamento consulta o assistente e recebe o espelho da nota; opcionalmente confere a pré-visualização do ERP antes de transmitir", "Assistente de emissão · Consulta rápida"],
        ["**Depois** (conferir)", "Os XMLs autorizados são conferidos no mesmo dia. Erros dentro do prazo viram alerta de cancelamento; fora do prazo, nota de crédito ou débito", "Conferir XML · Notas · Pendências · Carteira"],
      ],
      [2400, 4838, 2400]
    ),

    H2("5.2 Mapa de telas"),
    ...table(
      ["Tela", "Para que serve", "Quem usa"],
      [
        ["**Início da empresa**", "Semáforo da empresa: % de produtos aprovados, notas conferidas no mês, erros abertos, prazos de cancelamento correndo", "Escritório e cliente"],
        ["**Cadastro fiscal**", "Regime, CRT, UF/município, CNAE, operações que a empresa faz, perfis de comprador, documentos que emite, ERP usado, prazo de cancelamento da UF, opção do Simples", "Escritório edita; cliente vê"],
        ["**Produtos e serviços**", "Catálogo com NCM/NBS validado, sugestão do enquadramento, status (rascunho → em revisão → aprovado) e histórico", "Cliente cadastra; escritório aprova"],
        ["**Compradores**", "Perfil tributário dos clientes do cliente (regular, Simples, consumidor, órgão público, imune/CEBAS, exterior), preenchido pelo CNPJ", "Ambos"],
        ["**Matriz fiscal**", "As regras produto × operação × comprador → CFOP/CST/cClassTrib, com versões e vigência; exporta para o ERP e gera o manual de emissão em PDF", "Escritório monta; cliente consulta"],
        ["**Assistente de emissão**", "Passo a passo antes de emitir; resultado “como a nota deve ficar”", "Faturamento do cliente e escritório"],
        ["**Consulta rápida**", "“Qual cClassTrib uso para este produto e este comprador?” — busca por nome, código ou NCM; funciona no celular", "Todos"],
        ["**Conferir XML**", "Upload de XMLs/ZIP e resultado por nota", "Ambos"],
        ["**Notas**", "Histórico das notas conferidas, com filtros, status e ações", "Ambos"],
        ["**Pendências**", "Tudo o que precisa de ação: cancelar no prazo, emitir nota de crédito ou débito, corrigir um cadastro, aprovar um produto", "Ambos"],
        ["**Carteira**", "Todos os clientes: risco, erros, produtos pendentes, prazos correndo, nota de conformidade", "Escritório"],
        ["**Tabelas oficiais**", "Versões de cClassTrib, NCM, NBS e cIndOp; aviso do que mudou e de quem é afetado", "Escritório (administração)"],
      ],
      [2200, 5338, 2100]
    ),

    H2("5.3 Jornada 1 — Implantar um cliente (escritório)"),
    ...steps([
      "**Cadastrar a empresa pelo CNPJ.** O app busca os dados públicos (razão social, CNAE, endereço, Simples) e o escritório completa regime e CRT.",
      "**Responder o questionário de operações.** Vende para quem (empresas, consumidor final, governo, hospitais, exterior)? Vende para outros estados? Presta serviço? Faz devolução, bonificação, remessa para conserto, transferência entre filiais? Qual ERP usa?",
      "**Importar os produtos**, por planilha exportada do ERP ou pelos XMLs de venda dos últimos meses. O app extrai produto, NCM, CFOPs usados e compradores.",
      "**Revisar as sugestões.** O app classifica cada item em verde (sem benefício ou benefício claro), amarelo (benefício que depende da descrição ou do comprador) ou vermelho (NCM inválido, vencido ou inconsistente). O escritório revisa os amarelos e os vermelhos.",
      "**Aprovar a matriz.** O app monta as regras a partir do catálogo e do questionário, e o escritório revisa e aprova a versão 1.",
      "**Entregar ao cliente:** a tabela de parametrização do ERP (planilha), o manual de emissão (PDF) e o acesso ao app por e-mail.",
      "**Conferir as primeiras notas** emitidas depois da parametrização, para ver se o ERP ficou certo.",
    ]),

    H2("5.4 Jornada 2 — Cadastrar um produto sem erro"),
    P("Esta é a parte mais importante para **o usuário não errar**. O cadastro do produto é feito uma vez e vale para todas as notas."),
    ...steps([
      "O cliente digita o nome do produto e o NCM, ou busca o NCM pelo nome.",
      "**O app valida o NCM:** tem 8 dígitos, existe na tabela oficial e está vigente. Se não estiver, mostra os códigos válidos mais próximos.",
      "**O app mostra a descrição oficial do NCM** e pergunta: “confere com o seu produto?”. Este é o momento em que a maioria dos erros é pega.",
      "**O app mostra o enquadramento na LC 214:** em qual anexo e item o NCM aparece, com o texto do item, a redução e as condições. Ex.: “Anexo IV, item 59 — Seringas, mesmo com agulhas: 60% de redução; se vender para órgão público ou entidade SUS, alíquota zero”.",
      "Se o item do anexo depende da descrição, o app pergunta **“o seu produto é exatamente isto?”** e guarda a resposta como justificativa.",
      "**Compara com o NCM das notas de compra** desse produto, quando houver: se o fornecedor usa outro NCM, o app avisa para conferir.",
      "O cliente envia para aprovação ou marca **“não tenho certeza”**, e o item vai para a fila do escritório com prioridade.",
      "**O escritório aprova** (ou corrige) e o produto fica liberado. A tabela do ERP é atualizada com o item novo, e tudo fica no histórico: quem cadastrou, quem aprovou, quando e por quê.",
    ]),
    P("Produto não aprovado aparece em **amarelo** no assistente e na conferência de XML, sem bloquear o trabalho, mas sempre visível."),
    ...tela("Nota Certa › Produtos › Novo produto", [
      [{ t: ["**Descrição**", "Seringa descartável 10 ml com agulha"], span: 6 }, { t: ["**Código interno**", "SER-010"], span: 3 }, { t: ["**Unidade**", "UN"], span: 3 }],
      [{ t: ["**NCM**", "9018.31.19"], span: 3 }, { t: ["✓ 8 dígitos · existe na tabela · vigente"], span: 4, fill: GREEN_BG, color: GREEN }, { t: ["**Subposição 9018.31:** Seringas, mesmo com agulhas", "Confere com o seu produto?   [ Sim ]   [ Não sei ]"], span: 5 }],
      [{ t: ["**Enquadramento na LC 214** — Anexo IV, item 59: “Seringas, mesmo com agulhas”", "• Venda em geral: **redução de 60%** → CST 200 · cClassTrib **200030**", "• Venda a órgão público ou entidade de saúde imune com CEBAS (SUS): **alíquota zero** → cClassTrib **200005**"], span: 12, fill: BLUE_BG }],
      [{ t: ["**Notas de compra:** o fornecedor usa o NCM 9018.31.19 ✓ (igual)"], span: 6 }, { t: ["**Status:** aguardando aprovação do escritório"], span: 6, fill: YELLOW_BG, color: YELLOW }],
      [{ t: "[ Salvar rascunho ]      [ Enviar para aprovação ]", span: 12, align: AlignmentType.RIGHT, bold: true }],
    ]),

    H2("5.5 Jornada 3 — Perfil dos compradores"),
    P("Vários benefícios dependem de **quem compra**. Por isso o app mantém o perfil tributário de cada comprador do cliente:"),
    B("**Pelo CNPJ**, a consulta pública traz a natureza jurídica: os códigos que começam com 1 são administração pública. Também traz a opção pelo Simples e o endereço."),
    B("**Entidade imune com CEBAS (SUS)** não aparece no CNPJ. O cliente marca e anexa o comprovante, e o escritório valida."),
    B("Os compradores podem ser **importados dos XMLs** de venda, e o perfil fica salvo para as próximas notas."),
    B("O perfil alimenta o assistente e o validador. Ex.: o comprador é hospital privado, então 200005 é erro."),

    H2("5.6 Jornada 4 — Emitir uma nota com o assistente"),
    P("Para o pessoal do faturamento consultar **antes** de emitir no ERP. O app **não emite a nota** (não é um emissor): ele diz como a nota deve sair."),
    ...steps([
      "**Operação:** venda, devolução, bonificação, remessa, transferência…",
      "**Comprador:** busca pelo nome ou CNPJ, e o perfil vem pronto.",
      "**Itens:** pelo código interno, nome ou NCM, com quantidade e preço.",
      "**Valores:** frete, seguro e despesas cobradas; desconto **incondicional** (sai da base) ou **condicional** (fica na base).",
      "**Resultado “como a nota deve ficar”:** para cada item, CFOP, CST, cClassTrib, base, alíquotas e valores, mais os totais e as observações que devem constar.",
      "**Alertas** explicando o porquê de cada ponto de atenção.",
      "**Ações:** copiar os valores, baixar o espelho em PDF e, numa segunda fase, colar ou enviar o XML de pré-visualização do ERP para conferir antes de transmitir.",
      "Depois de emitida, o XML volta (por upload ou automaticamente) e é conferido contra o espelho.",
    ]),
    ...tela("Assistente de emissão — passo 5 de 5: como a nota deve ficar", [
      [{ t: ["**Operação**", "Venda de mercadoria"], span: 3 }, { t: ["**Comprador**", "Hospital Exemplo Ltda — empresa privada, regime regular, SP"], span: 6 }, { t: ["**Documento**", "NF-e 55 · dentro do estado"], span: 3 }],
      [
        { t: "Item", span: 3, bold: true, fill: LIGHT },
        { t: "NCM", span: 2, bold: true, fill: LIGHT },
        { t: "CFOP", span: 1, bold: true, fill: LIGHT },
        { t: "CST", span: 1, bold: true, fill: LIGHT },
        { t: "cClassTrib", span: 1, bold: true, fill: LIGHT },
        { t: "Base", span: 2, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "CBS", span: 1, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "IBS", span: 1, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
      ],
      [
        { t: "Seringa 10 ml com agulha", span: 3 },
        { t: "9018.31.19", span: 2 },
        { t: "5102", span: 1 },
        { t: "200", span: 1 },
        { t: "200030", span: 1, bold: true },
        { t: "10.000,00", span: 2, align: AlignmentType.RIGHT },
        { t: "36,00", span: 1, align: AlignmentType.RIGHT },
        { t: "4,00", span: 1, align: AlignmentType.RIGHT },
      ],
      [
        { t: "Sabonete 90 g", span: 3 },
        { t: "3401.11.90", span: 2 },
        { t: "5102", span: 1 },
        { t: "200", span: 1 },
        { t: "200035", span: 1, bold: true },
        { t: "2.000,00", span: 2, align: AlignmentType.RIGHT },
        { t: "7,20", span: 1, align: AlignmentType.RIGHT },
        { t: "0,80", span: 1, align: AlignmentType.RIGHT },
      ],
      [
        { t: "Notebook", span: 3 },
        { t: "8471.30.12", span: 2 },
        { t: "5102", span: 1 },
        { t: "000", span: 1 },
        { t: "000001", span: 1, bold: true },
        { t: "5.000,00", span: 2, align: AlignmentType.RIGHT },
        { t: "45,00", span: 1, align: AlignmentType.RIGHT },
        { t: "5,00", span: 1, align: AlignmentType.RIGHT },
      ],
      [{ t: "**Totais (2026, alíquotas de teste):** base R$ 17.000,00 · CBS R$ 88,20 · IBS R$ 9,80", span: 12 }],
      [{ t: ["⚠ **Atenção:** o comprador é hospital **privado**. A alíquota zero do Anexo IV (200005) só vale para órgão público ou entidade SUS com CEBAS — use **200030** (redução de 60%)."], span: 12, fill: YELLOW_BG, color: YELLOW }],
      [{ t: "[ Copiar valores ]    [ Baixar espelho em PDF ]    [ Conferir XML de pré-visualização ]", span: 12, align: AlignmentType.RIGHT, bold: true }],
    ]),

    H2("5.7 Jornada 5 — Conferir XMLs"),
    ...steps([
      "Arrastar os arquivos: XMLs soltos ou um ZIP com centenas de notas.",
      "O app lê cada nota, identifica a empresa pelo CNPJ do emitente e aplica as regras (capítulo 6).",
      "**Resultado por nota:** verde (correta), amarelo (alerta: conferir) ou vermelho (erro).",
      "**Para cada erro:** o que está errado, qual seria o certo, a diferença em reais e **o relógio do prazo de cancelamento**.",
      "**Ação recomendada:** cancelar e reemitir, nota de crédito, nota de débito, nota complementar, ou só ajustar o cadastro para as próximas.",
      "**“Corrigir na origem”:** com um clique, o erro vira pendência de ajustar o cadastro do produto, do comprador ou a regra do ERP.",
      "Relatório em PDF ou Excel para enviar ao cliente.",
    ]),
    ...tela("Conferir XML — 248 notas de outubro/2026 · Distribuidora Exemplo", [
      [
        { t: "✓ **231** corretas", span: 3, fill: GREEN_BG, color: GREEN },
        { t: "! **12** com alerta", span: 3, fill: YELLOW_BG, color: YELLOW },
        { t: "✗ **5** com erro", span: 3, fill: RED_BG, color: RED },
        { t: "⏱ **2** ainda dá para cancelar", span: 3, fill: BLUE_BG, color: BLUE },
      ],
      [
        { t: "Nota", span: 1, bold: true, fill: LIGHT },
        { t: "Emissão", span: 2, bold: true, fill: LIGHT },
        { t: "Comprador", span: 2, bold: true, fill: LIGHT },
        { t: "O que achamos", span: 4, bold: true, fill: LIGHT },
        { t: "O que fazer", span: 3, bold: true, fill: LIGHT },
      ],
      [
        { t: "1.245", span: 1 },
        { t: "26/10 09:12", span: 2 },
        { t: "Prefeitura de Exemplo", span: 2 },
        { t: "✗ cClassTrib 200030 (60%); o comprador é órgão público: **200005** (zero)", span: 4, color: RED },
        { t: "**Cancelar e reemitir** — faltam 14 h", span: 3, fill: BLUE_BG },
      ],
      [
        { t: "1.238", span: 1 },
        { t: "24/10 16:40", span: 2 },
        { t: "Mercado Bom Preço", span: 2 },
        { t: "✗ Arroz com 000001 (integral); é Cesta Básica: **200003** (zero)", span: 4, color: RED },
        { t: "Prazo vencido: **nota de crédito** + corrigir o cadastro", span: 3 },
      ],
      [
        { t: "1.230", span: 1 },
        { t: "23/10 11:05", span: 2 },
        { t: "Hospital Exemplo", span: 2 },
        { t: "! Produto “Luva nitrílica” ainda não aprovado no catálogo", span: 4, color: YELLOW },
        { t: "Aprovar o produto", span: 3 },
      ],
      [
        { t: "1.227", span: 1 },
        { t: "23/10 08:30", span: 2 },
        { t: "Consumidor final", span: 2 },
        { t: "✗ Base sem o frete cobrado (R$ 50,00): IBS/CBS a menor", span: 4, color: RED },
        { t: "Nota complementar + ajustar o ERP", span: 3 },
      ],
    ]),

    H2("5.8 Jornada 6 — A rotina do escritório"),
    B("**Todo dia:** notas com erro **ainda dentro do prazo de cancelamento** (prioridade máxima, com e-mail ou WhatsApp para o cliente)."),
    B("**Toda semana:** fila de produtos para aprovar e clientes com mais erros."),
    B("**Todo mês, antes de fechar a apuração assistida:** relatório de conformidade por cliente e, no futuro, cruzamento com a apuração pré-pronta."),
    B("**Quando uma tabela oficial muda:** o app avisa algo como “a nova versão do cClassTrib afeta 3 clientes e 27 produtos” e mostra quais."),
    ...tela("Carteira — conformidade das notas · outubro/2026", [
      [
        { t: "Cliente", span: 3, bold: true, fill: LIGHT },
        { t: "Notas", span: 1, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "Erros", span: 1, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "Alertas", span: 1, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "Produtos a aprovar", span: 2, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "Prazo correndo", span: 2, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
        { t: "Conformidade", span: 2, bold: true, fill: LIGHT, align: AlignmentType.RIGHT },
      ],
      [
        { t: "Distribuidora Exemplo", span: 3 },
        { t: "248", span: 1, align: AlignmentType.RIGHT },
        { t: "5", span: 1, align: AlignmentType.RIGHT, color: RED },
        { t: "12", span: 1, align: AlignmentType.RIGHT },
        { t: "3", span: 2, align: AlignmentType.RIGHT },
        { t: "⏱ 2", span: 2, align: AlignmentType.RIGHT, fill: BLUE_BG },
        { t: "92%", span: 2, align: AlignmentType.RIGHT, fill: GREEN_BG, color: GREEN },
      ],
      [
        { t: "Clínica Exemplo (serviços)", span: 3 },
        { t: "61", span: 1, align: AlignmentType.RIGHT },
        { t: "0", span: 1, align: AlignmentType.RIGHT },
        { t: "2", span: 1, align: AlignmentType.RIGHT },
        { t: "0", span: 2, align: AlignmentType.RIGHT },
        { t: "—", span: 2, align: AlignmentType.RIGHT },
        { t: "97%", span: 2, align: AlignmentType.RIGHT, fill: GREEN_BG, color: GREEN },
      ],
      [
        { t: "Mercadinho Exemplo (Simples)", span: 3 },
        { t: "1.310", span: 1, align: AlignmentType.RIGHT },
        { t: "41", span: 1, align: AlignmentType.RIGHT, color: RED },
        { t: "88", span: 1, align: AlignmentType.RIGHT },
        { t: "57", span: 2, align: AlignmentType.RIGHT },
        { t: "⏱ 9", span: 2, align: AlignmentType.RIGHT, fill: BLUE_BG },
        { t: "71%", span: 2, align: AlignmentType.RIGHT, fill: YELLOW_BG, color: YELLOW },
      ],
    ], "Esboço ilustrativo com empresas e números fictícios."),

    H2("5.9 Mais ideias"),
    ...table(
      ["Ideia", "Valor", "Quando"],
      [
        ["**Tabela para o ERP** nos formatos dos ERPs mais usados pelos clientes (começando por planilha genérica)", "Corrige a origem do erro em massa", "Fase 2"],
        ["**Manual de emissão em PDF** por cliente (“para vender X para Y, use…”)", "Treina o faturamento e fica na mesa de quem emite", "Fase 2"],
        ["**Relógio do prazo de cancelamento** com alerta por e-mail ou WhatsApp", "Evita a multa de 33% ou 66%", "Fase 4"],
        ["**Conformidade de 0 a 100%** por cliente e por mês", "Mostra o valor do escritório; argumento comercial", "Fase 4"],
        ["**Consulta rápida no celular**: “posso usar este código?”", "Tira a dúvida na hora", "Fase 3"],
        ["**Conferir as notas de compra** (entradas): o fornecedor destacou certo?", "Protege o crédito do cliente (principalmente no Lucro Real)", "Fase 4"],
        ["**Simulação 2027**: “como ficaria esta nota em 2027”", "Prepara preço e caixa", "Fase 3"],
        ["**IA para sugerir o NCM pela descrição** e explicar em linguagem simples, sempre com revisão humana. A chave da IA fica guardada como segredo no servidor, nunca no navegador", "Agiliza a implantação de catálogos grandes", "Fase 5"],
        ["**API de pré-validação** para o ERP do cliente chamar antes de transmitir", "Bloqueia o erro antes de existir", "Fase 5"],
        ["**Cruzamento com a apuração assistida**", "Fecha o ciclo: nota × apuração", "Fase 5"],
        ["**Mini treinamento** para o faturamento (casos e perguntas)", "Menos erro humano", "Quando quiser"],
        ["**Base de conhecimento**: cada cClassTrib explicado com exemplos", "Autonomia do cliente", "Fase 3"],
      ],
      [4600, 3438, 1600]
    )
  );

  // ===== 6. Regras ============================================================
  const REGRAS = [
    ["E01", "Estrutura", "XML válido, assinado, autorizado (protocolo) e com chave de acesso correta", "Erro", "Arquivo não é uma NF-e autorizada válida"],
    ["E02", "Estrutura", "Grupo IBS/CBS presente quando obrigatório (regime regular desde 03/08/2026 na NF-e; Simples a partir de 2027)", "Alerta em 2026, erro a partir de 2027", "Item sem o grupo IBS/CBS"],
    ["E03", "Estrutura", "CST existe na tabela vigente na data de emissão", "Erro", "CST 999 não existe"],
    ["E04", "Estrutura", "cClassTrib existe e está vigente na data de emissão", "Erro", "cClassTrib fora de vigência em 15/10/2026"],
    ["E05", "Estrutura", "CST compatível com o cClassTrib (3 primeiros dígitos)", "Erro", "CST 000 com cClassTrib 200030"],
    ["E06", "Estrutura", "cClassTrib permitido para o modelo de documento", "Erro", "Código não pode ser usado em NFC-e"],
    ["E07", "Estrutura", "Grupos obrigatórios e proibidos conforme o cClassTrib (redução, diferimento, crédito presumido…)", "Erro", "200030 exige o grupo de redução (gRed)"],
    ["M01", "Matriz", "Item existe no catálogo e está aprovado", "Alerta", "Produto “Luva nitrílica” não aprovado"],
    ["M02", "Matriz", "cClassTrib igual ao previsto na matriz para produto × operação × comprador", "Erro", "Esperado 200035, veio 000001"],
    ["M03", "Matriz", "Benefício condicionado ao comprador usado para quem não se enquadra", "Erro", "200005 para hospital privado"],
    ["M04", "Matriz", "Produto com benefício no anexo, mas nota com tributação integral", "Alerta", "Arroz com 000001: cobra imposto a mais do cliente"],
    ["M05", "Matriz", "Redução aplicada a NCM/NBS que não está em nenhum anexo", "Erro", "Redução de 60% sem base legal (risco de autuação)"],
    ["M06", "Matriz", "NCM da nota diferente do NCM do catálogo; NCM inexistente ou vencido", "Alerta", "NCM 9018.31.90 na nota; catálogo diz 9018.31.19"],
    ["M07", "Matriz", "CFOP compatível com a operação e o destino (5 dentro do estado, 6 fora, 7 exterior) e com a finalidade", "Erro", "CFOP 5102 para comprador de outro estado"],
    ["M08", "Matriz", "Crédito presumido (cCredPres) só quando previsto", "Alerta", "Crédito presumido sem previsão na matriz"],
    ["C01", "Cálculo", "Base = valor da operação + frete, seguro e despesas cobradas − desconto incondicional (± parâmetros da transição)", "Erro", "Base R$ 1.000,00; esperado R$ 950,00"],
    ["C02", "Cálculo", "Alíquotas de CBS, IBS estadual e IBS municipal do ano de emissão", "Erro", "pCBS 0,90 em 2027"],
    ["C03", "Cálculo", "Redução e alíquota efetiva coerentes com o cClassTrib", "Erro", "pRedAliq 40; o código prevê 60"],
    ["C04", "Cálculo", "Valor = base × alíquota efetiva (tolerância de R$ 0,01 por item)", "Erro", "vCBS 90,00; esperado 36,00"],
    ["C05", "Cálculo", "Totais da nota = soma dos itens", "Erro", "Total do IBS diverge da soma dos itens"],
    ["C06", "Cálculo", "IBS para o estado e o município de destino (relevante a partir de 2029)", "Alerta", "IBS municipal com alíquota de outro município"],
    ["C07", "Cálculo", "Conferência opcional com a Calculadora oficial da Receita", "Info", "Diferença de R$ 0,02 em relação à Calculadora"],
    ["D01", "Documento", "Finalidade (finNFe) coerente: normal, complementar, ajuste, devolução, crédito, débito", "Erro", "Devolução emitida como venda normal"],
    ["D02", "Documento", "Nota de crédito ou débito com tipo válido e nota original referenciada", "Erro", "Nota de crédito sem a nota original"],
    ["D03", "Documento", "Devolução referencia a nota original e usa a mesma classificação", "Erro", "Devolução com cClassTrib diferente da venda"],
    ["D04", "Documento", "Nota cancelada: horário do cancelamento × autorização × prazo da UF", "Alerta", "Cancelada 30 h depois (prazo da UF: 24 h)"],
    ["D05", "Documento", "Devolução de nota de outro ano usa as alíquotas da operação original", "Erro", "Devolução em 2027 de venda de 2026 com alíquotas de 2027"],
    ["P01", "Prazo", "Erro dentro do prazo de cancelamento: cancelar e reemitir, com contagem regressiva", "Ação", "Faltam 14 h para cancelar sem multa"],
    ["P02", "Prazo", "Erro fora do prazo: indicar nota de crédito, débito ou complementar", "Ação", "Emitir nota de crédito tipo 04"],
    ["P03", "Prazo", "Mercadoria já circulou: não cancelar; devolução ou nota de crédito", "Ação", "Mercadoria entregue: use nota de crédito"],
    ["R01", "Regime", "Emitente do Simples: confere a opção cadastrada (DAS ou híbrido) com o que está na nota", "Alerta", "Empresa optou pelo híbrido e a nota veio como DAS"],
    ["R02", "Regime", "Comprador do Simples (informativo): crédito limitado ao pago no DAS", "Info", "Fornecedor do Simples: crédito reduzido"],
    ["R03", "Regime", "Regimes específicos (combustíveis, financeiro, imóveis…): revisão manual", "Alerta", "Operação de regime específico"],
    ["X01", "Cruzamento", "Notas do mês × apuração assistida (quando a API estiver disponível)", "Alerta", "Nota na apuração que não está no controle"],
    ["X02", "Cruzamento", "Notas de compra: IBS/CBS destacados corretamente pelo fornecedor", "Alerta", "Fornecedor com classificação suspeita"],
  ];
  const corGravidade = (g) => (g.startsWith("Erro") ? { t: g, color: RED, bold: true } : g.startsWith("Alerta") ? { t: g, color: YELLOW, bold: true } : g === "Ação" ? { t: g, color: BLUE, bold: true } : { t: g, color: MUTED });
  add(
    H1("6. Regras de validação"),
    P("O catálogo do que o sistema confere, em camadas:"),
    B("**E** — estrutura e tabela oficial;"),
    B("**M** — matriz fiscal: a classificação certa para o produto e o comprador;"),
    B("**C** — cálculo;"),
    B("**D** — documento e eventos;"),
    B("**P** — prazo e ação;"),
    B("**R** — regime;"),
    B("**X** — cruzamentos."),
    P("As mesmas regras rodam no **assistente** (antes de emitir, sobre o espelho) e no **conferidor** (depois, sobre o XML)."),
    label("Gravidade"),
    B("**Erro:** a nota está errada e precisa de ação."),
    B("**Alerta:** pode estar errado; precisa de conferência humana."),
    B("**Ação:** o que fazer e até quando."),
    B("**Info:** só para saber."),
    ...table(["Código", "Camada", "O que confere", "Gravidade", "Exemplo de mensagem"], REGRAS.map(([c, cam, o, g, m]) => [`**${c}**`, cam, o, corGravidade(g), m]), [800, 1100, 3938, 1300, 2500], { size: 15 }),
    label("Como cada mensagem deve ser escrita"),
    B("**O que está errado**, em português simples (“o comprador é órgão público”), e não só o código."),
    B("**Qual seria o certo** e **por quê**, com o artigo ou anexo da lei."),
    B("**Quanto custa** a diferença em reais."),
    B("**O que fazer e até quando** (cancelar em 14 h; nota de crédito; ajustar o cadastro)."),
    B("**Como evitar da próxima vez** (link para o cadastro do produto ou do comprador).")
  );

  // ===== 7. Exemplos ==========================================================
  add(
    H1("7. Exemplos resolvidos"),
    muted("Valores com as alíquotas de teste de 2026, salvo indicação. Os enquadramentos foram conferidos com a base dos anexos da LC 214 (pasta nota-certa/dados)."),
    H3("Exemplo 1 — Seringa para hospital privado com o código do SUS"),
    B("**Nota:** seringas (NCM 9018.31.19), R$ 10.000,00, comprador hospital privado, cClassTrib **200005** (alíquota zero)."),
    B("**Achado:** regra M03. O 200005 (art. 144, II) só vale para órgão público ou entidade de saúde imune com CEBAS."),
    B("**Correto:** **200030** (Anexo IV, item 59, redução de 60%). CBS R$ 36,00 e IBS R$ 4,00 em 2026; em 2027 (CBS ilustrativa de 9%), cerca de R$ 364."),
    B("**Ação:** dentro do prazo, cancelar e reemitir. Fora do prazo, nota de débito ou complementar, conforme a NT **(conferir)**."),
    B("**Origem:** o perfil do comprador estava errado, ou o ERP usava 200005 para todos. Corrigir o cadastro ou a regra."),
    H3("Exemplo 2 — Arroz tributado como produto comum"),
    B("**Nota:** arroz (NCM 1006.30.21), R$ 10.000,00, cClassTrib **000001**, CBS R$ 90,00 e IBS R$ 10,00."),
    B("**Achado:** regra M04. O arroz é da Cesta Básica Nacional (Anexo I, item 1): alíquota zero, **200003**."),
    B("**Impacto:** o cliente cobrou imposto a mais do comprador. Ele perde competitividade, e o comprador fica com crédito indevido."),
    B("**Ação:** nota de crédito tipo 04 (redução de valores) e ajuste do cadastro do produto."),
    H3("Exemplo 3 — Mensalidade escolar na NFS-e"),
    B("**Nota:** NFS-e de ensino infantil (NBS 1.2201.20.00), R$ 2.000,00, cClassTrib 000001."),
    B("**Achado:** regra M04. Educação está no Anexo II (item 1, ensino infantil): redução de 60%, **200028**."),
    B("**Correto:** CBS de 2026 = 2.000 × 0,36% = R$ 7,20; IBS = 2.000 × 0,04% = R$ 0,80. Conferir também o cIndOp, que define o local do IBS."),
    H3("Exemplo 4 — Base de cálculo sem frete e com desconto mal lançado"),
    B("**Nota:** produto de R$ 1.000,00 com frete cobrado de R$ 50,00 e desconto incondicional de R$ 100,00. A nota saiu com base de R$ 1.000,00."),
    B("**Correto:** base = 1.000 + 50 − 100 = **R$ 950,00** (regra C01)."),
    B("**Se o desconto fosse condicional** (ex.: pagar até o dia 10), ele não sairia da base, e a base seria R$ 1.050,00."),
    B("**Origem:** configuração do ERP. Ajustar a regra de base."),
    H3("Exemplo 5 — Devolução em 2027 de uma venda de 2026"),
    B("**Situação:** venda em dezembro/2026 (CBS 0,9%, IBS 0,1%), devolvida em fevereiro/2027."),
    B("**Correto:** a devolução usa a mesma classificação e as **alíquotas da operação original**, e não as de 2027 (regra D05) **(conferir o dispositivo exato na LC 214/227)**."),
    B("**Risco:** estornar com 9% uma venda tributada a 0,9% gera um crédito indevido enorme, que vira autuação.")
  );

  // ===== 8. Dados e integrações ==============================================
  add(
    H1("8. Dados oficiais e integrações"),
    H2("8.1 Tabelas oficiais (versionadas por data)"),
    ...table(
      ["Tabela", "Fonte", "Uso no app"],
      [
        ["CST e cClassTrib, cCredPres", "Portal da NF-e — Informe Técnico 2025.002 (planilhas e versões)", "Regras E03 a E07, M02 a M05 e C03"],
        ["Anexos da LC 214 por NCM/NBS", "Calculadora da Receita (módulo offline) — já extraída (nota-certa/dados)", "Sugestão do enquadramento e regras M04 e M05"],
        ["NCM", "Portal Único Siscomex (Classif) e TIPI", "Validar se o NCM existe e está vigente (M06)"],
        ["NBS e correlação de serviços", "Portal da NFS-e nacional — anexos VII (cIndOp) e VIII", "Serviços: classificação e local da incidência"],
        ["CFOP", "Convênio s/nº de 1970 (tabela de CFOP)", "Regra M07"],
        ["Municípios (IBGE)", "IBGE", "Destino do IBS municipal"],
        ["Natureza jurídica (CNPJ)", "Receita Federal (dados abertos do CNPJ)", "Perfil do comprador: órgão público"],
        ["Alíquotas por ano", "LC 214 e a resolução do Senado (quando sair) — editável pelo escritório", "Regra C02"],
      ],
      [2500, 4138, 3000]
    ),
    P("Cada conferência guarda **quais versões** das tabelas foram usadas. A regra vale pela **data de emissão da nota**, não pela data da conferência."),
    H2("8.2 Calculadora oficial da Receita (RTC)"),
    B("**Calculadora online:** simulador e um **validador de XML oficial** no ambiente piloto. É bom para tirar a prova dos nossos cálculos."),
    B("**Módulo offline:** imagem Docker (cerca de 260 MB) ou JAR, com **API REST local** e documentação Swagger. Tem APIs separadas para o regime geral e para o Simples."),
    B("**Uso no app:** fonte dos dados dos anexos (já usamos) e conferência opcional dos cálculos (regra C07). Rodar o módulo offline exige um servidor; no início, basta o nosso motor e uma conferência por amostragem na calculadora online."),
    H2("8.3 De onde vêm os XMLs"),
    ...table(
      ["Fase", "Fonte", "Prós e contras"],
      [
        ["1", "**Upload manual** (XML solto ou ZIP)", "Simples, sem integração; depende de alguém enviar"],
        ["2", "Pasta compartilhada ou e-mail de recebimento por cliente", "Menos esforço para o cliente; precisa de rotina"],
        ["3", "**Distribuição DF-e da SEFAZ** com o certificado A1 do cliente", "Automático para notas recebidas (e emitidas, conforme a UF); exige guardar o certificado com muita segurança"],
        ["3", "**ADN da NFS-e nacional** (API)", "Automático para as NFS-e"],
        ["—", "Domínio (via Central) — **somente leitura**", "Já temos o resumo fiscal; ver se dá para trazer o detalhe por nota, sempre só SELECT"],
      ],
      [800, 3800, 5038]
    ),
    H2("8.4 Consulta de CNPJ"),
    P("Para montar o perfil do comprador: razão social, endereço, natureza jurídica e opção pelo Simples. Há APIs públicas gratuitas (com limite de uso) e os dados abertos da Receita. O app guarda o resultado para não consultar de novo a cada nota.")
  );

  // ===== 9. Arquitetura =======================================================
  add(
    H1("9. Como construir o app"),
    H2("9.1 Onde fica"),
    P("**Decisão (outubro de 2026): o Nota Certa será um app separado do AthosBI**, com endereço, login e banco próprios. Tudo o que é dele fica na pasta **nota-certa/** do repositório até ganhar repositório próprio."),
    P("Para ganhar tempo, ele pode usar a mesma tecnologia do AthosBI (React + Vite + Supabase, publicado na Vercel) e reaproveitar:"),
    B("a base dos anexos da LC 214 (já copiada para nota-certa/dados);"),
    B("o modelo de acesso: escritório vê todos os clientes, cliente vê só a empresa liberada para o e-mail;"),
    B("partes do motor de cálculo da Reforma (alíquotas por ano, reduções);"),
    B("no futuro, a integração com a Domínio pela Central (sempre só leitura)."),
    H2("9.2 Tabelas novas no banco (Supabase)"),
    ...table(
      ["Tabela", "O que guarda"],
      [
        ["nc_tabelas_oficiais", "Tipo (cClassTrib, NCM, NBS, cIndOp), versão, vigência, conteúdo, fonte e hash"],
        ["nc_empresa_perfil", "Perfil fiscal da empresa: regime, CRT, UF, município, CNAE, operações, ERP, prazo de cancelamento, opção do Simples"],
        ["nc_produtos", "Catálogo: código interno, descrição, NCM/NBS, unidade, status, classificação sugerida e aprovada, justificativa, quem aprovou e quando"],
        ["nc_compradores", "Perfil dos compradores: CNPJ/CPF, tipo, UF e município, origem do perfil, comprovantes"],
        ["nc_matriz", "Regras: produto ou grupo × operação × perfil do comprador × destino → CFOP, CST, cClassTrib, cCredPres, redução, observação, vigência, versão"],
        ["nc_notas", "Resumo de cada nota conferida: chave, modelo, número, emissão, autorização, valores, situação, origem, versões das tabelas"],
        ["nc_achados", "Cada achado: nota, item, regra, gravidade, mensagem, valor esperado, diferença, ação, status (aberto, resolvido, ignorado com justificativa)"],
        ["nc_historico", "Auditoria de toda mudança em produto, comprador e matriz"],
      ],
      [2600, 7038]
    ),
    P("**Permissões (RLS):** o mesmo modelo do AthosBI. O escritório vê tudo; o cliente só vê a empresa liberada para o e-mail dele. Os XMLs completos, se guardados, ficam num bucket privado com prazo de retenção."),
    H2("9.3 O motor de regras"),
    B("**JavaScript puro**, no mesmo estilo do motor da Reforma do AthosBI, com cada regra numa função pequena e testada."),
    B("Roda **no navegador**: o XML pode ser conferido sem sair do computador do usuário, o que ajuda a privacidade. O que se salva é o resumo e os achados."),
    B("O mesmo motor pode rodar **no servidor** (edge function) quando vier a automação (Distribuição DF-e, alertas)."),
    B("**Testes automáticos** com XMLs fictícios ou anonimizados, cobrindo cada regra com um caso certo e um errado. **Dados reais de clientes nunca entram no código.**"),
    B("Desempenho: mil notas por upload, conferidas em segundos."),
    H2("9.4 Privacidade e LGPD"),
    B("A nota tem dados de terceiros (compradores pessoa física)."),
    B("Guardar o mínimo necessário: o resumo, e o XML completo só se a empresa quiser, com prazo de retenção."),
    B("Certificado digital (fase 3): guardado criptografado, com acesso restrito e registro de uso."),
    B("Deixar claro no termo de uso que o app é **ferramenta de apoio** e que a responsabilidade pela emissão é do contribuinte.")
  );

  // ===== 10. Escritório x cliente ============================================
  add(
    H1("10. Versão do escritório x versão do cliente"),
    ...table(
      ["Função", "Escritório", "Cliente"],
      [
        ["Ver a carteira (todos os clientes)", "Sim", "Não"],
        ["Cadastro fiscal da empresa", "Edita", "Vê"],
        ["Produtos e serviços", "Edita e **aprova**", "Cadastra e propõe"],
        ["Compradores", "Edita e valida comprovantes (CEBAS)", "Cadastra e anexa comprovantes"],
        ["Matriz fiscal", "Monta, aprova e versiona", "Consulta e exporta"],
        ["Tabela para o ERP e manual de emissão", "Gera", "Baixa"],
        ["Assistente de emissão e consulta rápida", "Sim", "Sim"],
        ["Conferir XML", "Em lote, de todos os clientes", "Só da própria empresa"],
        ["Achados e pendências", "Trata, justifica e ignora", "Vê e marca como corrigido"],
        ["Relatórios", "Todos", "Da própria empresa"],
        ["Tabelas oficiais e parâmetros (alíquotas por ano)", "Atualiza", "—"],
        ["Alertas de prazo de cancelamento", "De todos os clientes", "Da própria empresa"],
      ],
      [4000, 2819, 2819]
    )
  );

  // ===== 11. O que precisamos ================================================
  add(
    H1("11. O que precisamos"),
    label("Do escritório"),
    B("Tomar as decisões do capítulo 13."),
    B("Escolher 3 a 5 clientes piloto e avisar a eles."),
    B("Uma pessoa de referência tributária para revisar a matriz dos pilotos e as regras amarelas."),
    B("Tempo para revisar os resultados das primeiras conferências (calibrar falsos alarmes)."),
    label("Dos clientes piloto"),
    B("20 a 50 XMLs de venda recentes (e algumas devoluções e cancelamentos, se houver)."),
    B("A lista de produtos exportada do ERP (código, descrição, NCM, unidade)."),
    B("O nome do ERP e quem cuida da parametrização."),
    B("Mais adiante: o certificado A1, se formos automatizar a captura das notas."),
    label("Técnico"),
    B("A **planilha base de trabalho** (nota-certa/planilhas) já tem a referência da LC 214 por NCM/NBS, os CFOPs mais usados e o modelo de catálogo. O que for preenchido nela vira a importação do app."),
    B("As tabelas oficiais atuais: Informe Técnico de cClassTrib e cCredPres, NCM do Siscomex e anexos VII e VIII da NFS-e."),
    B("A versão vigente da NT 2025.002 (campos e validações)."),
    B("Projeto próprio do app: repositório (ou a pasta nota-certa por enquanto), banco e login no Supabase, publicação na Vercel."),
    B("XMLs fictícios para os testes automáticos."),
    label("Conhecimento"),
    B("Ler os textos oficiais dos pontos marcados com (conferir) e registrar a conclusão do escritório em cada um.")
  );

  // ===== 12. Plano de trabalho ===============================================
  const FASES = [
    ["Fase 0 — Preparação", "1 a 2 semanas", ["Decisões do capítulo 13", "Pilotos escolhidos e XMLs coletados", "Catálogo dos pilotos na planilha base de trabalho", "Pontos (conferir) checados no texto oficial"], "Decisões registradas; XMLs fictícios ou anonimizados prontos para os testes"],
    ["Fase 1 — Conferidor de XML", "3 a 4 semanas", ["Criar o app separado: login, banco e publicação", "Upload de XML e ZIP (NF-e 55)", "Tabelas oficiais carregadas e versionadas", "Regras E, C, D e P", "Resultado por nota e relatório"], "Conferir 100% dos XMLs dos pilotos, com o resultado revisado pelo escritório; nenhum erro plantado passa como “ok”"],
    ["Fase 2 — Cadastros e matriz", "3 a 4 semanas", ["Cadastro fiscal e questionário", "Importação de produtos (planilha e XML)", "Validação de NCM, sugestão do anexo e aprovação", "Perfil dos compradores", "Matriz, regras M e tabela para o ERP"], "Um piloto com catálogo aprovado e notas conferidas contra a matriz"],
    ["Fase 3 — Assistente e versão do cliente", "2 a 3 semanas", ["Assistente de emissão e espelho em PDF", "Consulta rápida", "Acesso do cliente", "NFS-e nacional"], "O faturamento de um piloto usa o assistente por 2 semanas"],
    ["Fase 4 — Automação", "contínuo", ["Distribuição DF-e e ADN", "Alertas de prazo por e-mail ou WhatsApp", "Carteira com nota de conformidade", "NFC-e e notas de compra"], "Erros dentro do prazo avisados no mesmo dia, sem upload manual"],
    ["Fase 5 — 2027 em diante", "conforme as normas", ["Cruzamento com a apuração assistida", "Simples híbrido", "Split payment", "IA e API para ERPs"], "Definido quando as APIs e normas saírem"],
  ];
  add(
    H1("12. Plano de trabalho"),
    P("**Meta: fases 1 a 3 prontas até janeiro de 2027**, quando a CBS passa a valer de verdade e a apuração assistida passa a ter efeito. Os prazos são estimativas e dependem das decisões e do retorno dos pilotos."),
    ...table(
      ["Fase", "Duração estimada", "Entregas", "Pronta quando"],
      FASES.map(([f, d, e, p]) => [`**${f}**`, d, e.map((x) => `• ${x}`), p]),
      [2300, 1300, 3338, 2700]
    ),
    P("Por que começar pelo conferidor de XML (fase 1) se o objetivo é prevenir? Três motivos:"),
    B("ele funciona **sem cadastro nenhum**;"),
    B("ele **mostra os erros reais** dos pilotos, que dizem quais cadastros atacar primeiro;"),
    B("as mesmas regras viram a base do assistente."),
    P("Nas fases 2 e 3 o foco vira a **prevenção**.")
  );

  // ===== 13. Decisões =========================================================
  add(
    H1("13. Decisões a tomar"),
    ...table(
      ["Decisão", "Opções", "Recomendação"],
      [
        ["Onde fica o app", "Dentro do AthosBI · app separado", "**Decidido: app separado** (pasta nota-certa/ por enquanto)"],
        ["Nome do app", "Nota Certa · Conferência Fiscal · Matriz Fiscal", "Nota Certa (fala do resultado, não da ferramenta)"],
        ["Clientes piloto", "3 a 5 com perfis diferentes", "Comércio com Cesta Básica, distribuidor de saúde, prestador de serviço e um do Simples"],
        ["Documentos no início", "NF-e · NFS-e · NFC-e · CT-e", "**NF-e 55 primeiro**, depois NFS-e nacional; NFC-e na fase 4; CT-e fora"],
        ["Fonte dos XMLs", "Upload · e-mail · DF-e com certificado · Domínio", "**Upload** na fase 1; automação na fase 4"],
        ["Quem aprova produtos e matriz", "Cliente · escritório · ambos", "**Cliente propõe, escritório aprova**"],
        ["Integração com o ERP", "Planilha · formatos por ERP · API", "Planilha genérica primeiro; formatos dos ERPs mais comuns depois"],
        ["ICMS, PIS e Cofins na base (transição)", "Excluir · incluir · por ano", "Parâmetro por ano, definido pelo escritório depois de checar o texto oficial"],
        ["Guardar XML completo", "Sim · só o resumo · opcional", "Resumo sempre; XML opcional com retenção definida"],
        ["Uso de IA", "Não usar · sugerir · decidir", "Só sugerir e explicar, sempre com aprovação humana"],
        ["Modelo comercial", "Incluso no honorário · serviço adicional · por volume", "Decisão do escritório; a carteira com nota de conformidade ajuda a vender"],
        ["Termo de responsabilidade", "—", "Texto claro de ferramenta de apoio; a decisão final é do contribuinte e do escritório"],
      ],
      [2600, 3200, 3838]
    )
  );

  // ===== 14. Riscos ===========================================================
  add(
    H1("14. Riscos e cuidados"),
    ...table(
      ["Risco", "Como lidar"],
      [
        ["As regras mudam com frequência (NTs, tabelas, datas)", "Tabelas versionadas, regras por data de emissão, rotina de checagem das publicações oficiais"],
        ["Alíquota de referência ainda indefinida", "Alíquotas como parâmetro por ano; simulações claramente marcadas como ilustrativas"],
        ["Interpretações divergentes entre fontes", "Marcar “conferir”, registrar a posição do escritório e permitir “ignorar com justificativa”"],
        ["Falso alarme demais (o usuário para de ler)", "Calibrar com os pilotos; separar erro de alerta; mensagens claras"],
        ["Erro do app levar a nota errada", "Termo de responsabilidade, aprovação humana, testes automáticos por regra, conferência por amostragem na calculadora oficial"],
        ["Catálogo do cliente bagunçado", "Importação com detecção de duplicados, NCMs divergentes e descrições vagas; implantação assistida"],
        ["Prazo de cancelamento diferente por UF", "Prazo no cadastro da empresa; alerta pelo menor prazo em caso de dúvida"],
        ["Privacidade (dados de compradores, certificado)", "Guardar o mínimo, buckets privados, criptografia, regras de acesso por empresa"],
        ["Escopo crescer demais", "Fases com critério de pronto; regimes específicos fora no início"],
      ],
      [3600, 6038]
    )
  );

  // ===== 15. Glossário ========================================================
  const GLOSSARIO = [
    ["ADN", "Ambiente de Dados Nacional da NFS-e"],
    ["Alíquota de referência", "Alíquota “cheia” da CBS e do IBS, a ser fixada pelo Senado"],
    ["Apuração assistida", "Apuração mensal montada pelo fisco a partir das notas; se não for contestada, vira confissão de dívida (a partir de 2027)"],
    ["Calculadora RTC", "Ferramenta oficial da Receita para calcular IBS/CBS, com versão online e offline"],
    ["Cashback", "Devolução de IBS/CBS a famílias de baixa renda"],
    ["CBS", "Contribuição sobre Bens e Serviços (federal; substitui PIS e Cofins)"],
    ["CC-e", "Carta de correção eletrônica; não pode mudar valores de imposto"],
    ["cClassTrib", "Código de classificação tributária do IBS/CBS (6 dígitos)"],
    ["cCredPres", "Código do crédito presumido de IBS/CBS"],
    ["CEBAS", "Certificação de Entidade Beneficente de Assistência Social"],
    ["CFOP", "Código Fiscal de Operações e Prestações"],
    ["CGIBS", "Comitê Gestor do IBS (estados e municípios)"],
    ["cIndOp", "Indicador da operação na NFS-e (define o local do IBS)"],
    ["CRT", "Código de Regime Tributário do emitente na NF-e"],
    ["CST", "Código de Situação Tributária (o do IBS/CBS tem 3 dígitos)"],
    ["DF-e", "Documentos fiscais eletrônicos; a Distribuição DF-e entrega à empresa as notas em que ela aparece"],
    ["DPS", "Declaração de Prestação de Serviço, que gera a NFS-e nacional"],
    ["finNFe", "Finalidade da NF-e (1 normal, 2 complementar, 3 ajuste, 4 devolução, 5 crédito, 6 débito)"],
    ["IBS", "Imposto sobre Bens e Serviços (estados e municípios; substitui ICMS e ISS)"],
    ["IS", "Imposto Seletivo (produtos prejudiciais à saúde e ao meio ambiente)"],
    ["IT", "Informe Técnico (publica as tabelas oficiais)"],
    ["Matriz fiscal", "As regras da empresa: produto × operação × comprador → códigos e tributação"],
    ["NBS", "Nomenclatura Brasileira de Serviços (9 dígitos)"],
    ["NCM", "Nomenclatura Comum do Mercosul (8 dígitos)"],
    ["NF-e / NFC-e", "Nota fiscal eletrônica (modelo 55) e nota ao consumidor (modelo 65)"],
    ["NFS-e", "Nota fiscal de serviço eletrônica (padrão nacional)"],
    ["NT", "Nota Técnica (leiaute e regras de validação dos documentos)"],
    ["Princípio do destino", "O IBS pertence ao estado e ao município de quem compra"],
    ["Regime híbrido", "Empresa do Simples que recolhe IBS/CBS fora do DAS"],
    ["SEFAZ", "Secretaria da Fazenda estadual, que autoriza a NF-e"],
    ["Split payment", "Separação do imposto no pagamento eletrônico, enviado direto ao fisco"],
  ];
  add(H1("15. Glossário"), ...table(["Termo", "Significado"], GLOSSARIO.map(([t, s]) => [`**${t}**`, s]), [2400, 7238]));

  // ===== 16. Fontes ===========================================================
  const FONTES = [
    ["Normas e publicações oficiais", [
      ["LC 214/2025 (Planalto)", "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm"],
      ["Cartilha do IBS, vol. 1 (CGIBS)", "https://www.cgibs.gov.br/upload/arquivos/202511/13142212-item-2-3-cartilha-do-ibs-vol-1-formatada-20251110-1506.pdf"],
      ["Receita Federal — Calculadora da Reforma", "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/julho/receita-federal-libera-ferramenta-oficial-de-calculo-da-reforma-tributaria-sobre-o-consumo"],
      ["Manual dos serviços RTC (Receita)", "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/reforma-tributaria-do-consumo/manual-servicos-rtc.pdf"],
      ["Validador de XML (piloto)", "https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/validador-xml"],
      ["Calculadora offline (piloto)", "https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/calculadora-offline"],
      ["Agência Gov — Simples e IBS/CBS fora do DAS", "https://agenciagov.ebc.com.br/noticias/202609/empresas-do-simples-nacional-ja-podem-optar-pelo-recolhimento-de-ibs-e-cbs-fora-do-regime-unificado"],
      ["Portal Único Siscomex — Classif (NCM)", "https://portalunico.siscomex.gov.br/classif/"],
      ["Revista da PGE-SP — base de cálculo", "https://revistas.pge.sp.gov.br/revistapegesp/article/download/1689/1732"],
    ]],
    ["Apuração assistida e cronograma", [
      ["e-Auditoria — apuração assistida", "https://www.e-auditoria.com.br/blog/apuracao-assistida/"],
      ["Meira Fernandes — apuração assistida", "https://www.meirafernandes.com.br/noticias/reforma-tributaria-2026-entenda-como-funcionara-a-apuracao-assistida-do-ibs-e-da-cbs/"],
      ["Escola Superior — rotina fiscal 2027", "https://escolasuperioresn.com.br/rotina-fiscal-2027-apuracao-assistida-ibs-cbs/"],
      ["Jornal Grande Bahia — CBS 2027 e Senado", "https://jornalgrandebahia.com.br/2026/10/cbs-comeca-a-valer-em-2027-senado-definira-aliquota-e-governo-prepara-novas-regras-tributarias/"],
      ["Barbieri Advogados — transição", "https://www.barbieriadvogados.com/transicao-tributaria-2026/"],
      ["Omie — split payment em 2028", "https://www.omie.com.br/blog/receita-federal-adia-obrigatoriedade-do-split-payment-para-2028/"],
      ["berga.app — Simples Nacional", "https://berga.app/blog/reforma-tributaria-simples-nacional"],
    ]],
    ["Nota fiscal, códigos e validações", [
      ["Tecnospeed — NT 2025.002", "https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/"],
      ["Tecnospeed — tabela cClassTrib", "https://blog.tecnospeed.com.br/tabela-cclasstrib/"],
      ["Tecnospeed — NFS-e e cIndOp", "https://blog.tecnospeed.com.br/nfs-e-nacional-tabela-de-indicadores-da-operacao/"],
      ["e-Auditoria — cClassTrib", "https://www.e-auditoria.com.br/blog/cclasstrib/"],
      ["TaxUp — CST do IBS/CBS", "https://taxup.com.br/solucoes/reforma-tributaria/cst-ibs-cbs/"],
      ["Portal Tributário — tabela CST", "https://www.portaltributario.com.br/noticias/tabela-cst-reforma-tributaria.htm"],
      ["nfe.io — notas de crédito e débito", "https://nfe.io/docs/documentacao/reforma-tributaria/conceitos-funcionais/nota-fiscal-de-produto/notas-de-credito-e-debito/"],
      ["Inventti — NT versão 1.36", "https://inventti.com.br/reforma-tributaria-versao-1-36-da-nt-2025-002-traz-novo-tipo-de-nota-de-credito-e-ajustes-nas-validacoes-da-nf-e-e-nfc-e/"],
      ["Escola Superior — auditoria de NF-e", "https://escolasuperioresn.com.br/auditoria-nfe-ibs-cbs-cclasstrib/"],
      ["Contábeis — rejeição 1115 adiada", "https://www.contabeis.com.br/noticias/79337/nf-e-rejeicao-1115-de-ibs-e-cbs-adiada-mas-obrigacao-permanece"],
    ]],
    ["Cancelamento, devoluções e multas", [
      ["Sindifisco-MS — multa de até 66%", "https://www.sindifisco-ms.org.br/documentos-fiscais-cancelamento-irregular-pode-gerar-multa-de-ate-66-do-tributo/"],
      ["notafiscal.cnt.br — multas na reforma", "https://notafiscal.cnt.br/multas-na-reforma-tributaria-ibs-cbs/"],
      ["Contábeis — devoluções e cancelamentos", "https://www.contabeis.com.br/artigos/80109/ibs-e-cbs-como-tratar-devolucoes-e-cancelamentos/"],
      ["EGS — cancelamento de NF-e na reforma", "https://blog.egssistemas.com.br/posts/cancelamento-de-nf-e-na-reforma-tributaria-o-que-muda-para-empresas"],
    ]],
  ];
  add(
    H1("16. Fontes e como manter atualizado"),
    P(`Base dos anexos (nota-certa/dados/anexos-lc214.json): **${FONTE.pacote}** (dados ${FONTE.dados}, licença ${FONTE.licenca.split(" — ")[0]}), extraída da Calculadora da Receita (módulo offline) e do Informe Técnico 2025.002.`),
    ...FONTES.flatMap(([grupo, itens]) => [
      label(grupo),
      ...itens.map(([nome, url]) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 }, children: [run(`${nome}: `, { size: 18 }), link(url, url)] })),
    ]),
    label("Como manter este estudo atualizado"),
    B("**Portal da NF-e:** novas versões da NT 2025.002 e do Informe Técnico (tabelas cClassTrib e cCredPres)."),
    B("**Portal da NFS-e nacional:** anexos VII e VIII e o leiaute da DPS."),
    B("**Receita Federal e CGIBS:** atos conjuntos, manual da API da apuração assistida e versões da Calculadora."),
    B("**Senado:** a resolução com as alíquotas de referência."),
    B("**Siscomex:** atualizações da tabela NCM."),
    B("A cada mudança, atualizar as tabelas versionadas no app, rodar os testes e avisar os clientes afetados.")
  );

  const doc = new Document({
    creator: "Nota Certa",
    title: "Nota Certa — Nota fiscal sem erro na Reforma Tributária",
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: "222222" }, paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 0, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 360, after: 100 }, outlineLevel: 1, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 4 } } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: ORANGE, font: FONT }, paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
            { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } },
          ],
        },
        { reference: "cellbullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 200, hanging: 170 } } } }] },
        { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { bold: true, color: GREEN } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } }, titlePage: true },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("Nota Certa · Estudo: nota fiscal sem erro na Reforma Tributária", { size: 16, color: MUTED })] })] }) },
        footers: {
          default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("Página ", { size: 16, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })] })] }),
          first: new Footer({ children: [new Paragraph({ children: [] })] }),
        },
        children: body,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(process.argv[2], buffer);
  console.log("ok", body.length, "blocos");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
