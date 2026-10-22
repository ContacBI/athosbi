import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Percent } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { fetchCargaTributaria, pctCarga } from "../lib/cargaTributaria.js";
import { money } from "../lib/format.js";

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const COR = { iss: "#2563eb", icms: "#7c3aed", ipi: "#0891b2", pis: "#16a34a", cofins: "#84cc16", csll: "#f59e0b", irpj: "#dc2626", simples: "#db2777", outros: "#64748b" };
const moneyFull = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeCurto = (nome) => String(nome || "").split(" (")[0];
const compacto = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};
const pct1 = (value) => `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const delta = (atual, anterior) => (anterior ? (atual - anterior) / Math.abs(anterior) : null);
const deltaTxt = (value) => (value == null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

function Card({ label, value, hint, tone }) {
  const borda = tone === "warn" ? "border-warning-500" : tone === "ok" ? "border-success-500" : tone === "accent" ? "border-accent-500" : "border-line-strong";
  return (
    <div className={`min-w-0 rounded-xl border-l-[3px] bg-surface-card p-4 shadow-sm ${borda}`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 truncate text-[20px] font-bold tabular-nums ${tone === "warn" ? "text-warning-700" : "text-ink-900"}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  );
}

function Bloco({ titulo, nota, children, className = "" }) {
  return (
    <section className={`rounded-xl bg-surface-card p-4 shadow-sm ${className}`}>
      <p className="mb-3 text-[14px] font-semibold text-ink-900">
        {titulo}
        {nota && <span className="ml-2 text-[12px] font-normal text-ink-400">{nota}</span>}
      </p>
      {children}
    </section>
  );
}

const tooltipMoney = (value, name) => [moneyFull(value), name];

// Carga tributária da empresa aberta: impostos próprios do fiscal ÷ faturamento (valor das notas), mês a mês, por trimestre e no ano.
// Só empresa (grupo não tem). Dados mandados pela Central — ver lib/cargaTributaria.js.
export default function CargaTributaria() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const [rows, setRows] = useState(null); // null = carregando
  const [error, setError] = useState("");
  const [ano, setAno] = useState(null);
  const [sel, setSel] = useState("ano"); // "ano" | "T1".."T4" | 0..11

  useEffect(() => {
    if (!company || state.activeGroupId) return undefined;
    let ativo = true;
    setRows(null);
    setError("");
    fetchCargaTributaria(company.id)
      .then((data) => {
        if (!ativo) return;
        setRows(data);
        setAno((atual) => (atual && data.some((row) => row.ano === atual) ? atual : data[0]?.ano ?? null));
      })
      .catch((err) => {
        console.error("Falha ao ler a carga tributária:", err);
        if (ativo) setError("Não consegui carregar a carga tributária agora. Tente de novo.");
      });
    return () => {
      ativo = false;
    };
  }, [company?.id, state.activeGroupId]);

  const row = useMemo(() => (rows || []).find((item) => item.ano === ano) || null, [rows, ano]);
  const anterior = useMemo(() => (rows || []).find((item) => item.ano === ano - 1) || null, [rows, ano]);
  const dados = row?.dados;

  const view = useMemo(() => {
    if (!dados) return null;
    const grupos = dados.grupos || [];
    const total = dados.ano_total;
    const periodo = sel === "ano" ? total : typeof sel === "string" ? dados.trimestres[Number(sel.slice(1)) - 1] : dados.meses[sel];
    const colunas = grupos.filter((g) => total.imp[g.id]);
    const comDados = dados.meses.map((m, i) => ({ m, i })).filter(({ m }) => m.fat.total || m.impTotal);
    // evolução: valores por imposto + carga do mês
    const evolucao = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], carga: m.carga == null ? null : Number((m.carga * 100).toFixed(2)), ...Object.fromEntries(colunas.map((g) => [g.id, m.imp[g.id] || 0])) }));
    // acumulada no ano (impostos acumulados ÷ faturamento acumulado), só até o último mês com dados
    let fa = 0;
    let ia = 0;
    const ultimo = comDados.length ? comDados[comDados.length - 1].i : -1;
    const acumulada = dados.meses.slice(0, ultimo + 1).map((m, i) => {
      fa += m.fat.total;
      ia += m.impTotal;
      return { mes: MES_CURTO[i], carga: fa ? Number(((ia / fa) * 100).toFixed(2)) : null, impostos: ia, faturamento: fa };
    });
    const fatMes = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], servicos: m.fat.servicos, vendas: m.fat.vendas }));
    const tri = dados.trimestres.map((t, i) => ({ nome: `${i + 1}º tri`, carga: t.carga == null ? 0 : Number((t.carga * 100).toFixed(2)), impostos: t.impTotal, faturamento: t.fat.total }));
    const pizza = colunas.map((g) => ({ id: g.id, nome: nomeCurto(g.nome), valor: periodo.imp[g.id] || 0 })).filter((x) => x.valor > 0);
    // carga "corrente": sem IRPJ/CSLL (trimestrais) — mostra o peso dos tributos mensais
    const mensais = (p) => (p.impTotal - (p.imp.irpj || 0) - (p.imp.csll || 0));
    const cargaCorrente = periodo.fat.total ? mensais(periodo) / periodo.fat.total : null;
    const cargasMeses = comDados.filter(({ m }) => m.carga != null);
    const maiorMes = cargasMeses.length ? cargasMeses.reduce((a, b) => (b.m.carga > a.m.carga ? b : a)) : null;
    const menorMes = cargasMeses.length ? cargasMeses.reduce((a, b) => (b.m.carga < a.m.carga ? b : a)) : null;
    const nMeses = sel === "ano" ? comDados.length : typeof sel === "string" ? dados.meses.slice((Number(sel.slice(1)) - 1) * 3, Number(sel.slice(1)) * 3).filter((m) => m.fat.total || m.impTotal).length : 1;
    // mapa de calor: valor de cada imposto por mês, intensidade relativa ao maior da linha
    const calor = colunas.map((g) => {
      const vals = dados.meses.map((m) => m.imp[g.id] || 0);
      return { g, vals, max: Math.max(...vals, 1) };
    });
    return { grupos, total, periodo, colunas, comDados, evolucao, acumulada, fatMes, tri, pizza, cargaCorrente, maiorMes, menorMes, nMeses, calor };
  }, [dados, sel]);

  const titulo = sel === "ano" ? `Ano ${ano}` : typeof sel === "string" ? `${sel.slice(1)}º trimestre de ${ano}` : `${MES_LONGO[sel]} de ${ano}`;

  if (!company || state.activeGroupId) {
    return <p className="rounded-xl bg-surface-card p-6 text-[13px] text-ink-500 shadow-sm">A carga tributária é por empresa — abra uma empresa para ver.</p>;
  }
  if (error) return <p className="rounded-xl bg-danger-50 p-4 text-[13px] text-danger-600">{error}</p>;
  if (rows === null) return <p className="p-6 text-[13px] text-ink-400">Carregando…</p>;
  if (!rows.length || !dados || !view) {
    return (
      <div className="rounded-xl bg-surface-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Percent size={16} /> Carga tributária</p>
        <p className="mt-2 text-[13px] text-ink-500">Ainda não há dados de carga tributária para esta empresa. Eles vêm da apuração fiscal da Domínio e são atualizados todo dia; se a empresa já tem notas e apuração lá, é só aguardar o próximo envio.</p>
      </div>
    );
  }

  const { grupos, total, periodo, colunas, evolucao, acumulada, fatMes, tri, pizza, cargaCorrente, maiorMes, menorMes, nMeses, calor } = view;
  const maior = [...grupos].sort((a, b) => (periodo.imp[b.id] || 0) - (periodo.imp[a.id] || 0))[0];
  const naoClass = Object.entries(total.naoClassificados || {});
  const temVendas = total.fat.vendas > 0;
  const tAnt = anterior?.dados?.ano_total;

  const linha = (rotulo, m, extra = "") => (
    <tr key={rotulo} className={`border-b border-line ${extra}`}>
      <td className="px-3 py-2 text-left text-[12.5px]">{rotulo}</td>
      <td className="px-3 py-2 text-right tabular-nums">{money(m.fat.total)}</td>
      {colunas.map((g) => <td key={g.id} className={`px-3 py-2 text-right tabular-nums ${m.imp[g.id] ? "" : "text-ink-300"}`}>{m.imp[g.id] ? money(m.imp[g.id]) : "–"}</td>)}
      <td className="px-3 py-2 text-right tabular-nums">{money(m.impTotal)}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{pctCarga(m.carga)}</td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* cabeçalho + período */}
      <div className="rounded-xl bg-surface-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Percent size={16} /> Carga tributária</p>
            <p className="mt-0.5 max-w-2xl text-[12px] text-ink-400">Os impostos próprios apurados no fiscal da Domínio sobre o faturamento (valor das notas): quanto a empresa realmente paga de imposto para cada R$ 1 faturado.</p>
          </div>
          <div className="inline-flex rounded-full bg-surface-muted p-1">
            {rows.map((item) => (
              <button key={item.ano} type="button" onClick={() => { setAno(item.ano); setSel("ano"); }} className={`rounded-full px-3 py-1 text-[12.5px] ${ano === item.ano ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : "text-ink-500"}`}>
                {item.ano}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1">
          {dados.meses.map((m, i) => {
            const vazio = !m.fat.total && !m.impTotal;
            return (
              <button key={i} type="button" onClick={() => setSel(i)} className={`flex min-w-[58px] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[12px] ${sel === i ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : vazio ? "text-ink-300" : "text-ink-600 hover:bg-surface-card/60"}`}>
                {MES_CURTO[i]}
                <small className="text-[10.5px] text-ink-400">{m.carga == null ? "—" : pctCarga(m.carga)}</small>
              </button>
            );
          })}
          {[1, 2, 3, 4].map((q) => (
            <button key={q} type="button" onClick={() => setSel(`T${q}`)} className={`flex min-w-[58px] flex-col items-center gap-0.5 rounded-lg border-l border-line px-1 py-1.5 text-[12px] ${sel === `T${q}` ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : "text-ink-600 hover:bg-surface-card/60"}`}>
              {q}º tri
              <small className="text-[10.5px] text-ink-400">{pctCarga(dados.trimestres[q - 1].carga)}</small>
            </button>
          ))}
          <button type="button" onClick={() => setSel("ano")} className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg border-l border-line px-1 py-1.5 text-[12px] ${sel === "ano" ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : "text-ink-600 hover:bg-surface-card/60"}`}>
            Ano
            <small className="text-[10.5px] text-ink-400">{pctCarga(total.carga)}</small>
          </button>
        </div>
      </div>

      {/* indicadores do período escolhido */}
      <div>
        <p className="mb-2 text-[16px] font-bold text-ink-900">{titulo}<span className="ml-3 text-[12px] font-normal text-ink-400">atualizado em {new Date(row.synced_at).toLocaleString("pt-BR")}</span></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Faturamento" value={moneyFull(periodo.fat.total)} hint={`${periodo.fat.notasServicos + periodo.fat.notasVendas} notas${temVendas ? ` · serviços ${compacto(periodo.fat.servicos)} · vendas ${compacto(periodo.fat.vendas)}` : ""}`} tone="accent" />
          <Card label="Impostos próprios" value={moneyFull(periodo.impTotal)} hint="apurados no fiscal (saldo devedor)" />
          <Card label="Carga tributária" value={pctCarga(periodo.carga)} hint="impostos ÷ faturamento" tone="warn" />
          <Card label="A cada R$ 100 faturados" value={periodo.carga == null ? "—" : moneyFull(periodo.carga * 100)} hint="vão para impostos" />
          <Card label="Carga sem IRPJ e CSLL" value={pctCarga(cargaCorrente)} hint="só os tributos mensais (ISS, PIS, COFINS, ICMS…)" />
          <Card label="Maior imposto" value={periodo.impTotal > 0 && maior ? nomeCurto(maior.nome) : "—"} hint={periodo.impTotal > 0 && maior && periodo.impTotal ? `${pctCarga(periodo.imp[maior.id] / periodo.impTotal)} dos impostos` : ""} />
          <Card label="Média mensal de impostos" value={nMeses ? moneyFull(periodo.impTotal / nMeses) : "—"} hint={`${nMeses} ${nMeses === 1 ? "mês" : "meses"} com movimento`} />
          <Card label="Pico / menor carga do ano" value={maiorMes ? `${MES_CURTO[maiorMes.i]} ${pctCarga(maiorMes.m.carga)}` : "—"} hint={menorMes ? `menor: ${MES_CURTO[menorMes.i]} ${pctCarga(menorMes.m.carga)}` : ""} />
        </div>
      </div>

      {/* composição + por imposto */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Bloco titulo="Composição dos impostos" nota={titulo} className="xl:col-span-2">
          {pizza.length ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius={62} outerRadius={98} paddingAngle={2}>
                    {pizza.map((p) => <Cell key={p.id} fill={COR[p.id] || "#64748b"} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [moneyFull(value), name]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-[13px] text-ink-400">Sem imposto apurado neste período.</p>
          )}
        </Bloco>
        <Bloco titulo="Por imposto" nota={titulo} className="overflow-x-auto xl:col-span-3">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-[10.5px] uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 text-left font-semibold">Imposto</th><th className="px-3 py-2 text-right font-semibold">Valor</th><th className="px-3 py-2 text-right font-semibold">% do faturamento</th><th className="px-3 py-2 text-right font-semibold">% dos impostos</th>
              </tr>
            </thead>
            <tbody>
              {grupos.filter((g) => periodo.imp[g.id]).map((g) => {
                const parte = periodo.impTotal ? periodo.imp[g.id] / periodo.impTotal : 0;
                return (
                  <tr key={g.id} className="border-b border-line">
                    <td className="px-3 py-2 text-left"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COR[g.id] || "#64748b" }} />{g.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(periodo.imp[g.id])}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{periodo.fat.total ? pctCarga(periodo.imp[g.id] / periodo.fat.total) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pctCarga(parte)}<span className="ml-2 inline-block h-2 rounded align-middle" style={{ width: `${Math.round(parte * 90)}px`, background: COR[g.id] || "#64748b" }} /></td>
                  </tr>
                );
              })}
              {!periodo.impTotal && <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-400">Sem imposto apurado neste período.</td></tr>}
              <tr className="bg-surface-muted font-bold">
                <td className="px-3 py-2 text-left">Total</td><td className="px-3 py-2 text-right tabular-nums">{money(periodo.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(periodo.carga)}</td><td className="px-3 py-2 text-right">{periodo.impTotal ? "100,00%" : "—"}</td>
              </tr>
            </tbody>
          </table>
        </Bloco>
      </div>

      {/* evolução mensal */}
      <Bloco titulo={`Evolução mensal de ${ano}`} nota="barras: impostos por tipo (R$) · linha: carga do mês (%) — IRPJ e CSLL caem no fim de cada trimestre">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="v" tick={{ fontSize: 12 }} tickFormatter={compacto} />
              <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value, name) => (name === "Carga" ? [`${Number(value).toLocaleString("pt-BR")}%`, name] : [moneyFull(value), name])} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {colunas.map((g) => <Bar key={g.id} yAxisId="v" dataKey={g.id} name={nomeCurto(g.nome)} stackId="imp" fill={COR[g.id] || "#64748b"} />)}
              <Line yAxisId="p" type="monotone" dataKey="carga" name="Carga" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Bloco>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco titulo="Carga acumulada no ano" nota="impostos acumulados ÷ faturamento acumulado, mês a mês">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={acumulada} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value, name) => (name === "Carga acumulada" ? [`${Number(value).toLocaleString("pt-BR")}%`, name] : [moneyFull(value), name])} />
                <Area type="monotone" dataKey="carga" name="Carga acumulada" stroke="#d97706" fill="#d97706" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="Faturamento por mês" nota={temVendas ? "serviços e vendas" : "notas de serviço"}>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fatMes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={compacto} />
                <Tooltip formatter={tooltipMoney} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="servicos" name="Serviços" stackId="f" fill="#2563eb" />
                {temVendas && <Bar dataKey="vendas" name="Vendas" stackId="f" fill="#0891b2" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
      </div>

      {/* trimestres */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco titulo="Carga por trimestre" nota="o trimestre é a comparação mais justa, porque IRPJ e CSLL são trimestrais">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tri} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga"]} />
                <Bar dataKey="carga" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, formatter: (v) => (v ? pct1(v) : "") }}>
                  {tri.map((t, index) => <Cell key={index} fill={sel === `T${index + 1}` ? "#d97706" : "#2563eb"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="Trimestre a trimestre" className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-[10.5px] uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 text-left font-semibold">Trimestre</th><th className="px-3 py-2 text-right font-semibold">Faturamento</th><th className="px-3 py-2 text-right font-semibold">Impostos</th><th className="px-3 py-2 text-right font-semibold">Carga</th>
              </tr>
            </thead>
            <tbody>
              {dados.trimestres.map((t, i) => (
                <tr key={i} className={`border-b border-line ${sel === `T${i + 1}` ? "bg-accent-500/10" : ""}`}>
                  <td className="px-3 py-2 text-left">{i + 1}º trimestre</td><td className="px-3 py-2 text-right tabular-nums">{money(t.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{money(t.impTotal)}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{pctCarga(t.carga)}</td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-bold">
                <td className="px-3 py-2 text-left">Ano {ano}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(total.carga)}</td>
              </tr>
            </tbody>
          </table>
        </Bloco>
      </div>

      {/* comparativo com o ano anterior */}
      {tAnt && (
        <Bloco titulo={`Comparativo ${ano} × ${ano - 1}`} nota="ano inteiro" className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-[10.5px] uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 text-left font-semibold"> </th><th className="px-3 py-2 text-right font-semibold">{ano - 1}</th><th className="px-3 py-2 text-right font-semibold">{ano}</th><th className="px-3 py-2 text-right font-semibold">Variação</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line font-semibold"><td className="px-3 py-2 text-left">Faturamento</td><td className="px-3 py-2 text-right tabular-nums">{money(tAnt.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{deltaTxt(delta(total.fat.total, tAnt.fat.total))}</td></tr>
              {grupos.filter((g) => total.imp[g.id] || tAnt.imp[g.id]).map((g) => (
                <tr key={g.id} className="border-b border-line">
                  <td className="px-3 py-2 text-left">{g.nome}</td><td className="px-3 py-2 text-right tabular-nums">{money(tAnt.imp[g.id])}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.imp[g.id])}</td><td className="px-3 py-2 text-right tabular-nums">{deltaTxt(delta(total.imp[g.id], tAnt.imp[g.id]))}</td>
                </tr>
              ))}
              <tr className="border-b border-line font-semibold"><td className="px-3 py-2 text-left">Total de impostos</td><td className="px-3 py-2 text-right tabular-nums">{money(tAnt.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{deltaTxt(delta(total.impTotal, tAnt.impTotal))}</td></tr>
              <tr className="bg-surface-muted font-bold"><td className="px-3 py-2 text-left">Carga tributária</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(tAnt.carga)}</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(total.carga)}</td><td className="px-3 py-2 text-right tabular-nums">{tAnt.carga != null && total.carga != null ? `${((total.carga - tAnt.carga) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p.` : "—"}</td></tr>
            </tbody>
          </table>
        </Bloco>
      )}

      {/* mapa de calor */}
      <Bloco titulo="Mapa de calor dos impostos" nota="quanto mais forte a cor, maior o valor do imposto naquele mês" className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-ink-500">
              <th className="px-2 py-1.5 text-left font-semibold">Imposto</th>
              {MES_CURTO.map((m) => <th key={m} className="px-2 py-1.5 text-center font-semibold">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {calor.map(({ g, vals, max }) => (
              <tr key={g.id}>
                <td className="whitespace-nowrap px-2 py-1 text-left text-[12.5px]">{nomeCurto(g.nome)}</td>
                {vals.map((v, i) => (
                  <td key={i} title={v ? `${nomeCurto(g.nome)} · ${MES_LONGO[i]}: ${moneyFull(v)}` : ""} className="px-1 py-1 text-center tabular-nums" style={{ background: v ? `color-mix(in srgb, ${COR[g.id] || "#64748b"} ${Math.round(12 + (v / max) * 70)}%, transparent)` : "transparent" }}>
                    {v ? compacto(v) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      {/* mês a mês */}
      <Bloco titulo="Mês a mês" nota="IRPJ e CSLL são trimestrais — caem no último mês do trimestre" className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line-strong text-[10.5px] uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2 text-left font-semibold">Mês</th><th className="px-3 py-2 text-right font-semibold">Faturamento</th>
              {colunas.map((g) => <th key={g.id} className="px-3 py-2 text-right font-semibold">{nomeCurto(g.nome)}</th>)}
              <th className="px-3 py-2 text-right font-semibold">Impostos</th><th className="px-3 py-2 text-right font-semibold">Carga</th>
            </tr>
          </thead>
          <tbody>
            {dados.meses.flatMap((m, i) => {
              const out = [linha(MES_LONGO[i], m)];
              if (i % 3 === 2) out.push(linha(`${Math.floor(i / 3) + 1}º trimestre`, dados.trimestres[Math.floor(i / 3)], "bg-accent-500/10 font-semibold"));
              return out;
            })}
            {linha(`Ano ${ano}`, total, "bg-surface-muted font-bold")}
          </tbody>
        </table>
      </Bloco>

      {/* avisos e metodologia */}
      {naoClass.length > 0 && (
        <div className="rounded-lg border-l-[3px] border-warning-500 bg-warning-50 px-3 py-2 text-[12.5px] text-warning-700">
          Impostos fora do catálogo (não entraram na carga — confira): {naoClass.map(([nome, valor]) => `${nome} ${moneyFull(valor)}`).join(" · ")}
        </div>
      )}
      {total.fat.outrasSaidas > 0 && (
        <div className="rounded-lg border-l-[3px] border-warning-500 bg-warning-50 px-3 py-2 text-[12.5px] text-warning-700">
          Saídas que não contam como faturamento (devolução, remessa, transferência…): {moneyFull(total.fat.outrasSaidas)} no ano.
        </div>
      )}
      {(total.reforma?.ibs || total.reforma?.cbs) > 0 && (
        <div className="rounded-lg border-l-[3px] border-accent-500 bg-accent-500/10 px-3 py-2 text-[12.5px] text-ink-700">
          <b>Reforma tributária (valores de teste de {ano}):</b> IBS {moneyFull(total.reforma.ibs)} · CBS {moneyFull(total.reforma.cbs)}. Não entram na carga acima; somados, a carga seria {pctCarga(total.fat.total ? (total.impTotal + total.reforma.ibs + total.reforma.cbs) / total.fat.total : null)}.
        </div>
      )}
      <div className="rounded-xl bg-surface-card p-4 text-[12.5px] leading-relaxed text-ink-500 shadow-sm">
        <p className="mb-1 text-[14px] font-semibold text-ink-900">Como é calculado</p>
        <p><b className="text-ink-800">Impostos:</b> saldo devedor apurado mês a mês no fiscal da Domínio (ISS, ICMS com DIFAL/ST/antecipação, IPI, PIS, COFINS, CSLL, IRPJ e Simples) — o imposto devido, antes de retenções sofridas e de pagamentos.</p>
        <p><b className="text-ink-800">Faturamento:</b> valor das notas de serviço e das notas de saída de venda, sem canceladas e denegadas.</p>
        <p><b className="text-ink-800">Fora da conta:</b> folha e encargos, impostos retidos na fonte (de terceiros) e IBS/CBS (em 2026 só de teste).</p>
      </div>
    </div>
  );
}
