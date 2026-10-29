import { Fragment } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

// Ilustrações dos Conteúdos e da Reforma no hub (pedido do Izaias,
// 29/10/2026): desenhos em SVG com as cores da marca nas variáveis do hub
// (--hub-ilu-* em hub.css), pra ler bem no claro e no escuro. Os números são
// redondos e fictícios — mostram só o mecanismo — e cada figura diz isso no
// selo "Exemplo ilustrativo". Os desenhos têm 360 de largura (a de um
// celular) e crescem até o limite da figura no computador: o texto não fica
// miúdo em tela nenhuma. Texto sempre nas cores de texto do hub, nunca na
// cor da barra — a cor identifica a barra, o texto diz o que ela é.

const numero = new Intl.NumberFormat("pt-BR");
const fmt = (valor) => (valor < 0 ? `−${numero.format(-valor)}` : numero.format(valor));
const comSinal = (valor) => (valor > 0 ? `+${numero.format(valor)}` : fmt(valor));

const COR = {
  marinho: "var(--hub-ilu-marinho)",
  azul: "var(--hub-ilu-azul)",
  azulClaro: "var(--hub-ilu-azul-claro)",
  laranja: "var(--hub-ilu-laranja)",
  laranjaClaro: "var(--hub-ilu-laranja-claro)",
  verde: "var(--hub-ilu-verde)",
  vermelho: "var(--hub-ilu-vermelho)",
  acento: "var(--hub-acento)",
  trilho: "var(--hub-ilu-trilho)",
  cinza: "var(--hub-borda-forte)",
};

// "claro" e "escuro": texto por cima de um bloco colorido (branco nos tons
// fortes, marinho nos tons claros) — iguais nos dois temas.
const TOM = {
  1: "fill-[var(--hub-texto)]",
  2: "fill-[var(--hub-texto-2)]",
  3: "fill-[var(--hub-texto-3)]",
  claro: "fill-white",
  escuro: "fill-[#0a1a2d]",
};

function Texto({ x, y, tom = 1, tamanho = 12.5, peso = 500, ancora = "start", numeros = false, children }) {
  return (
    <text x={x} y={y} fontSize={tamanho} fontWeight={peso} textAnchor={ancora} className={`${TOM[tom]}${numeros ? " tabular-nums" : ""}`}>
      {children}
    </text>
  );
}

function Desenho({ altura, rotulo, children }) {
  return (
    <svg viewBox={`0 0 360 ${altura}`} role="img" aria-label={rotulo} className="block h-auto w-full overflow-visible">
      {children}
    </svg>
  );
}

function Legenda({ itens }) {
  return (
    <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
      {itens.map(([cor, nome]) => (
        <li key={nome} className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--hub-texto-2)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: cor }} />
          {nome}
        </li>
      ))}
    </ul>
  );
}

// A moldura de toda ilustração: título, o selo de exemplo, o desenho, a
// legenda das cores (quando a cor carrega sentido) e a explicação embaixo.
export function Figura({ titulo, itens, legenda, largura = "max-w-[470px]", children }) {
  return (
    <figure className="hub-cartao p-4 sm:p-8">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-[14.5px] font-bold text-[var(--hub-texto)]">{titulo}</span>
        <span className="hub-selo">Exemplo ilustrativo</span>
      </figcaption>
      <div className={`mx-auto mt-6 ${largura}`}>{children}</div>
      {itens && <Legenda itens={itens} />}
      {legenda && <p className="mt-6 border-t border-[var(--hub-borda)] pt-4 text-[13px] leading-relaxed text-[var(--hub-texto-3)]">{legenda}</p>}
    </figure>
  );
}

// ── Cascata deitada: uma linha por degrau ──
// "saldo"/"destaque" desenham do zero até o valor (sem `valor`, é o saldo
// que vem das linhas de cima — a conta fecha sozinha); "passo" soma ou tira
// do saldo anterior. Deitada, cabe no celular com o nome inteiro de cada linha.
function Cascata({ linhas, rotulo }) {
  const inicioBarra = 168;
  const fimBarra = 298;
  const passoY = 28;
  const barra = 14;
  let saldo = 0;
  const desenho = linhas.map((linha) => {
    const de = linha.tipo === "passo" ? saldo : 0;
    if (linha.tipo === "passo") saldo += linha.valor;
    else if (linha.valor !== undefined) saldo = linha.valor;
    return { ...linha, de, ate: saldo };
  });
  const maior = Math.max(...desenho.map((linha) => Math.max(linha.de, linha.ate)));
  const x = (valor) => inicioBarra + (valor / maior) * (fimBarra - inicioBarra);
  const altura = desenho.length * passoY - (passoY - barra) + 12;
  return (
    <Desenho altura={altura} rotulo={rotulo}>
      <line x1={inicioBarra} x2={inicioBarra} y1={0} y2={altura} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      {desenho.map((linha, i) => {
        const y = 6 + i * passoY;
        const ehSaldo = linha.tipo !== "passo";
        const cor = linha.tipo === "passo" ? (linha.valor < 0 ? COR.vermelho : COR.verde) : linha.tipo === "destaque" ? COR.acento : COR.marinho;
        const a = x(Math.min(linha.de, linha.ate));
        const b = x(Math.max(linha.de, linha.ate));
        return (
          <g key={linha.nome}>
            <Texto x={0} y={y + 11.5} tom={ehSaldo ? 1 : 2} tamanho={13.5} peso={ehSaldo ? 700 : 500}>
              {linha.nome}
            </Texto>
            <rect x={a} y={y} width={Math.max(3, b - a)} height={barra} rx={4} style={{ fill: cor }} />
            {i < desenho.length - 1 && <line x1={x(linha.ate)} x2={x(linha.ate)} y1={y + barra} y2={y + passoY} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />}
            <Texto x={360} y={y + 11.5} ancora="end" tom={ehSaldo ? 1 : 2} tamanho={13.5} peso={ehSaldo ? 700 : 500} numeros>
              {ehSaldo ? fmt(linha.ate) : comSinal(linha.valor)}
            </Texto>
          </g>
        );
      })}
    </Desenho>
  );
}

