import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from "recharts";
import { ChevronRight, Flame, Gauge, Layers, LayoutGrid, ListOrdered, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { monthLabel, takeDashboardContext } from "../lib/dashboardData.js";
import { directChildren } from "../lib/reportTree.js";
import { entriesForAccount } from "../data/calculations.js";
import LedgerModal from "../components/LedgerModal.jsx";
import { money } from "../lib/format.js";

// Análise de desempenho: o que mais pesa no faturamento (base = receita bruta do período escolhido no topo). Três visões da MESMA análise, em zoom:
// Departamentos (custos, comerciais, administrativas…) → Grupos (dentro de cada departamento) → Contas (os itens, com gargalos e picos).
// Os números saem do DRE do B.I (mesmo período, mesma consolidação de grupo): despesa é negativa na DRE, aqui vira "consumo" positivo da receita.
const DEPARTAMENTOS = [
  { code: "DRE.04", curto: "Custos", nome: "Custos", cor: "#2563eb" },
  { code: "DRE.06", curto: "Comerciais", nome: "Despesas comerciais", cor: "#0891b2" },
  { code: "DRE.07", curto: "Administrativas", nome: "Despesas administrativas", cor: "#7c3aed" },
  { code: "DRE.08", curto: "Tributos op.", nome: "Tributos e provisões operacionais", cor: "#f59e0b" },
  { code: "DRE.09", curto: "Indedutíveis", nome: "Despesas indedutíveis", cor: "#dc2626" },
  { code: "DRE.10", curto: "Outros result.", nome: "Outros resultados operacionais", cor: "#64748b" },
  { code: "DRE.12", curto: "Deprec.", nome: "Depreciação e amortização", cor: "#84cc16" },
  { code: "DRE.14", curto: "Financeiro", nome: "Resultado financeiro", cor: "#14b8a6" },
  { code: "DRE.15", curto: "Não operac.", nome: "Resultados não operacionais", cor: "#a855f7" },
  { code: "DRE.17", curto: "IRPJ/CSLL", nome: "IRPJ e CSLL", cor: "#ea580c" },
];
const COR_DEDUCOES = "#db2777";
const COR_RESULTADO = "#16a34a";
const COR_RECEITA = "#2563eb";

const compacto = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};
const pct1 = (value) => (value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const pct2 = (value) => (value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

function Card({ titulo, nota, children, className = "" }) {
  return (
    <section className={`rounded-xl bg-surface-card p-4 shadow-sm ${className}`}>
      {titulo && (
        <p className="mb-3 text-[14px] font-semibold text-ink-900">
          {titulo}
          {nota && <span className="ml-2 text-[12px] font-normal text-ink-400">{nota}</span>}
        </p>
      )}
      {children}
    </section>
  );
}

// Mini gráfico de linha (% da receita mês a mês) sem biblioteca: leve pra ir em cada linha de ranking.
function Sparkline({ valores, cor }) {
  const pontos = valores.map((v, i) => ({ v, i })).filter((p) => p.v != null);
  if (pontos.length < 2) return <span className="text-ink-300">—</span>;
  const max = Math.max(...pontos.map((p) => p.v), 0.01);
  const min = Math.min(...pontos.map((p) => p.v), 0);
  const largura = 84;
  const altura = 22;
  const x = (i) => (valores.length > 1 ? (i / (valores.length - 1)) * largura : 0);
  const y = (v) => altura - 2 - ((v - min) / (max - min || 1)) * (altura - 4);
  const caminho = pontos.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg width={largura} height={altura} className="inline-block align-middle" aria-hidden="true">
      <path d={caminho} fill="none" stroke={cor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(ultimo.i)} cy={y(ultimo.v)} r="2.4" fill={cor} />
    </svg>
  );
}

// "Está pesando mais?": % da receita no último mês com receita contra a média dos meses anteriores do período.
function tendencia(pctMeses) {
  const validos = pctMeses.map((v, i) => ({ v, i })).filter((p) => p.v != null);
  if (validos.length < 3) return null;
  const ultimo = validos[validos.length - 1].v;
  const anteriores = validos.slice(0, -1).map((p) => p.v);
  const media = anteriores.reduce((t, v) => t + v, 0) / anteriores.length;
  return { ultimo, media, delta: ultimo - media };
}

function ChipTendencia({ t }) {
  if (!t) return <span className="text-ink-300">—</span>;
  const sobe = t.delta >= 0.3;
  const desce = t.delta <= -0.3;
  const cls = sobe ? "bg-warning-50 text-warning-700" : desce ? "bg-emerald-50 text-emerald-700" : "bg-surface-muted text-ink-500";
  return (
    <span title={`Último mês ${pct1(t.ultimo)} da receita; média dos anteriores ${pct1(t.media)}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      {sobe ? "▲" : desce ? "▼" : "•"} {Math.abs(t.delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.
    </span>
  );
}

function CelulaTreemap({ x, y, width, height, name, fill, pctReceita, onAbrir, code }) {
  if (width < 4 || height < 4) return null;
  const cabe = width > 74 && height > 34;
  return (
    <g onClick={() => onAbrir(code)} style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={fill} stroke="#fff" strokeWidth={2} />
      {cabe && (
        <>
          <text x={x + 8} y={y + 18} fill="#fff" fontSize={11.5} fontWeight={600}>{String(name).length > Math.floor(width / 6.5) ? `${String(name).slice(0, Math.max(Math.floor(width / 6.5) - 1, 3))}…` : name}</text>
          <text x={x + 8} y={y + 34} fill="#fff" fontSize={11} opacity={0.92}>{pct1(pctReceita)} da receita</text>
        </>
      )}
    </g>
  );
}

export default function AnaliseDesempenho() {
  const state = useAppState();
  const temDados = state.accounts.length > 0 || state.journal.length > 0;
  const [visao, setVisao] = useState("dept"); // "dept" | "grupos" | "contas"
  const [foco, setFoco] = useState(null); // código do DRE em foco (null = todos os departamentos)
  const [ledgerRow, setLedgerRow] = useState(null); // conta aberta no razão (mesmo modal dos demonstrativos)

  const ctx = useMemo(() => {
    if (!temDados) return null;
    return takeDashboardContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temDados, state.mappings, state.accounts, state.journal, state.periodStart, state.periodEnd, state.activeCompanyId, state.activeGroupId]);

  const dados = useMemo(() => {
    if (!ctx) return null;
    const dre = ctx.dre || [];
    const meses = ctx.months || [];
    const porCodigo = new Map(dre.map((row) => [row.codigo_gerencial, row]));
    const serie = (row) => meses.map((m) => Number(row?.monthValues?.[m] || 0));
    const receitaRow = porCodigo.get("DRE.01");
    const receita = Number(receitaRow?.saldo || 0);
    const receitaMes = serie(receitaRow);
    const valorPeriodo = (row) => {
      const mv = serie(row);
      return meses.length ? mv.reduce((t, v) => t + v, 0) : Number(row?.saldo || 0);
    };
    const pctMeses = (row) => serie(row).map((v, i) => (receitaMes[i] ? (-v / receitaMes[i]) * 100 : null));
    const montar = (row, extra = {}) => {
      const consumo = -valorPeriodo(row);
      return {
        code: row.codigo_gerencial,
        nome: row.categoria_gerencial || row.nome || row.codigo_gerencial,
        consumo,
        pct: receita ? (consumo / receita) * 100 : null,
        pctMeses: pctMeses(row),
        tend: tendencia(pctMeses(row)),
        row,
        ...extra,
      };
    };
    const deptos = DEPARTAMENTOS.map((d) => {
      const row = porCodigo.get(d.code);
      return row ? montar(row, { nome: d.nome, cor: d.cor }) : null;
    }).filter((d) => d && Math.abs(d.consumo) >= 0.005);
    const deducoesRow = porCodigo.get("DRE.02");
    const deducoes = deducoesRow ? montar(deducoesRow, { nome: "Deduções da receita bruta", cor: COR_DEDUCOES }) : null;
    const resultadoRow = porCodigo.get("DRE.18");
    const resultado = resultadoRow ? valorPeriodo(resultadoRow) : 0;
    return { dre, meses, porCodigo, receita, receitaMes, deptos, deducoes, resultado, montar, valorPeriodo, pctMeses };
  }, [ctx]);

  // Nível mais analítico: o item (linha do plano) em foco, com as contas ligadas a ele e o valor de cada uma no período; clicar abre o razão.
  const contasDoFoco = useMemo(() => {
    if (!dados || !foco) return [];
    const row = dados.porCodigo.get(foco);
    if (!row || row.hasSyntheticChildren) return [];
    return (row.contas || [])
      .map((conta) => {
        const entradas = entriesForAccount(conta.classificacao);
        const debito = entradas.reduce((t, e) => t + Number(e.debito || 0), 0);
        const credito = entradas.reduce((t, e) => t + Number(e.credito || 0), 0);
        return { classificacao: conta.classificacao, nome: conta.nome_conta || conta.classificacao, consumo: debito - credito, qtd: entradas.length };
      })
      .filter((c) => c.qtd > 0 || Math.abs(c.consumo) >= 0.005)
      .sort((a, b) => b.consumo - a.consumo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, foco, state.journal, state.periodStart, state.periodEnd]);

  if (!temDados) {
    return <p className="rounded-xl bg-surface-card p-6 text-[13px] text-ink-500 shadow-sm">Importe o balancete e o diário (menu Dados) para ver a análise de desempenho.</p>;
  }
  if (!dados || !dados.receita) {
    return <p className="rounded-xl bg-surface-card p-6 text-[13px] text-ink-500 shadow-sm">Não há receita bruta no período escolhido — escolha outro período no topo.</p>;
  }

  const { dre, meses, porCodigo, receita, deptos, deducoes, resultado, montar } = dados;
  const periodoTxt = meses.length ? `${monthLabel(meses[0])} a ${monthLabel(meses[meses.length - 1])}` : "período";
  const corDoDepto = (code) => DEPARTAMENTOS.find((d) => code === d.code || code.startsWith(`${d.code}.`))?.cor || (code.startsWith("DRE.02") ? COR_DEDUCOES : "#64748b");
  const nomeDe = (code) => DEPARTAMENTOS.find((d) => d.code === code)?.nome || (code === "DRE.02" ? "Deduções da receita bruta" : porCodigo.get(code)?.categoria_gerencial || code);

  // --- navegação em zoom ---
  const temFilhos = (code) => directChildren(dre, code).some((row) => Math.abs(dados.valorPeriodo(row)) >= 0.005);
  function abrir(code) {
    setFoco(code);
    setVisao(temFilhos(code) ? "grupos" : "contas");
  }
  const trilha = foco
    ? foco.split(".").map((_, i, partes) => partes.slice(0, i + 1).join(".")).filter((code) => code !== "DRE" && porCodigo.has(code))
    : [];

  // --- visão 1: departamentos ---
  const ordenados = [...deptos].sort((a, b) => b.consumo - a.consumo);
  const passos = [];
  let corrente = 100;
  const deducoesPct = deducoes?.pct || 0;
  if (deducoes && Math.abs(deducoes.consumo) >= 0.005) {
    corrente -= deducoesPct;
    passos.push({ nome: "Deduções", completo: "Deduções da receita bruta", code: "DRE.02", base: corrente, valor: deducoesPct, cor: COR_DEDUCOES, pct: deducoesPct, consumo: deducoes.consumo });
  }
  ordenados.forEach((d) => {
    const p = d.pct || 0;
    if (p >= 0) {
      corrente -= p;
      passos.push({ nome: d.curto || d.nome, completo: d.nome, code: d.code, base: Math.max(corrente, 0), valor: p, cor: d.cor, pct: p, consumo: d.consumo });
    } else {
      passos.push({ nome: d.curto || d.nome, completo: d.nome, code: d.code, base: Math.max(corrente, 0), valor: -p, cor: "#10b981", pct: p, consumo: d.consumo, ganho: true });
      corrente -= p;
    }
  });
  const dadosCascata = [
    { nome: "Receita bruta", code: null, base: 0, valor: 100, cor: COR_RECEITA, pct: 100, consumo: receita },
    ...passos,
    { nome: "Resultado", code: null, base: 0, valor: Math.max((resultado / receita) * 100, 0), cor: COR_RESULTADO, pct: (resultado / receita) * 100, consumo: resultado },
  ];

  // --- visão 2: grupos (dentro dos departamentos) ---
  const codigosBase = foco ? [foco] : [...(deducoes ? ["DRE.02"] : []), ...deptos.map((d) => d.code)];
  const grupos = codigosBase
    .flatMap((code) => {
      const filhos = directChildren(dre, code).filter((row) => Math.abs(dados.valorPeriodo(row)) >= 0.005);
      return filhos.length ? filhos : porCodigo.get(code) ? [porCodigo.get(code)] : [];
    })
    .map((row) => montar(row, { cor: corDoDepto(row.codigo_gerencial) }))
    .sort((a, b) => b.consumo - a.consumo);
  const gruposPositivos = grupos.filter((g) => g.consumo > 0.005);
  const totalGrupos = gruposPositivos.reduce((t, g) => t + g.consumo, 0);
  const dadosTreemap = gruposPositivos.map((g) => ({ name: g.nome, size: g.consumo, fill: g.cor, pctReceita: g.pct, code: g.code }));

  // --- visão 3: contas (os itens, com gargalos) ---
  const raizes = foco ? [foco] : ["DRE.02", ...deptos.map((d) => d.code)];
  const folhas = dre
    .filter((row) => !row.hasSyntheticChildren && raizes.some((r) => row.codigo_gerencial === r || row.codigo_gerencial.startsWith(`${r}.`)) && Math.abs(dados.valorPeriodo(row)) >= 0.005)
    .map((row) => montar(row, { cor: corDoDepto(row.codigo_gerencial), grupoNome: porCodigo.get(row.codigo_gerencial.split(".").slice(0, -1).join("."))?.categoria_gerencial || "" }))
    .filter((f) => f.consumo > 0.005)
    .sort((a, b) => b.consumo - a.consumo);
  const totalFolhas = folhas.reduce((t, f) => t + f.consumo, 0);
  let acumulado = 0;
  const pareto = folhas.slice(0, 20).map((f) => {
    acumulado += f.consumo;
    return { ...f, acum: totalFolhas ? (acumulado / totalFolhas) * 100 : 0 };
  });
  const corte80 = pareto.findIndex((f) => f.acum >= 80);
  const mapaCalor = folhas.slice(0, 12);
  const alertas = folhas
    .filter((f) => f.tend && f.tend.delta >= 0.3 && f.tend.ultimo > f.tend.media * 1.15)
    .sort((a, b) => b.tend.delta - a.tend.delta)
    .slice(0, 6);
  const focoRow = foco ? porCodigo.get(foco) : null;
  const leafFoco = focoRow && !focoRow.hasSyntheticChildren ? montar(focoRow, { cor: corDoDepto(foco) }) : null; // item (nível mais analítico) em foco

  // --- deduções da receita bruta (bloco à parte) ---
  const deducoesFolhas = dre
    .filter((row) => !row.hasSyntheticChildren && row.codigo_gerencial.startsWith("DRE.02.") && Math.abs(dados.valorPeriodo(row)) >= 0.005)
    .map((row) => montar(row, { cor: COR_DEDUCOES, grupoNome: porCodigo.get(row.codigo_gerencial.split(".").slice(0, -1).join("."))?.categoria_gerencial || "" }))
    .sort((a, b) => b.consumo - a.consumo);

  const Segmento = ({ id, icone: Icone, nome }) => (
    <button
      type="button"
      onClick={() => { setVisao(id); if (id === "dept") setFoco(null); }}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${visao === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
    >
      <Icone size={14} strokeWidth={1.9} />
      {nome}
    </button>
  );

  const lista = (itens, { mostrarTend = true } = {}) => (
    <div className="flex flex-col">
      {itens.map((g) => (
        <button key={g.code} type="button" onClick={() => abrir(g.code)} className="grid grid-cols-[minmax(130px,1.2fr)_2fr_110px_64px_200px] items-center gap-3 border-b border-line py-2 text-left text-[13px] last:border-0 hover:bg-surface-muted/60">
          <span className="truncate"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: g.cor }} />{g.nome}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${Math.min(Math.max(g.pct || 0, 0) * (100 / Math.max(...itens.map((x) => x.pct || 0), 1)), 100)}%`, background: g.cor }} /></span>
          <span className="text-right tabular-nums text-ink-800">{money(g.consumo)}</span>
          <span className="text-right font-semibold tabular-nums text-ink-900">{pct1(g.pct)}</span>
          <span className="flex items-center justify-end gap-2">{mostrarTend && <><Sparkline valores={g.pctMeses} cor={g.cor} /><ChipTendencia t={g.tend} /></>}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      {/* cabeçalho */}
      <section className="rounded-2xl bg-surface-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Gauge size={16} /> Análise de desempenho</p>
            <p className="mt-0.5 max-w-2xl text-[12px] text-ink-400">O que mais pesa no faturamento. Tudo em % da <b className="text-ink-600">receita bruta</b> do período ({periodoTxt}). Clique num departamento, grupo ou conta para aprofundar.</p>
          </div>
          <div className="flex flex-wrap gap-x-9 gap-y-2">
            <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Receita bruta</p><p className="mt-0.5 text-[18px] font-bold tabular-nums text-ink-900">{money(receita)}</p></div>
            <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Resultado do período</p><p className="mt-0.5 text-[18px] font-bold tabular-nums" style={{ color: resultado >= 0 ? COR_RESULTADO : "#dc2626" }}>{money(resultado)} <span className="text-[12px] font-medium text-ink-500">({pct1((resultado / receita) * 100)})</span></p></div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-surface-muted p-1">
            <Segmento id="dept" icone={LayoutGrid} nome="Departamentos" />
            <Segmento id="grupos" icone={Layers} nome="Grupos" />
            <Segmento id="contas" icone={ListOrdered} nome="Contas" />
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-500" aria-label="Onde você está">
            <button type="button" onClick={() => { setFoco(null); setVisao("dept"); }} className="rounded px-1.5 py-0.5 hover:bg-surface-muted hover:text-ink-800">Receita bruta</button>
            {trilha.map((code) => (
              <span key={code} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-ink-300" />
                <button type="button" onClick={() => abrir(code)} className={`rounded px-1.5 py-0.5 hover:bg-surface-muted hover:text-ink-800 ${code === foco ? "font-semibold text-ink-900" : ""}`}>{nomeDe(code)}</button>
              </span>
            ))}
          </nav>
        </div>
      </section>

      {/* VISÃO 1: DEPARTAMENTOS */}
      {visao === "dept" && (
        <>
          <Card titulo="Para onde vai cada R$ 100 da receita bruta" nota="cascata por departamento · clique numa barra">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosCascata} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11.5 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip cursor={false} formatter={(value, name, item) => (name === "base" ? null : [`${pct1(item.payload.pct)} · ${money(item.payload.consumo)}`, item.payload.completo || item.payload.nome])} />
                  <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="valor" stackId="c" radius={[5, 5, 0, 0]} isAnimationActive={false} onClick={(d) => d?.code && abrir(d.code)} style={{ cursor: "pointer" }}>
                    {dadosCascata.map((p, i) => <Cell key={i} fill={p.cor} />)}
                    <LabelList dataKey="pct" position="top" formatter={(v) => pct1(v)} style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card titulo="Ranking dos departamentos" nota="% da receita bruta · tendência do último mês" className="xl:col-span-2">
              {lista(ordenados.map((d) => ({ ...d })))}
              <p className="mt-2 text-[11.5px] text-ink-400">▲ pesando mais no último mês · ▼ pesando menos · compara com a média dos meses anteriores do período.</p>
            </Card>

            <Card titulo="Deduções da receita bruta" nota={deducoes ? `${pct1(deducoes.pct)} · ${money(deducoes.consumo)}` : ""}>
              {deducoesFolhas.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-muted">
                    {deducoesFolhas.map((f, i) => <div key={f.code} title={`${f.nome}: ${money(f.consumo)} · ${pct2(f.pct)} da receita`} style={{ width: `${(f.consumo / (deducoes?.consumo || 1)) * 100}%`, background: COR_DEDUCOES, opacity: 1 - i * 0.14 }} />)}
                  </div>
                  {deducoesFolhas.map((f, i) => (
                    <div key={f.code} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[12.5px] last:border-0">
                      <span className="truncate"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: COR_DEDUCOES, opacity: 1 - i * 0.14 }} />{f.nome}</span>
                      <span className="shrink-0 text-right tabular-nums"><b className="text-ink-900">{pct2(f.pct)}</b> <span className="text-ink-400">· {money(f.consumo)}</span></span>
                    </div>
                  ))}
                  <p className="text-[11.5px] text-ink-400">Tributos sobre a receita, devoluções e abatimentos. Detalhe imposto a imposto na Carga tributária.</p>
                </div>
              ) : <p className="py-6 text-center text-[13px] text-ink-400">Sem deduções no período.</p>}
            </Card>
          </div>
        </>
      )}

      {/* VISÃO 2: GRUPOS */}
      {visao === "grupos" && (
        <>
          <Card titulo={foco ? `Dentro de ${nomeDe(foco)}` : "Todos os grupos"} nota="o tamanho é quanto pesa na receita bruta · clique para abrir">
            {dadosTreemap.length ? (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap data={dadosTreemap} dataKey="size" isAnimationActive={false} content={<CelulaTreemap onAbrir={abrir} />} />
                </ResponsiveContainer>
              </div>
            ) : <p className="py-10 text-center text-[13px] text-ink-400">Nada para detalhar aqui no período.</p>}
          </Card>
          <Card titulo="Grupos em ordem de peso" nota={`% da receita bruta · % ${foco ? `de ${nomeDe(foco)}` : "do total listado"} · tendência`}>
            <div className="flex flex-col">
              {grupos.map((g) => (
                <button key={g.code} type="button" onClick={() => abrir(g.code)} className="grid grid-cols-[minmax(130px,1.2fr)_2fr_110px_64px_64px_200px] items-center gap-3 border-b border-line py-2 text-left text-[13px] last:border-0 hover:bg-surface-muted/60">
                  <span className="truncate"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: g.cor }} />{g.nome}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${totalGrupos ? Math.max(g.consumo, 0) / (gruposPositivos[0]?.consumo || 1) * 100 : 0}%`, background: g.cor }} /></span>
                  <span className="text-right tabular-nums text-ink-800">{money(g.consumo)}</span>
                  <span className="text-right font-semibold tabular-nums text-ink-900">{pct1(g.pct)}</span>
                  <span className="text-right tabular-nums text-ink-400">{totalGrupos && g.consumo > 0 ? pct1((g.consumo / totalGrupos) * 100) : "—"}</span>
                  <span className="flex items-center justify-end gap-2"><Sparkline valores={g.pctMeses} cor={g.cor} /><ChipTendencia t={g.tend} /></span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* VISÃO 3: CONTAS */}
      {visao === "contas" && contasDoFoco.length > 0 && (
        <Card titulo={`Contas dentro de ${nomeDe(foco)}`} nota={`${contasDoFoco.length} ${contasDoFoco.length === 1 ? "conta" : "contas"} · clique numa conta para abrir o razão (lançamentos)`}>
          <div className="flex flex-col">
            {contasDoFoco.map((c) => (
              <button key={c.classificacao} type="button" onClick={() => setLedgerRow({ kind: "analytic", classificacao: c.classificacao, nome_conta: c.nome, categoria_gerencial: nomeDe(foco), demonstrativo: "DRE", codigo_gerencial: foco })} className="grid grid-cols-[minmax(160px,1.6fr)_120px_2fr_110px_64px_80px] items-center gap-3 border-b border-line py-2 text-left text-[13px] last:border-0 hover:bg-surface-muted/60">
                <span className="truncate" title={c.nome}>{c.nome}</span>
                <span className="text-[11.5px] tabular-nums text-ink-400">{c.classificacao}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${(Math.max(c.consumo, 0) / (contasDoFoco[0]?.consumo || 1)) * 100}%`, background: corDoDepto(foco) }} /></span>
                <span className="text-right tabular-nums text-ink-800">{money(c.consumo)}</span>
                <span className="text-right font-semibold tabular-nums text-ink-900">{pct2(receita ? (c.consumo / receita) * 100 : null)}</span>
                <span className="text-right text-[11.5px] text-ink-400">{c.qtd} lanç.</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-400">O razão abre com todos os lançamentos da conta no período escolhido, igual aos demonstrativos.</p>
        </Card>
      )}

      {visao === "contas" && leafFoco && (
        <Card titulo={`${leafFoco.nome} mês a mês`} nota={`${pct2(leafFoco.pct)} da receita no período · ${money(leafFoco.consumo)}`}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(meses.length, 1)}, minmax(0, 1fr))` }}>
            {meses.map((m, i) => {
              const v = leafFoco.pctMeses[i];
              const reais = -Number(focoRow?.monthValues?.[m] || 0);
              const maxP = Math.max(...leafFoco.pctMeses.filter((x) => x != null), 0.01);
              return (
                <div key={m} className="flex flex-col items-center gap-1 text-[11.5px]">
                  <div className="flex h-[96px] w-full items-end rounded-md bg-surface-muted"><div className="w-full rounded-md" style={{ height: `${v == null ? 0 : Math.max((v / maxP) * 100, 4)}%`, background: leafFoco.cor }} title={`${monthLabel(m)}: ${money(reais)}`} /></div>
                  <span className="font-semibold tabular-nums text-ink-800">{pct1(v)}</span>
                  <span className="text-ink-400">{monthLabel(m)}</span>
                  <span className="tabular-nums text-ink-400">{compacto(reais)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {visao === "contas" && !leafFoco && (
        <>
          {alertas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {alertas.map((f) => (
                <button key={f.code} type="button" onClick={() => abrir(f.code)} className="flex items-center gap-2 rounded-full border border-warning-500/50 bg-warning-50 px-3 py-1 text-[12px] text-warning-700 hover:bg-warning-100">
                  <TriangleAlert size={12} /> <b>{f.nome}</b> {pct1(f.tend.ultimo)} da receita no último mês (média {pct1(f.tend.media)})
                </button>
              ))}
            </div>
          )}

          <Card titulo="Os itens que mais pesam (Pareto)" nota={`${folhas.length} itens · ${corte80 >= 0 ? `${corte80 + 1} deles somam 80% do total` : "veja o acumulado"}`}>
            {pareto.length ? (
              <div className="flex flex-col">
                {pareto.map((f, i) => (
                  <div key={f.code}>
                    <button type="button" onClick={() => abrir(f.code)} title="Abrir as contas deste item" className="grid w-full cursor-pointer grid-cols-[28px_minmax(150px,1.4fr)_2fr_110px_64px_90px] items-center gap-3 border-b border-line py-1.5 text-left text-[13px]">
                      <span className="text-center text-[11px] text-ink-400">{i + 1}</span>
                      <span className="truncate" title={`${f.grupoNome} › ${f.nome}`}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: f.cor }} />{f.nome}{f.grupoNome && <span className="ml-1.5 text-[11px] text-ink-400">{f.grupoNome}</span>}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${(f.consumo / (folhas[0]?.consumo || 1)) * 100}%`, background: f.cor }} /></span>
                      <span className="text-right tabular-nums text-ink-800">{money(f.consumo)}</span>
                      <span className="text-right font-semibold tabular-nums text-ink-900">{pct2(f.pct)}</span>
                      <span className="text-right text-[12px] tabular-nums text-ink-400">acum. {pct1(f.acum)}</span>
                    </button>
                    {i === corte80 && <div className="my-1 flex items-center gap-2 text-[11px] font-semibold text-warning-700"><span className="h-px flex-1 bg-warning-500/50" />até aqui: 80% do total<span className="h-px flex-1 bg-warning-500/50" /></div>}
                  </div>
                ))}
              </div>
            ) : <p className="py-10 text-center text-[13px] text-ink-400">Sem itens com valor neste recorte.</p>}
          </Card>

          {mapaCalor.length > 0 && (
            <Card titulo="Mapa de calor: % da receita, mês a mês" nota="quanto mais escuro, mais pesa naquele mês · ● pico acima do padrão" className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-ink-500">
                    <th className="px-2 py-1.5 text-left font-semibold">Item</th>
                    {meses.map((m) => <th key={m} className="px-1 py-1.5 text-center font-semibold">{monthLabel(m)}</th>)}
                    <th className="px-2 py-1.5 text-right font-semibold">Período</th>
                  </tr>
                </thead>
                <tbody>
                  {mapaCalor.map((f) => {
                    const validos = f.pctMeses.filter((v) => v != null);
                    const max = Math.max(...validos, 0.01);
                    const media = validos.length ? validos.reduce((t, v) => t + v, 0) / validos.length : 0;
                    return (
                      <tr key={f.code}>
                        <td className="max-w-[220px] cursor-pointer truncate whitespace-nowrap px-2 py-1 text-left text-[12.5px] hover:underline" title={`${f.nome} — clique para abrir as contas`} onClick={() => abrir(f.code)}><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: f.cor }} />{f.nome}</td>
                        {f.pctMeses.map((v, i) => (
                          <td key={i} className="px-1 py-1 text-center tabular-nums" style={{ background: v == null ? "transparent" : `color-mix(in srgb, ${f.cor} ${Math.round(10 + (v / max) * 62)}%, transparent)` }}>
                            {v == null ? "" : pct1(v)}{v != null && v > media * 1.35 && v - media >= 0.3 ? <span className="ml-0.5 text-warning-700">●</span> : null}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right font-semibold tabular-nums">{pct1(f.pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

        </>
      )}
      {ledgerRow && <LedgerModal row={ledgerRow} onClose={() => setLedgerRow(null)} />}
    </div>
  );
}
