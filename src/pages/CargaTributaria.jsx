import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Percent } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { fetchCargaTributaria, pctCarga } from "../lib/cargaTributaria.js";
import { money } from "../lib/format.js";

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const moneyFull = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeCurto = (nome) => String(nome || "").split(" (")[0];

function Card({ label, value, hint, tone }) {
  return (
    <div className={`rounded-xl bg-surface-card p-4 shadow-sm ${tone === "warn" ? "border-l-[3px] border-warning-500" : "border-l-[3px] border-line-strong"}`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 text-[20px] font-bold tabular-nums ${tone === "warn" ? "text-warning-700" : "text-ink-900"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  );
}

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
  const dados = row?.dados;
  const periodo = useMemo(() => {
    if (!dados) return null;
    if (sel === "ano") return dados.ano_total;
    if (typeof sel === "string") return dados.trimestres[Number(sel.slice(1)) - 1];
    return dados.meses[sel];
  }, [dados, sel]);
  const titulo = sel === "ano" ? `Ano ${ano}` : typeof sel === "string" ? `${sel.slice(1)}º trimestre de ${ano}` : `${MES_LONGO[sel]} de ${ano}`;

  if (!company || state.activeGroupId) {
    return <p className="rounded-xl bg-surface-card p-6 text-[13px] text-ink-500 shadow-sm">A carga tributária é por empresa — abra uma empresa para ver.</p>;
  }
  if (error) return <p className="rounded-xl bg-danger-50 p-4 text-[13px] text-danger-600">{error}</p>;
  if (rows === null) return <p className="p-6 text-[13px] text-ink-400">Carregando…</p>;
  if (!rows.length || !dados) {
    return (
      <div className="rounded-xl bg-surface-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Percent size={16} /> Carga tributária</p>
        <p className="mt-2 text-[13px] text-ink-500">Ainda não há dados de carga tributária para esta empresa. Eles vêm da apuração fiscal da Domínio e são atualizados todo dia; se a empresa já tem notas e apuração lá, é só aguardar o próximo envio.</p>
      </div>
    );
  }

  const grupos = dados.grupos || [];
  const total = dados.ano_total;
  const maior = [...grupos].sort((a, b) => (periodo.imp[b.id] || 0) - (periodo.imp[a.id] || 0))[0];
  const chart = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], carga: m.carga == null ? 0 : Number((m.carga * 100).toFixed(2)) }));
  const colunas = grupos.filter((g) => total.imp[g.id]);
  const naoClass = Object.entries(total.naoClassificados || {});

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

      <div>
        <p className="mb-2 text-[16px] font-bold text-ink-900">{titulo}<span className="ml-3 text-[12px] font-normal text-ink-400">atualizado em {new Date(row.synced_at).toLocaleString("pt-BR")}</span></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Faturamento" value={moneyFull(periodo.fat.total)} hint={`${periodo.fat.notasServicos + periodo.fat.notasVendas} notas`} />
          <Card label="Impostos próprios" value={moneyFull(periodo.impTotal)} hint="apurados no fiscal (saldo devedor)" />
          <Card label="Carga tributária" value={pctCarga(periodo.carga)} hint="impostos ÷ faturamento" tone="warn" />
          <Card label="Maior imposto" value={periodo.impTotal > 0 && maior ? nomeCurto(maior.nome) : "—"} hint={periodo.impTotal > 0 && maior && periodo.fat.total ? `${pctCarga(periodo.imp[maior.id] / periodo.fat.total)} do faturamento` : ""} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-surface-card p-4 shadow-sm">
        <p className="mb-2 text-[14px] font-semibold text-ink-900">Por imposto <span className="ml-1 text-[12px] font-normal text-ink-400">{titulo}</span></p>
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
                  <td className="px-3 py-2 text-left">{g.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(periodo.imp[g.id])}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{periodo.fat.total ? pctCarga(periodo.imp[g.id] / periodo.fat.total) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pctCarga(parte)}<span className="ml-2 inline-block h-2 rounded bg-accent-500/80 align-middle" style={{ width: `${Math.round(parte * 110)}px` }} /></td>
                </tr>
              );
            })}
            {!periodo.impTotal && <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-400">Sem imposto apurado neste período.</td></tr>}
            <tr className="bg-surface-muted font-bold">
              <td className="px-3 py-2 text-left">Total</td><td className="px-3 py-2 text-right tabular-nums">{money(periodo.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(periodo.carga)}</td><td className="px-3 py-2 text-right">{periodo.impTotal ? "100,00%" : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl bg-surface-card p-4 shadow-sm">
        <p className="mb-2 text-[14px] font-semibold text-ink-900">Mês a mês <span className="ml-1 text-[12px] font-normal text-ink-400">IRPJ e CSLL são trimestrais — caem no último mês do trimestre</span></p>
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
      </div>

      <div className="rounded-xl bg-surface-card p-4 shadow-sm">
        <p className="mb-2 text-[14px] font-semibold text-ink-900">Carga por mês <span className="ml-1 text-[12px] font-normal text-ink-400">os picos de IRPJ/CSLL aparecem no fim de cada trimestre</span></p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga"]} />
              <Bar dataKey="carga" radius={[4, 4, 0, 0]}>
                {chart.map((entry, index) => <Cell key={index} fill={entry.carga > 25 ? "#d97706" : "#2563eb"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
      <div className="rounded-xl bg-surface-card p-4 text-[12.5px] leading-relaxed text-ink-500 shadow-sm">
        <p className="mb-1 text-[14px] font-semibold text-ink-900">Como é calculado</p>
        <p><b className="text-ink-800">Impostos:</b> saldo devedor apurado mês a mês no fiscal da Domínio (ISS, ICMS com DIFAL/ST/antecipação, IPI, PIS, COFINS, CSLL, IRPJ e Simples) — o imposto devido, antes de retenções sofridas e de pagamentos.</p>
        <p><b className="text-ink-800">Faturamento:</b> valor das notas de serviço e das notas de saída de venda, sem canceladas e denegadas.</p>
        <p><b className="text-ink-800">Fora da conta:</b> folha e encargos, impostos retidos na fonte (de terceiros) e IBS/CBS (em 2026 só de teste: {moneyFull((total.reforma?.ibs || 0) + (total.reforma?.cbs || 0))} no ano).</p>
      </div>
    </div>
  );
}