// A empresa-exemplo dos Conteúdos: receita líquida de 1.000, lucro bruto de
// 450, EBITDA de 180 e lucro líquido de 80 — os mesmos números nas margens,
// no EBITDA e no ROE.
const DRE = [
  { nome: "Receita bruta", valor: 1200, tipo: "saldo" },
  { nome: "Deduções", valor: -200, tipo: "passo" },
  { nome: "Receita líquida", tipo: "saldo" },
  { nome: "Custos", valor: -550, tipo: "passo" },
  { nome: "Lucro bruto", tipo: "saldo" },
  { nome: "Despesas operacionais", valor: -270, tipo: "passo" },
  { nome: "EBITDA", tipo: "destaque" },
  { nome: "Depreciação", valor: -30, tipo: "passo" },
  { nome: "Resultado financeiro", valor: -30, tipo: "passo" },
  { nome: "IR e CSLL", valor: -40, tipo: "passo" },
  { nome: "Lucro líquido", tipo: "destaque" },
];

const DFC = [
  { nome: "Caixa no início", valor: 60, tipo: "saldo" },
  { nome: "Operação", valor: 110, tipo: "passo" },
  { nome: "Investimentos", valor: -50, tipo: "passo" },
  { nome: "Financiamentos", valor: -20, tipo: "passo" },
  { nome: "Caixa no fim", tipo: "destaque" },
];

const LUCRO_AO_CAIXA = [
  { nome: "Lucro líquido", valor: 80, tipo: "saldo" },
  { nome: "Depreciação", valor: 30, tipo: "passo" },
  { nome: "Clientes a receber", valor: -20, tipo: "passo" },
  { nome: "Fornecedores", valor: 20, tipo: "passo" },
  { nome: "Caixa da operação", tipo: "destaque" },
];

// ── Balanço: os dois lados, do mesmo tamanho ──
function Balanco() {
  const topo = 46;
  const escala = 0.26;
  const largura = 150;
  const lados = [
    {
      x: 0,
      titulo: "Ativo",
      sub: "o que a empresa tem",
      blocos: [
        { nome: "Circulante", valor: 600, prazo: "curto prazo", cor: COR.azul },
        { nome: "Não circulante", valor: 400, prazo: "longo prazo", cor: COR.marinho },
      ],
    },
    {
      x: 210,
      titulo: "Passivo + PL",
      sub: "de onde veio o dinheiro",
      blocos: [
        { nome: "Circulante", valor: 400, prazo: "curto prazo", cor: COR.laranja },
        { nome: "Não circulante", valor: 200, prazo: "longo prazo", cor: COR.laranjaClaro, tom: "escuro" },
        { nome: "Patrimônio líquido", valor: 400, prazo: "dos sócios", cor: COR.verde },
      ],
    },
  ];
  return (
    <Desenho altura={334} rotulo="Balanço do exemplo: ativo de 1.000 (circulante 600, não circulante 400) igual a passivo circulante 400, passivo não circulante 200 e patrimônio líquido 400.">
      {lados.map((lado) => {
        const meio = lado.x + largura / 2;
        const total = lado.blocos.reduce((soma, bloco) => soma + bloco.valor, 0);
        let y = topo;
        return (
          <g key={lado.titulo}>
            <Texto x={meio} y={16} ancora="middle" tamanho={14.5} peso={700}>
              {lado.titulo}
            </Texto>
            <Texto x={meio} y={33} ancora="middle" tamanho={11.5} tom={3}>
              {lado.sub}
            </Texto>
            {lado.blocos.map((bloco) => {
              const altura = bloco.valor * escala;
              const yBloco = y;
              y += altura;
              const tom = bloco.tom || "claro";
              return (
                <g key={bloco.nome}>
                  <rect x={lado.x} y={yBloco} width={largura} height={altura - 2} rx={6} style={{ fill: bloco.cor }} />
                  <Texto x={lado.x + 12} y={yBloco + 20} tom={tom} tamanho={12} peso={700}>
                    {bloco.nome}
                  </Texto>
                  <Texto x={lado.x + 12} y={yBloco + 36} tom={tom} tamanho={11.5}>
                    {`${fmt(bloco.valor)} · ${bloco.prazo}`}
                  </Texto>
                </g>
              );
            })}
            <Texto x={meio} y={topo + total * escala + 18} ancora="middle" tom={2} peso={700} numeros>
              {`Total ${fmt(total)}`}
            </Texto>
          </g>
        );
      })}
      <Texto x={180} y={topo + 138} ancora="middle" tamanho={28} peso={600} tom={3}>
        =
      </Texto>
    </Desenho>
  );
}

// ── O circulante dos dois lados (liquidez e capital de giro) ──
// As colunas crescem do mesmo chão; no capital de giro, o pedaço que falta
// pro passivo alcançar o ativo aparece tracejado: é a folga.
function Circulante({ capitalDeGiro = false }) {
  const base = 210;
  const escala = 1 / 3;
  const largura = 130;
  const colunas = [
    {
      x: 24,
      nome: "Ativo circulante",
      blocos: [
        { nome: "Caixa", valor: 100, cor: COR.azul },
        { nome: "Clientes", valor: 300, cor: COR.marinho },
        { nome: "Estoques", valor: 200, cor: COR.azulClaro, tom: "escuro" },
      ],
    },
    {
      x: 206,
      nome: "Passivo circulante",
      blocos: [
        { nome: "Fornecedores", valor: 180, cor: COR.laranja },
        { nome: "Empréstimos", valor: 120, cor: COR.laranja },
        { nome: "Outras", valor: 100, cor: COR.laranja },
      ],
    },
  ];
  const totais = colunas.map((coluna) => coluna.blocos.reduce((soma, bloco) => soma + bloco.valor, 0));
  const topoAtivo = base - totais[0] * escala;
  const topoPassivo = base - totais[1] * escala;
  const rotulo = capitalDeGiro
    ? "Ativo circulante de 600 e passivo circulante de 400: sobram 200 de capital de giro."
    : "Ativo circulante de 600 (caixa 100, clientes 300, estoques 200) e passivo circulante de 400 (fornecedores 180, empréstimos 120, outras 100).";
  return (
    <Desenho altura={258} rotulo={rotulo}>
      <line x1={8} x2={352} y1={base} y2={base} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      {colunas.map((coluna, i) => {
        const meio = coluna.x + largura / 2;
        let y = base - totais[i] * escala;
        return (
          <g key={coluna.nome}>
            {coluna.blocos.map((bloco) => {
              const altura = bloco.valor * escala;
              const yBloco = y;
              y += altura;
              return (
                <g key={bloco.nome}>
                  <rect x={coluna.x} y={yBloco} width={largura} height={altura - 2} rx={5} style={{ fill: bloco.cor }} />
                  <text x={meio} y={yBloco + altura / 2 + 3.5} fontSize={12} textAnchor="middle" className={TOM[bloco.tom || "claro"]}>
                    <tspan fontWeight={700}>{bloco.nome}</tspan>
                    <tspan dx={6} className="tabular-nums">
                      {fmt(bloco.valor)}
                    </tspan>
                  </text>
                </g>
              );
            })}
            <Texto x={meio} y={base + 22} ancora="middle" peso={700}>
              {coluna.nome}
            </Texto>
            <Texto x={meio} y={base + 40} ancora="middle" tom={2} numeros>
              {`Total ${fmt(totais[i])}`}
            </Texto>
          </g>
        );
      })}
      {capitalDeGiro && (
        <g>
          <line x1={24 + largura} x2={206} y1={topoAtivo} y2={topoAtivo} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
          <rect x={206} y={topoAtivo} width={largura} height={topoPassivo - topoAtivo - 2} rx={5} strokeWidth={1.5} strokeDasharray="5 4" className="fill-[var(--hub-acento-suave)] stroke-[var(--hub-acento)]" />
          <Texto x={206 + largura / 2} y={topoAtivo + 28} ancora="middle" peso={700}>
            Capital de giro
          </Texto>
          <Texto x={206 + largura / 2} y={topoAtivo + 48} ancora="middle" tamanho={15} peso={800} numeros>
            {fmt(totais[0] - totais[1])}
          </Texto>
        </g>
      )}
    </Desenho>
  );
}

function ResultadosDaLiquidez() {
  const itens = [
    ["Corrente", "600 ÷ 400", "1,5"],
    ["Seca", "(600 − 200) ÷ 400", "1,0"],
    ["Imediata", "100 ÷ 400", "0,25"],
  ];
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-3">
      {itens.map(([nome, conta, resultado]) => (
        <div key={nome} className="flex items-baseline justify-between gap-3 rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] px-4 py-3 sm:block">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--hub-texto-3)]">{nome}</p>
          <p className="text-[12.5px] text-[var(--hub-texto-3)] sm:mt-1">{conta}</p>
          <p className="hub-display text-[22px] font-bold tabular-nums text-[var(--hub-texto)] sm:mt-1">{resultado}</p>
        </div>
      ))}
    </div>
  );
}

// ── O ciclo de caixa no calendário ──
function Faixa({ de, ate, y, cor, tom = "claro", x, children }) {
  return (
    <g>
      <rect x={x(de)} y={y} width={x(ate) - x(de) - 2} height={22} rx={5} style={{ fill: cor }} />
      <Texto x={(x(de) + x(ate)) / 2 - 1} y={y + 15.5} ancora="middle" tom={tom} tamanho={12} peso={700}>
        {children}
      </Texto>
    </g>
  );
}

function Ciclo() {
  const inicio = 4;
  const fim = 356;
  const x = (dia) => inicio + (dia / 70) * (fim - inicio);
  // Um acontecimento do ciclo (compra, venda, pagamento): o nome e um risquinho até a faixa.
  const marco = (dia, y, texto, ancora) => (
    <g>
      <Texto x={x(dia)} y={y} ancora={ancora} tom={2} tamanho={12.5} peso={600}>
        {texto}
      </Texto>
      <line x1={x(dia)} x2={x(dia)} y1={y + 4} y2={y + 10} strokeWidth={1.5} className="stroke-[var(--hub-texto-3)]" />
    </g>
  );
  return (
    <Desenho altura={232} rotulo="Ciclo de caixa: a mercadoria fica 40 dias em estoque e o cliente paga 30 dias depois da venda (dia 70); o fornecedor é pago no dia 35. Do dia 35 ao 70, 35 dias, o caixa da empresa financia a operação.">
      <line x1={x(0)} x2={x(16)} y1={8} y2={8} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <line x1={x(54)} x2={x(70)} y1={8} y2={8} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <line x1={x(0)} x2={x(0)} y1={8} y2={13} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <line x1={x(70)} x2={x(70)} y1={8} y2={13} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <Texto x={x(35)} y={12.5} ancora="middle" tom={3} tamanho={12} peso={600}>
        Ciclo operacional · 70 dias
      </Texto>
      {marco(0, 36, "Compra", "start")}
      {marco(40, 36, "Venda", "middle")}
      {marco(70, 36, "Recebe", "end")}
      <Faixa x={x} de={0} ate={40} y={46} cor={COR.azul}>
        Em estoque · 40 dias
      </Faixa>
      <Faixa x={x} de={40} ate={70} y={46} cor={COR.marinho}>
        A receber · 30 dias
      </Faixa>
      {marco(35, 98, "Paga o fornecedor", "middle")}
      <Faixa x={x} de={0} ate={35} y={110} cor={COR.laranjaClaro} tom="escuro">
        Fornecedor · 35 dias
      </Faixa>
      <line x1={x(35)} x2={x(35)} y1={132} y2={164} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <line x1={x(70) - 1} x2={x(70) - 1} y1={68} y2={164} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <Faixa x={x} de={35} ate={70} y={164} cor={COR.laranja}>
        Ciclo de caixa · 35 dias
      </Faixa>
      <Texto x={x(35) - 8} y={179.5} ancora="end" tom={3} tamanho={12}>
        o caixa da empresa banca →
      </Texto>
      <line x1={x(0)} x2={x(70)} y1={206} y2={206} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      {[0, 35, 40, 70].map((dia) => (
        <g key={dia}>
          <line x1={x(dia)} x2={x(dia)} y1={206} y2={211} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
          <Texto x={x(dia)} y={225} ancora={dia === 0 ? "start" : dia === 70 ? "end" : "middle"} tom={3} tamanho={12} numeros>
            {dia === 0 ? "dia 0" : String(dia)}
          </Texto>
        </g>
      ))}
    </Desenho>
  );
}

// ── De cada R$ 100 vendidos ──
function Margens() {
  const linhas = [
    { nome: "Receita líquida", detalhe: "o ponto de partida", valor: 100, cor: COR.marinho },
    { nome: "Margem bruta", detalhe: "depois dos custos", valor: 45, cor: COR.azul },
    { nome: "Margem EBITDA", detalhe: "depois das despesas", valor: 18, cor: COR.acento },
    { nome: "Margem líquida", detalhe: "o que sobra no fim", valor: 8, cor: COR.verde },
  ];
  return (
    <Desenho altura={linhas.length * 58 - 20} rotulo="De cada 100 reais de receita líquida: 45 de lucro bruto, 18 de EBITDA e 8 de lucro líquido.">
      {linhas.map((linha, i) => {
        const y = i * 58;
        return (
          <g key={linha.nome}>
            <text x={0} y={y + 13} fontSize={12.5}>
              <tspan fontWeight={700} className={TOM[1]}>
                {linha.nome}
              </tspan>
              <tspan dx={7} fontSize={11.5} className={TOM[3]}>
                {linha.detalhe}
              </tspan>
            </text>
            <Texto x={360} y={y + 13} ancora="end" peso={700} numeros>
              {`R$ ${linha.valor}`}
            </Texto>
            <rect x={0} y={y + 22} width={360} height={14} rx={4} style={{ fill: COR.trilho }} />
            <rect x={0} y={y + 22} width={(linha.valor / 100) * 360} height={14} rx={4} style={{ fill: linha.cor }} />
          </g>
        );
      })}
    </Desenho>
  );
}

// ── EBITDA de baixo pra cima: o lucro com o que ficou de fora somado de volta ──
function EbitdaPilha() {
  const base = 236;
  const x0 = 34;
  const largura = 76;
  const partes = [
    { nome: "Lucro líquido", valor: 80, cor: COR.verde },
    { nome: "+ IR e CSLL", valor: 40, cor: COR.marinho },
    { nome: "+ Resultado financeiro", valor: 30, cor: COR.azul },
    { nome: "+ Depreciação e amortização", valor: 30, cor: COR.laranjaClaro },
  ];
  const total = partes.reduce((soma, parte) => soma + parte.valor, 0);
  const escala = 200 / total;
  const topo = base - total * escala;
  let y = base;
  return (
    <Desenho altura={244} rotulo="EBITDA de 180: lucro líquido de 80, mais 40 de IR e CSLL, 30 de resultado financeiro e 30 de depreciação e amortização.">
      <Texto x={x0 + largura / 2} y={topo - 14} ancora="middle" tamanho={13.5} peso={800}>
        {`EBITDA ${fmt(total)}`}
      </Texto>
      <path d={`M${x0 - 8} ${topo} H${x0 - 13} V${base - 2} H${x0 - 8}`} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-[var(--hub-acento)]" />
      <Texto x={128} y={topo - 14} tom={3} tamanho={11.5} peso={600}>
        Somando de volta ao lucro
      </Texto>
      {partes.map((parte, i) => {
        const altura = parte.valor * escala;
        y -= altura;
        const centro = y + altura / 2;
        return (
          <g key={parte.nome}>
            <rect x={x0} y={y} width={largura} height={altura - 2} rx={5} style={{ fill: parte.cor }} />
            <line x1={x0 + largura + 4} x2={122} y1={centro - 1} y2={centro - 1} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
            <Texto x={128} y={centro + 3} tom={i === 0 ? 1 : 2} peso={i === 0 ? 700 : 500}>
              {parte.nome}
            </Texto>
            <Texto x={360} y={centro + 3} ancora="end" tom={i === 0 ? 1 : 2} peso={i === 0 ? 700 : 500} numeros>
              {fmt(parte.valor)}
            </Texto>
          </g>
        );
      })}
    </Desenho>
  );
}

// ── Endividamento e ROE: o lado direito do balanço ──
function Endividamento() {
  const topo = 24;
  const escala = 0.25;
  const largura = 150;
  const blocos = [
    { nome: "Passivo circulante", valor: 400, prazo: "curto prazo", cor: COR.laranja },
    { nome: "Não circulante", valor: 200, prazo: "longo prazo", cor: COR.laranjaClaro, tom: "escuro" },
    { nome: "Patrimônio líquido", valor: 400, prazo: "dos sócios", cor: COR.verde },
  ];
  const chave = (y1, y2) => `M158 ${y1} H164 V${y2} H158`;
  let y = topo;
  return (
    <Desenho altura={280} rotulo="Dinheiro de terceiros 600 e dos sócios 400: endividamento de 1,5. Com lucro de 80, ROE de 20%.">
      {blocos.map((bloco) => {
        const altura = bloco.valor * escala;
        const yBloco = y;
        y += altura;
        const tom = bloco.tom || "claro";
        return (
          <g key={bloco.nome}>
            <rect x={0} y={yBloco} width={largura} height={altura - 2} rx={6} style={{ fill: bloco.cor }} />
            <Texto x={12} y={yBloco + 20} tom={tom} tamanho={12} peso={700}>
              {bloco.nome}
            </Texto>
            <Texto x={12} y={yBloco + 36} tom={tom} tamanho={11.5}>
              {`${fmt(bloco.valor)} · ${bloco.prazo}`}
            </Texto>
          </g>
        );
      })}
      <path d={chave(topo, topo + 148)} fill="none" strokeWidth={1.5} className="stroke-[var(--hub-ilu-guia)]" />
      <path d={chave(topo + 150, topo + 248)} fill="none" strokeWidth={1.5} className="stroke-[var(--hub-ilu-guia)]" />
      <Texto x={176} y={50} peso={700}>
        Dinheiro de terceiros
      </Texto>
      <Texto x={176} y={67} tom={3} tamanho={11}>
        fornecedores, bancos, impostos
      </Texto>
      <Texto x={176} y={106} tom={2} tamanho={11.5} peso={600}>
        Endividamento
      </Texto>
      <Texto x={176} y={128} tamanho={17} peso={800} numeros>
        600 ÷ 400 = 1,5
      </Texto>
      <Texto x={176} y={196} peso={700}>
        Dinheiro dos sócios
      </Texto>
      <Texto x={176} y={213} tom={3} tamanho={11}>
        capital + lucros guardados
      </Texto>
      <Texto x={176} y={244} tom={2} tamanho={11.5} peso={600}>
        ROE, com lucro de 80
      </Texto>
      <Texto x={176} y={266} tamanho={17} peso={800} numeros>
        80 ÷ 400 = 20%
      </Texto>
    </Desenho>
  );
}

const LEGENDA_DA_CASCATA = [
  [COR.marinho, "Saldo"],
  [COR.vermelho, "O que sai"],
  [COR.verde, "O que entra"],
  [COR.acento, "Resultado em destaque"],
];

// Uma ilustração pelo nome (os Conteúdos guardam só o `id` — lib/conteudos.js).
export function Ilustracao({ id, legenda }) {
  if (id === "dre")
    return (
      <Figura titulo="A DRE em degraus" itens={LEGENDA_DA_CASCATA.filter(([cor]) => cor !== COR.verde)} legenda={legenda}>
        <Cascata linhas={DRE} rotulo="DRE do exemplo: receita bruta 1.200, deduções 200, receita líquida 1.000, custos 550, lucro bruto 450, despesas operacionais 270, EBITDA 180, depreciação 30, resultado financeiro 30, IR e CSLL 40, lucro líquido 80." />
      </Figura>
    );
  if (id === "dfc")
    return (
      <Figura titulo="Do caixa inicial ao caixa final" itens={LEGENDA_DA_CASCATA} legenda={legenda}>
        <Cascata linhas={DFC} rotulo="Fluxo de caixa do exemplo: caixa no início 60, operação mais 110, investimentos menos 50, financiamentos menos 20, caixa no fim 100." />
      </Figura>
    );
  if (id === "lucroAoCaixa")
    return (
      <Figura titulo="Do lucro ao caixa da operação" itens={LEGENDA_DA_CASCATA} legenda={legenda}>
        <Cascata linhas={LUCRO_AO_CAIXA} rotulo="Do lucro ao caixa: lucro líquido 80, mais 30 de depreciação, menos 20 de clientes a receber, mais 20 de fornecedores, caixa da operação 110." />
      </Figura>
    );
  if (id === "balanco")
    return (
      <Figura titulo="Os dois lados do balanço" legenda={legenda}>
        <Balanco />
      </Figura>
    );
  if (id === "liquidez")
    return (
      <Figura titulo="O circulante dos dois lados" legenda={legenda}>
        <Circulante />
        <ResultadosDaLiquidez />
      </Figura>
    );
  if (id === "capitalDeGiro")
    return (
      <Figura titulo="O que sobra do circulante" legenda={legenda}>
        <Circulante capitalDeGiro />
      </Figura>
    );
  if (id === "ciclo")
    return (
      <Figura titulo="O ciclo de caixa no calendário" largura="max-w-[520px]" legenda={legenda}>
        <Ciclo />
      </Figura>
    );
  if (id === "margens")
    return (
      <Figura titulo="De cada R$ 100 vendidos" legenda={legenda}>
        <Margens />
      </Figura>
    );
  if (id === "ebitda")
    return (
      <Figura titulo="O EBITDA de baixo para cima" legenda={legenda}>
        <EbitdaPilha />
      </Figura>
    );
  if (id === "endividamento")
    return (
      <Figura titulo="De onde vem o dinheiro da empresa" legenda={legenda}>
        <Endividamento />
      </Figura>
    );
  return null;
}

// ── Miniaturas dos cartões (sem texto: só a silhueta de cada desenho) ──
function Coluna({ x, y, altura, cor, largura = 11, rx = 3 }) {
  return <rect x={x} y={y} width={largura} height={Math.max(2, altura)} rx={rx} style={{ fill: cor }} />;
}

function Risco({ x, y, largura }) {
  return <rect x={x} y={y} width={largura} height={4} rx={2} style={{ fill: COR.cinza }} />;
}

const MINIATURAS = {
  dre: () => {
    const escala = 76 / 1200;
    const passos = [1200, -200, null, -550, null, -270, "d", -100, "d"];
    let saldo = 0;
    return passos.map((passo, i) => {
      const x = 10 + i * 16;
      if (typeof passo === "number" && i > 0) {
        const de = saldo;
        saldo += passo;
        return <Coluna key={i} x={x} y={88 - de * escala} altura={(de - saldo) * escala} cor={COR.vermelho} />;
      }
      if (typeof passo === "number") saldo = passo;
      return <Coluna key={i} x={x} y={88 - saldo * escala} altura={saldo * escala} cor={passo === "d" ? COR.acento : COR.marinho} />;
    });
  },
  balanco: () => (
    <>
      <Coluna x={38} y={10} altura={44} cor={COR.azul} largura={36} />
      <Coluna x={38} y={56} altura={30} cor={COR.marinho} largura={36} />
      <Coluna x={86} y={10} altura={29} cor={COR.laranja} largura={36} />
      <Coluna x={86} y={41} altura={14} cor={COR.laranjaClaro} largura={36} />
      <Coluna x={86} y={57} altura={29} cor={COR.verde} largura={36} />
    </>
  ),
  dfc: () => (
    <>
      <Coluna x={18} y={64} altura={24} cor={COR.marinho} largura={18} />
      <Coluna x={44} y={20} altura={44} cor={COR.verde} largura={18} />
      <Coluna x={70} y={20} altura={20} cor={COR.vermelho} largura={18} />
      <Coluna x={96} y={40} altura={8} cor={COR.vermelho} largura={18} />
      <Coluna x={122} y={48} altura={40} cor={COR.acento} largura={18} />
    </>
  ),
  lucroAoCaixa: () => MINIATURAS.dfc(),
  ebitda: () => (
    <>
      <path d="M44 14 H40 V86 H44" fill="none" strokeWidth={2} className="stroke-[var(--hub-acento)]" />
      <Coluna x={50} y={14} altura={12} cor={COR.laranjaClaro} largura={30} />
      <Coluna x={50} y={28} altura={12} cor={COR.azul} largura={30} />
      <Coluna x={50} y={42} altura={14} cor={COR.marinho} largura={30} />
      <Coluna x={50} y={58} altura={28} cor={COR.verde} largura={30} />
      <Risco x={92} y={18} largura={46} />
      <Risco x={92} y={32} largura={36} />
      <Risco x={92} y={47} largura={28} />
      <Risco x={92} y={70} largura={40} />
    </>
  ),
  liquidez: () => (
    <>
      <Coluna x={36} y={16} altura={10} cor={COR.azul} largura={36} />
      <Coluna x={36} y={28} altura={34} cor={COR.marinho} largura={36} />
      <Coluna x={36} y={64} altura={22} cor={COR.azulClaro} largura={36} />
      <Coluna x={88} y={40} altura={22} cor={COR.laranja} largura={36} />
      <Coluna x={88} y={64} altura={10} cor={COR.laranja} largura={36} />
      <Coluna x={88} y={76} altura={10} cor={COR.laranja} largura={36} />
    </>
  ),
  capitalDeGiro: () => (
    <>
      <Coluna x={36} y={16} altura={70} cor={COR.azul} largura={36} />
      <rect x={88} y={16} width={36} height={22} rx={3} strokeWidth={1.5} strokeDasharray="3 3" className="fill-[var(--hub-acento-suave)] stroke-[var(--hub-acento)]" />
      <Coluna x={88} y={40} altura={46} cor={COR.laranja} largura={36} />
    </>
  ),
  margens: () =>
    [
      [140, COR.marinho],
      [63, COR.azul],
      [25, COR.acento],
      [11, COR.verde],
    ].map(([largura, cor], i) => (
      <g key={i}>
        <rect x={10} y={14 + i * 20} width={140} height={9} rx={3} style={{ fill: COR.trilho }} />
        <rect x={10} y={14 + i * 20} width={largura} height={9} rx={3} style={{ fill: cor }} />
      </g>
    )),
  endividamento: () => (
    <>
      <Coluna x={30} y={10} altura={30} cor={COR.laranja} largura={44} />
      <Coluna x={30} y={42} altura={14} cor={COR.laranjaClaro} largura={44} />
      <Coluna x={30} y={58} altura={28} cor={COR.verde} largura={44} />
      <Risco x={88} y={18} largura={52} />
      <Risco x={88} y={30} largura={36} />
      <Risco x={88} y={64} largura={48} />
      <Risco x={88} y={76} largura={30} />
    </>
  ),
  ciclo: () => (
    <>
      <Coluna x={10} y={16} altura={12} cor={COR.azul} largura={78} />
      <Coluna x={90} y={16} altura={12} cor={COR.marinho} largura={60} />
      <Coluna x={10} y={42} altura={12} cor={COR.laranjaClaro} largura={68} />
      <Coluna x={80} y={68} altura={12} cor={COR.laranja} largura={70} />
      <line x1={80} x2={80} y1={54} y2={68} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
      <line x1={149} x2={149} y1={28} y2={68} strokeWidth={1} className="stroke-[var(--hub-ilu-guia)]" />
    </>
  ),
};

export function Miniatura({ id }) {
  const desenhar = MINIATURAS[id];
  return (
    <svg viewBox="0 0 160 96" className="block h-auto w-full" aria-hidden="true">
      {desenhar ? desenhar() : null}
    </svg>
  );
}

// ── Reforma: o crédito ao longo da cadeia ──
// Alíquota fictícia de 10%, só pra conta fechar redonda: cada etapa paga
// sobre a venda, abate o que já veio pago na compra e, no fim, o governo
// recebeu exatamente 10% do preço final — sem imposto sobre imposto.
const ALIQUOTA_FICTICIA = 0.1;
const ELOS = [
  { nome: "Indústria", compra: 0, venda: 1000 },
  { nome: "Atacado", compra: 1000, venda: 1500 },
  { nome: "Varejo", compra: 1500, venda: 2000 },
];

function SetaDaCadeia() {
  return (
    <span className="flex items-center justify-center text-[var(--hub-texto-3)]" aria-hidden="true">
      <ArrowDown size={18} className="lg:hidden" />
      <ArrowRight size={18} className="hidden lg:block" />
    </span>
  );
}

function Elo({ elo, pago, precoFinal }) {
  const imposto = elo.venda * ALIQUOTA_FICTICIA;
  const credito = elo.compra * ALIQUOTA_FICTICIA;
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] p-4">
      <p className="text-[14.5px] font-bold">{elo.nome}</p>
      <p className="mt-0.5 text-[12.5px] text-[var(--hub-texto-3)]">{elo.compra ? `compra por ${fmt(elo.compra)}, vende por ${fmt(elo.venda)}` : `vende por ${fmt(elo.venda)}`}</p>
      <div className="mt-3 flex h-2.5 gap-[2px]" aria-hidden="true">
        {elo.compra > 0 && <span className="rounded-full" style={{ width: `${(elo.compra / precoFinal) * 100}%`, background: COR.cinza }} />}
        <span className="rounded-full" style={{ width: `${((elo.venda - elo.compra) / precoFinal) * 100}%`, background: COR.acento }} />
      </div>
      <dl className="mt-4 space-y-1.5 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--hub-texto-2)]">Imposto na venda</dt>
          <dd className="font-semibold tabular-nums">{fmt(imposto)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--hub-texto-2)]">Crédito da compra</dt>
          <dd className="font-semibold tabular-nums">{credito ? fmt(-credito) : "0"}</dd>
        </div>
      </dl>
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between rounded-xl bg-[var(--hub-acento-suave)] px-3 py-2 text-[13.5px] font-bold">
          <span>Paga ao governo</span>
          <span className="tabular-nums">{fmt(pago)}</span>
        </div>
      </div>
    </div>
  );
}

export function CadeiaDoCredito() {
  const precoFinal = ELOS[ELOS.length - 1].venda;
  const pagos = ELOS.map((elo) => (elo.venda - elo.compra) * ALIQUOTA_FICTICIA);
  const total = pagos.reduce((soma, valor) => soma + valor, 0);
  return (
    <Figura
      titulo="O imposto ao longo da cadeia"
      largura="max-w-none"
      itens={[
        [COR.cinza, "Valor que veio da etapa anterior"],
        [COR.acento, "Valor agregado na etapa"],
      ]}
      legenda="Alíquota fictícia de 10%, só para a conta ficar redonda — as alíquotas de verdade ainda serão fixadas. Os valores de venda estão sem o imposto, que é calculado por fora do preço."
    >
      <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {ELOS.map((elo, i) => (
          <Fragment key={elo.nome}>
            <Elo elo={elo} pago={pagos[i]} precoFinal={precoFinal} />
            <SetaDaCadeia />
          </Fragment>
        ))}
        <div className="flex flex-col rounded-2xl border border-dashed border-[var(--hub-borda-forte)] p-4">
          <p className="text-[14.5px] font-bold">Consumidor</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--hub-texto-3)]">compra por {fmt(precoFinal)}</p>
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--hub-texto-2)]">
            Paga {fmt(precoFinal)} + {fmt(precoFinal * ALIQUOTA_FICTICIA)} de imposto. Como não revende, não tem crédito: é quem, de fato, arca com o imposto.
          </p>
        </div>
      </div>
      <p className="mt-5 rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] px-5 py-4 text-[14px] leading-relaxed text-[var(--hub-texto-2)]">
        <span className="font-bold text-[var(--hub-texto)]">
          Total recolhido: {pagos.map(fmt).join(" + ")} = {fmt(total)}
        </span>{" "}
        — exatamente 10% do preço final de {fmt(precoFinal)}. Ninguém pagou imposto sobre imposto.
      </p>
    </Figura>
  );
}

// ── Reforma: o split payment ──
function Caixa({ x, y, largura, altura, destaque = false }) {
  return <rect x={x} y={y} width={largura} height={altura} rx={16} strokeWidth={1.5} className={destaque ? "fill-[var(--hub-acento-suave)] stroke-[var(--hub-acento)]" : "fill-[var(--hub-cartao-solido)] stroke-[var(--hub-borda-forte)]"} />;
}

function Ponta({ x, y }) {
  return <path d={`M${x - 5.5} ${y - 8} L${x} ${y} L${x + 5.5} ${y - 8} Z`} className="fill-[var(--hub-texto-3)]" />;
}

export function SplitPayment() {
  return (
    <Figura titulo="O caminho do dinheiro com split payment" legenda="Alíquota fictícia de 10%: venda de 1.000 com 100 de CBS e IBS. Como os créditos da empresa entram nessa conta e o ritmo da implantação ainda dependem de regulamentação.">
      <Desenho altura={304} rotulo="O cliente paga 1.100; na liquidação do pagamento, 1.000 vão para a empresa e 100 de CBS e IBS vão direto para o governo.">
        <Caixa x={70} y={2} largura={220} altura={64} />
        <Texto x={180} y={26} ancora="middle" tom={3} tamanho={12.5} peso={600}>
          O cliente paga
        </Texto>
        <Texto x={180} y={52} ancora="middle" tamanho={21} peso={800} numeros>
          1.100
        </Texto>
        <line x1={180} x2={180} y1={66} y2={96} strokeWidth={2} className="stroke-[var(--hub-texto-3)]" />
        <Ponta x={180} y={103} />
        <Caixa x={30} y={106} largura={300} altura={58} destaque />
        <Texto x={180} y={130} ancora="middle" tamanho={14} peso={700}>
          Liquidação do pagamento
        </Texto>
        <Texto x={180} y={149} ancora="middle" tom={2} tamanho={12.5}>
          banco, maquininha, Pix ou boleto
        </Texto>
        <path d="M180 164 V186 H88 V206" fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-[var(--hub-texto-3)]" />
        <path d="M180 186 H272 V206" fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-[var(--hub-texto-3)]" />
        <Ponta x={88} y={213} />
        <Ponta x={272} y={213} />
        <Caixa x={1} y={216} largura={174} altura={86} />
        <Texto x={88} y={241} ancora="middle" tom={3} tamanho={12.5} peso={600}>
          A empresa recebe
        </Texto>
        <Texto x={88} y={267} ancora="middle" tamanho={21} peso={800} numeros>
          1.000
        </Texto>
        <Texto x={88} y={288} ancora="middle" tom={3} tamanho={12}>
          o valor da venda
        </Texto>
        <Caixa x={185} y={216} largura={174} altura={86} destaque />
        <Texto x={272} y={241} ancora="middle" tom={3} tamanho={12.5} peso={600}>
          O governo recebe
        </Texto>
        <Texto x={272} y={267} ancora="middle" tamanho={21} peso={800} numeros>
          100
        </Texto>
        <Texto x={272} y={288} ancora="middle" tom={3} tamanho={12}>
          CBS e IBS da operação
        </Texto>
      </Desenho>
    </Figura>
  );
}
