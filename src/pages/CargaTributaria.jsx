import { Fragment, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, LabelList, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Percent, SlidersHorizontal } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { saveCargaContabil, saveCargaLayout, saveCargaManual } from "../lib/companies.js";
import { aplicarContabil, aplicarManual, fetchCargaTributaria, pctCarga, somarCargas } from "../lib/cargaTributaria.js";
import { groupCompanies } from "../lib/groups.js";
import { money } from "../lib/format.js";

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const COR = { iss: "#2563eb", icms: "#7c3aed", ipi: "#0891b2", pis: "#16a34a", cofins: "#84cc16", csll: "#f59e0b", irpj: "#dc2626", simples: "#db2777", cpp: "#be185d", outros: "#64748b",
  irrf: "#0ea5e9", pcc: "#14b8a6", inss_ret: "#8b5cf6", iss_ret: "#3b82f6", icms_ret: "#a855f7", inss_folha: "#f97316", fgts: "#eab308", irrf_folha: "#06b6d4", outras_folha: "#94a3b8" };
const moneyFull = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeCurto = (nome) => String(nome || "").split(" (")[0];
const compacto = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};
const numBR = (texto) => {
  const n = Number(String(texto ?? "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const pct1 = (value) => `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const delta = (atual, anterior) => (anterior ? (atual - anterior) / Math.abs(anterior) : null);
const deltaTxt = (value) => (value == null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const fracao = (valor, base) => (base ? pctCarga(valor / base) : "—");

function Card({ label, value, hint, tone }) {
  const borda = tone === "warn" ? "border-warning-500" : tone === "accent" ? "border-accent-500" : "border-line-strong";
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

function Stat({ label, value, hint }) {
  return (
    <div className="min-w-[130px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  );
}

const TH = "px-3 py-2 text-right font-semibold";
const CABECALHO = "border-b border-line-strong text-[10.5px] uppercase tracking-wide text-ink-500";

// Tabela "um imposto por linha" (valor, % do faturamento e % do total) usada pelos próprios, retidos e folha.
function TabelaGrupos({ grupos, valores, total, faturamento, vazio }) {
  const linhas = grupos.filter((g) => valores[g.id]);
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className={CABECALHO}>
          <th className="px-3 py-2 text-left font-semibold">Imposto</th><th className={TH}>Valor</th><th className={TH}>% do faturamento</th><th className={TH}>% do total</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((g) => {
          const parte = total ? valores[g.id] / total : 0;
          return (
            <tr key={g.id} className="border-b border-line">
              <td className="px-3 py-2 text-left"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COR[g.id] || "#64748b" }} />{g.nome}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(valores[g.id])}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fracao(valores[g.id], faturamento)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pctCarga(parte)}<span className="ml-2 inline-block h-2 rounded align-middle" style={{ width: `${Math.round(parte * 90)}px`, background: COR[g.id] || "#64748b" }} /></td>
            </tr>
          );
        })}
        {!linhas.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-400">{vazio}</td></tr>}
        <tr className="bg-surface-muted font-bold">
          <td className="px-3 py-2 text-left">Total</td><td className="px-3 py-2 text-right tabular-nums">{money(total)}</td><td className="px-3 py-2 text-right tabular-nums">{fracao(total, faturamento)}</td><td className="px-3 py-2 text-right">{total ? "100,00%" : "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

// Blocos da tela. kind "kpi" = cartão de indicador (cartões seguidos formam uma grade); "bloco" = seção. `padrao`: já vem ligado (o essencial).
// A escolha de quais blocos aparecem, e a ordem, é de cada empresa (company.cargaLayout) -- botão Personalizar.
const BLOCOS = [
  { id: "resumo", kind: "bloco", padrao: true, nome: "Resumo (carga, faturamento e quanto cada imposto pesa)" },
  { id: "avisos", kind: "bloco", padrao: true, nome: "Avisos" },
  { id: "por-empresa", kind: "bloco", padrao: true, nome: "Por empresa (aparece só no grupo)" },
  { id: "painel", kind: "bloco", padrao: true, nome: "Painel (R$ 100 faturados e faturamento × impostos por mês)" },
  { id: "kpi-fat", kind: "kpi", nome: "Faturamento" },
  { id: "kpi-imp", kind: "kpi", nome: "Impostos próprios" },
  { id: "kpi-carga", kind: "kpi", nome: "Carga tributária" },
  { id: "kpi-maior", kind: "kpi", nome: "Maior imposto" },
  { id: "kpi-100", kind: "kpi", nome: "A cada R$ 100 faturados" },
  { id: "kpi-corrente", kind: "kpi", nome: "Carga sem IRPJ e CSLL" },
  { id: "kpi-media", kind: "kpi", nome: "Média mensal de impostos" },
  { id: "kpi-pico", kind: "kpi", nome: "Pico e menor carga do ano" },
  { id: "kpi-ret", kind: "kpi", nome: "Impostos retidos na fonte" },
  { id: "kpi-folha", kind: "kpi", nome: "Encargos da folha" },
  { id: "kpi-total", kind: "kpi", nome: "Carga com retidos e folha" },
  { id: "composicao", kind: "bloco", padrao: true, nome: "Composição dos impostos (rosca e tabela)" },
  { id: "impacto", kind: "bloco", nome: "Impacto dos impostos na receita (cascata)" },
  { id: "carga-mes", kind: "bloco", padrao: true, nome: "Carga por mês e por trimestre (gráficos)" },
  { id: "por-imposto", kind: "bloco", nome: "Por imposto (só a tabela)" },
  { id: "retidos", kind: "bloco", nome: "Impostos retidos na fonte" },
  { id: "folha", kind: "bloco", nome: "Encargos da folha" },
  { id: "visao-completa", kind: "bloco", nome: "Visão completa (todos os tributos)" },
  { id: "evolucao", kind: "bloco", nome: "Evolução mensal por imposto" },
  { id: "acumulada", kind: "bloco", nome: "Carga acumulada no ano" },
  { id: "faturamento-mes", kind: "bloco", nome: "Faturamento por mês" },
  { id: "trimestres", kind: "bloco", nome: "Carga por trimestre" },
  { id: "comparativo", kind: "bloco", nome: "Comparativo com o ano anterior" },
  { id: "calor", kind: "bloco", nome: "Mapa de calor dos impostos" },
  { id: "mes-a-mes", kind: "bloco", nome: "Tabela mês a mês" },
  { id: "metodologia", kind: "bloco", nome: "Como é calculado" },
];
const PADRAO = BLOCOS.filter((b) => b.padrao).map((b) => b.id);
const POR_ID = new Map(BLOCOS.map((b) => [b.id, b]));

// Carga tributária da empresa aberta: impostos próprios do fiscal ÷ faturamento (valor das notas), mais retidos e folha à parte.
// Só empresa (grupo não tem). Dados mandados pela Central — ver lib/cargaTributaria.js.
export default function CargaTributaria() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : []), [grupo, state.companies]);
  const [brutosGrupo, setBrutosGrupo] = useState(null); // { [companyId]: linhas do dominio_carga }
  const [rowsEmpresa, setRows] = useState(null); // null = carregando
  const [error, setError] = useState("");
  const [ano, setAno] = useState(null);
  const [sel, setSel] = useState("ano"); // "ano" | "T1".."T4" | 0..11
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(null); // { ordem: [ids de todos os blocos], ligados: Set }
  const [salvando, setSalvando] = useState(false);
  const [empresasAbertas, setEmpresasAbertas] = useState(() => new Set()); // empresas do grupo com os tributos abertos na tabela "Por empresa"
  const alternarEmpresa = (id) => setEmpresasAbertas((atual) => { const novo = new Set(atual); if (novo.has(id)) novo.delete(id); else novo.add(id); return novo; });

  // Grupo: cada empresa com os seus valores informados à mão e a sua opção do contábil, e depois a soma de todas.
  const dadosDaEmpresa = (membro, ano) => {
    const linha = (brutosGrupo?.[membro.id] || []).find((item) => item.ano === ano);
    if (!linha?.dados) return null;
    const comManual = aplicarManual(linha.dados, (membro.cargaManual || {})[String(ano)]);
    return membro.cargaContabil ? aplicarContabil(comManual) : comManual;
  };
  const rowsGrupo = useMemo(() => {
    if (!grupo || !brutosGrupo) return null;
    const anos = [...new Set(Object.values(brutosGrupo).flatMap((linhas) => linhas.map((item) => item.ano)))].sort((a, b) => b - a);
    return anos
      .map((ano) => {
        const dados = somarCargas(membros.map((membro) => dadosDaEmpresa(membro, ano)));
        const synced = Object.values(brutosGrupo).flatMap((linhas) => linhas.filter((item) => item.ano === ano).map((item) => item.synced_at)).sort().pop();
        return dados ? { ano, dados, synced_at: synced } : null;
      })
      .filter(Boolean);
  }, [grupo, membros, brutosGrupo]);
  const rows = grupo ? rowsGrupo : rowsEmpresa;

  const podeEditar = Boolean(!grupo && state.isAdmin || (!grupo && company && (company.responsaveis || []).includes(state.userEmail)));
  const salvo = Array.isArray(company?.cargaLayout) ? company.cargaLayout.filter((id) => POR_ID.has(id)) : PADRAO;
  const ligados = editando && rascunho ? BLOCOS.map((b) => b.id).filter((id) => rascunho.ligados.has(id)).sort((a, b) => rascunho.ordem.indexOf(a) - rascunho.ordem.indexOf(b)) : salvo;

  // Grupo: lê a carga de cada empresa membro (a soma é feita em rowsGrupo).
  const idsMembros = membros.map((membro) => membro.id).join(",");
  useEffect(() => {
    if (!grupo) return undefined;
    let ativo = true;
    setBrutosGrupo(null);
    setError("");
    Promise.all(membros.map((membro) => fetchCargaTributaria(membro.id).then((linhas) => [membro.id, linhas])))
      .then((pares) => {
        if (ativo) setBrutosGrupo(Object.fromEntries(pares));
      })
      .catch((err) => {
        console.error("Falha ao ler a carga tributária do grupo:", err);
        if (ativo) setError("Não consegui carregar a carga tributária do grupo agora. Tente de novo.");
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo?.id, idsMembros]);
  useEffect(() => {
    if (!grupo || !rowsGrupo) return;
    setAno((atual) => (atual && rowsGrupo.some((item) => item.ano === atual) ? atual : rowsGrupo[0]?.ano ?? null));
  }, [grupo, rowsGrupo]);

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
  const dadosCentral = row?.dados;
  const usarContabil = grupo ? false : Boolean(company?.cargaContabil);
  const manualAno = grupo ? {} : (company?.cargaManual || {})[String(ano)] || {};
  // Meses sem fiscal (ex.: empresa nova na Domínio): faturamento e impostos informados à mão entram no lugar. Valor informado de um imposto
  // substitui o que o contábil tiver pra ele naquele mês (não soma duas vezes). Mês, trimestre e ano são refeitos a partir disso.
  const dadosBrutos = useMemo(() => {
    if (!dadosCentral || !Object.keys(manualAno).length) return dadosCentral;
    const meses = dadosCentral.meses.map((m) => ({ ...m, fat: { ...m.fat }, imp: { ...m.imp }, contabil: { ...(m.contabil || {}) } }));
    const tri = dadosCentral.trimestres.map((t) => ({ ...t, fat: { ...t.fat }, imp: { ...t.imp }, contabil: { ...(t.contabil || {}) } }));
    const tot = { ...dadosCentral.ano_total, fat: { ...dadosCentral.ano_total.fat }, imp: { ...dadosCentral.ano_total.imp }, contabil: { ...(dadosCentral.ano_total.contabil || {}) } };
    const aplicar = (p, m, cont) => {
      p.fat.total = (p.fat.total || 0) + (m.fat || 0);
      p.fat.servicos = (p.fat.servicos || 0) + (m.fat || 0);
      for (const [id, v] of Object.entries(m.imp || {})) {
        p.imp[id] = (p.imp[id] || 0) + v;
        p.impTotal = (p.impTotal || 0) + v;
        p.contabil[id] = Math.max((p.contabil[id] || 0) - cont[id], 0); // o que o contábil tinha desse imposto no mês sai (o informado vale no lugar)
        p.contabilTotal = Math.max((p.contabilTotal || 0) - cont[id], 0);
      }
      p.carga = p.fat.total ? p.impTotal / p.fat.total : null;
    };
    for (const [mesTxt, m] of Object.entries(manualAno)) {
      const i = Number(mesTxt);
      const base = meses[i];
      if (!base || base.fat.total || base.impTotal) continue; // só vale em mês que o fiscal não tem
      const cont = Object.fromEntries(Object.keys(m.imp || {}).map((id) => [id, Math.min(base.contabil[id] || 0, m.imp[id])]));
      for (const alvo of [base, tri[Math.floor(i / 3)], tot]) aplicar(alvo, m, cont);
      base.manual = true;
    }
    return { ...dadosCentral, meses, trimestres: tri, ano_total: tot };
  }, [dadosCentral, company?.cargaManual, ano]);
  // Contábil por cima (se a empresa escolheu considerá-lo).
  const dados = useMemo(() => {
    if (!dadosBrutos || !usarContabil) return dadosBrutos;
    const soma = (p) => {
      if (!p?.contabilTotal) return p;
      const imp = { ...p.imp };
      for (const [id, v] of Object.entries(p.contabil || {})) imp[id] = (imp[id] || 0) + v;
      const impTotal = p.impTotal + p.contabilTotal;
      return { ...p, imp, impTotal, carga: p.fat?.total ? impTotal / p.fat.total : p.carga };
    };
    return { ...dadosBrutos, meses: dadosBrutos.meses.map(soma), trimestres: dadosBrutos.trimestres.map(soma), ano_total: soma(dadosBrutos.ano_total) };
  }, [dadosBrutos, usarContabil]);
  const [manualForm, setManualForm] = useState({ fat: "", imp: {} });
  const [salvandoManual, setSalvandoManual] = useState(false);
  const mesSel = typeof sel === "number" ? sel : null;
  const mesCentral = mesSel != null ? dadosCentral?.meses?.[mesSel] : null;
  const mesSemFiscal = Boolean(mesCentral && !mesCentral.fat.total && !mesCentral.impTotal);
  useEffect(() => {
    const m = mesSel != null ? manualAno[mesSel] : null;
    setManualForm({ fat: m?.fat ? String(m.fat).replace(".", ",") : "", imp: Object.fromEntries(Object.entries(m?.imp || {}).map(([id, v]) => [id, String(v).replace(".", ",")])) });
  }, [mesSel, ano, company?.id]);
  async function salvarManual(limpar) {
    setSalvandoManual(true);
    try {
      const imp = Object.fromEntries(Object.entries(manualForm.imp).map(([id, v]) => [id, numBR(v)]).filter(([, v]) => v > 0));
      const fat = numBR(manualForm.fat);
      await saveCargaManual(ano, mesSel, limpar || (!fat && !Object.keys(imp).length) ? null : { fat, imp });
    } catch (err) {
      console.error("Falha ao salvar os valores informados:", err);
      setError(/recarregue/i.test(err?.message || "") ? err.message : "Não consegui salvar agora. Tente de novo.");
    } finally {
      setSalvandoManual(false);
    }
  }
  const [salvandoContabil, setSalvandoContabil] = useState(false);
  async function alternarContabil() {
    setSalvandoContabil(true);
    try {
      await saveCargaContabil(!usarContabil);
    } catch (err) {
      console.error("Falha ao salvar a opção de impostos do contábil:", err);
      setError(/recarregue/i.test(err?.message || "") ? err.message : "Não consegui salvar agora. Tente de novo.");
    } finally {
      setSalvandoContabil(false);
    }
  }

  const c = useMemo(() => {
    if (!dados) return null;
    const grupos = dados.grupos || [];
    const gruposRet = dados.gruposRet || [];
    const gruposFolha = dados.gruposFolha || [];
    const total = dados.ano_total;
    const periodo = sel === "ano" ? total : typeof sel === "string" ? dados.trimestres[Number(sel.slice(1)) - 1] : dados.meses[sel];
    const colunas = grupos.filter((g) => total.imp[g.id]);
    const comDados = dados.meses.map((m, i) => ({ m, i })).filter(({ m }) => m.fat.total || m.impTotal || m.retTotal || m.folhaTotal);
    const evolucao = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], carga: m.carga == null ? null : Number((m.carga * 100).toFixed(2)), ...Object.fromEntries(colunas.map((g) => [g.id, m.imp[g.id] || 0])) }));
    let fa = 0;
    let ia = 0;
    const ultimo = comDados.length ? comDados[comDados.length - 1].i : -1;
    const acumulada = dados.meses.slice(0, ultimo + 1).map((m, i) => {
      fa += m.fat.total;
      ia += m.impTotal;
      return { mes: MES_CURTO[i], carga: fa ? Number(((ia / fa) * 100).toFixed(2)) : null };
    });
    const fatMes = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], servicos: m.fat.servicos, vendas: m.fat.vendas }));
    const cargaMes = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], carga: m.carga == null || !(m.fat.total || m.impTotal) ? null : Number((m.carga * 100).toFixed(2)) }));
    const tri = dados.trimestres.map((t, i) => ({ nome: `${i + 1}º tri`, carga: t.carga == null ? 0 : Number((t.carga * 100).toFixed(2)) }));
    const pizza = colunas.map((g) => ({ id: g.id, nome: nomeCurto(g.nome), valor: periodo.imp[g.id] || 0 })).filter((x) => x.valor > 0);
    const cargaCorrente = periodo.fat.total ? (periodo.impTotal - (periodo.imp.irpj || 0) - (periodo.imp.csll || 0)) / periodo.fat.total : null;
    const cargasMeses = comDados.filter(({ m }) => m.carga != null);
    const maiorMes = cargasMeses.length ? cargasMeses.reduce((a, b) => (b.m.carga > a.m.carga ? b : a)) : null;
    const menorMes = cargasMeses.length ? cargasMeses.reduce((a, b) => (b.m.carga < a.m.carga ? b : a)) : null;
    const nMeses = sel === "ano" ? comDados.length : typeof sel === "string" ? dados.meses.slice((Number(sel.slice(1)) - 1) * 3, Number(sel.slice(1)) * 3).filter((m) => m.fat.total || m.impTotal).length : 1;
    const calor = colunas.map((g) => {
      const vals = dados.meses.map((m) => m.imp[g.id] || 0);
      return { g, vals, max: Math.max(...vals, 1) };
    });
    const ret = periodo.ret || {};
    const folha = periodo.folha || {};
    return { grupos, gruposRet, gruposFolha, total, periodo, colunas, evolucao, acumulada, fatMes, cargaMes, tri, pizza, cargaCorrente, maiorMes, menorMes, nMeses, calor, ret, folha,
      retTotal: periodo.retTotal || 0, folhaTotal: periodo.folhaTotal || 0, temRet: (total.retTotal || 0) > 0, temFolha: (total.folhaTotal || 0) > 0 };
  }, [dados, sel]);

  const titulo = sel === "ano" ? `Ano ${ano}` : typeof sel === "string" ? `${sel.slice(1)}º trimestre de ${ano}` : `${MES_LONGO[sel]} de ${ano}`;

  function abrirPersonalizar() {
    const ordem = [...salvo, ...BLOCOS.map((b) => b.id).filter((id) => !salvo.includes(id))];
    setRascunho({ ordem, ligados: new Set(salvo) });
    setEditando(true);
  }
  function mover(id, direcao) {
    setRascunho((atual) => {
      const visiveis = atual.ordem.filter((x) => atual.ligados.has(x));
      const i = visiveis.indexOf(id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= visiveis.length) return atual;
      const alvo = visiveis[j];
      const ordem = [...atual.ordem];
      const a = ordem.indexOf(id);
      const b = ordem.indexOf(alvo);
      ordem[a] = alvo;
      ordem[b] = id;
      return { ...atual, ordem };
    });
  }
  function alternar(id) {
    setRascunho((atual) => {
      const ligadosNovo = new Set(atual.ligados);
      if (ligadosNovo.has(id)) ligadosNovo.delete(id);
      else ligadosNovo.add(id);
      return { ...atual, ligados: ligadosNovo };
    });
  }
  async function salvar() {
    setSalvando(true);
    try {
      await saveCargaLayout(rascunho.ordem.filter((id) => rascunho.ligados.has(id)));
      setEditando(false);
    } catch (err) {
      console.error("Falha ao salvar a personalização da carga tributária:", err);
      setError(/recarregue/i.test(err?.message || "") ? err.message : "Não consegui salvar agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (!company && !grupo) {
    return <p className="rounded-xl bg-surface-card p-6 text-[13px] text-ink-500 shadow-sm">A carga tributária é por empresa — abra uma empresa para ver.</p>;
  }
  if (error && !rows) return <p className="rounded-xl bg-danger-50 p-4 text-[13px] text-danger-600">{error}</p>;
  if (rows === null) return <p className="p-6 text-[13px] text-ink-400">Carregando…</p>;
  if (!rows.length || !dados || !c) {
    return (
      <div className="rounded-xl bg-surface-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Percent size={16} /> Carga tributária</p>
        <p className="mt-2 text-[13px] text-ink-500">Ainda não há dados de carga tributária para esta empresa. Eles vêm da apuração fiscal da Domínio e são atualizados todo dia; se a empresa já tem notas e apuração lá, é só aguardar o próximo envio.</p>
      </div>
    );
  }

  const { grupos, gruposRet, gruposFolha, total, periodo, colunas, evolucao, acumulada, fatMes, cargaMes, tri, pizza, cargaCorrente, maiorMes, menorMes, nMeses, calor, ret, folha, retTotal, folhaTotal } = c;
  const maior = [...grupos].sort((a, b) => (periodo.imp[b.id] || 0) - (periodo.imp[a.id] || 0))[0];
  const naoClass = Object.entries(total.naoClassificados || {});
  const temVendas = total.fat.vendas > 0;
  const tAnt = anterior?.dados?.ano_total;
  const fatP = periodo.fat.total;

  const KPIS = {
    "kpi-fat": () => <Card key="kpi-fat" label="Faturamento" value={moneyFull(fatP)} hint={`${periodo.fat.notasServicos + periodo.fat.notasVendas} notas${temVendas ? ` · serviços ${compacto(periodo.fat.servicos)} · vendas ${compacto(periodo.fat.vendas)}` : ""}`} tone="accent" />,
    "kpi-imp": () => <Card key="kpi-imp" label="Impostos próprios" value={moneyFull(periodo.impTotal)} hint="apurados no fiscal (saldo devedor)" />,
    "kpi-carga": () => <Card key="kpi-carga" label="Carga tributária" value={pctCarga(periodo.carga)} hint="impostos próprios ÷ faturamento" tone="warn" />,
    "kpi-maior": () => <Card key="kpi-maior" label="Maior imposto" value={periodo.impTotal > 0 && maior ? nomeCurto(maior.nome) : "—"} hint={periodo.impTotal > 0 && maior ? `${pctCarga(periodo.imp[maior.id] / periodo.impTotal)} dos impostos` : ""} />,
    "kpi-100": () => <Card key="kpi-100" label="A cada R$ 100 faturados" value={periodo.carga == null ? "—" : moneyFull(periodo.carga * 100)} hint="vão para impostos próprios" />,
    "kpi-corrente": () => <Card key="kpi-corrente" label="Carga sem IRPJ e CSLL" value={pctCarga(cargaCorrente)} hint="só os tributos mensais" />,
    "kpi-media": () => <Card key="kpi-media" label="Média mensal de impostos" value={nMeses ? moneyFull(periodo.impTotal / nMeses) : "—"} hint={`${nMeses} ${nMeses === 1 ? "mês" : "meses"} com movimento`} />,
    "kpi-pico": () => <Card key="kpi-pico" label="Pico e menor carga do ano" value={maiorMes ? `${MES_CURTO[maiorMes.i]} ${pctCarga(maiorMes.m.carga)}` : "—"} hint={menorMes ? `menor: ${MES_CURTO[menorMes.i]} ${pctCarga(menorMes.m.carga)}` : ""} />,
    "kpi-ret": () => <Card key="kpi-ret" label="Impostos retidos na fonte" value={moneyFull(retTotal)} hint={fatP && retTotal ? `${pctCarga(retTotal / fatP)} do faturamento · de terceiros, a recolher` : "de terceiros, a recolher"} />,
    "kpi-folha": () => <Card key="kpi-folha" label="Encargos da folha" value={moneyFull(folhaTotal)} hint={fatP && folhaTotal ? `${pctCarga(folhaTotal / fatP)} do faturamento` : "INSS, FGTS e IRRF da folha"} />,
    "kpi-total": () => <Card key="kpi-total" label="Carga com retidos e folha" value={fatP ? pctCarga((periodo.impTotal + retTotal + folhaTotal) / fatP) : "—"} hint={moneyFull(periodo.impTotal + retTotal + folhaTotal)} tone="warn" />,
  };

  const linhaMes = (rotulo, m, extra = "") => (
    <tr key={rotulo} className={`border-b border-line ${extra}`}>
      <td className="px-3 py-2 text-left text-[12.5px]">{rotulo}</td>
      <td className="px-3 py-2 text-right tabular-nums">{money(m.fat.total)}</td>
      {colunas.map((g) => <td key={g.id} className={`px-3 py-2 text-right tabular-nums ${m.imp[g.id] ? "" : "text-ink-300"}`}>{m.imp[g.id] ? money(m.imp[g.id]) : "–"}</td>)}
      <td className="px-3 py-2 text-right tabular-nums">{money(m.impTotal)}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{pctCarga(m.carga)}</td>
    </tr>
  );

  const SECOES = {
    "por-imposto": () => (
      <Bloco key="por-imposto" titulo="Por imposto" nota={titulo} className="overflow-x-auto">
        <TabelaGrupos grupos={grupos} valores={periodo.imp} total={periodo.impTotal} faturamento={fatP} vazio="Sem imposto apurado neste período." />
      </Bloco>
    ),
    "carga-mes": () => {
      const comValor = cargaMes.filter((x) => x.carga != null);
      const media = comValor.length ? comValor.reduce((t, x) => t + x.carga, 0) / comValor.length : null;
      return (
        <div key="carga-mes" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Bloco titulo={`Carga por mês — ${ano}`} nota={media != null ? `média ${pct1(media)}` : ""} className="xl:col-span-2">
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cargaMes} margin={{ top: 18, right: 14, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="cargaMesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, (max) => Math.ceil(max * 1.25)]} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga"]} />
                {media != null && <ReferenceLine y={media} stroke="#94a3b8" strokeDasharray="4 4" />}
                <Area type="monotone" dataKey="carga" stroke="#2563eb" strokeWidth={2.2} fill="url(#cargaMesGrad)" connectNulls={false} dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                  <LabelList dataKey="carga" position="top" formatter={(v) => (v == null ? "" : pct1(v))} style={{ fontSize: 10.5, fill: "#475569" }} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="Por trimestre" nota="IRPJ e CSLL são trimestrais">
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tri} margin={{ top: 18, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="nome" tick={{ fontSize: 11.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga"]} />
                <Bar dataKey="carga" radius={[6, 6, 0, 0]} isAnimationActive={false} label={{ position: "top", fontSize: 10.5, fill: "#475569", formatter: (v) => (v ? pct1(v) : "") }}>
                  {tri.map((_, index) => <Cell key={index} fill={sel === `T${index + 1}` ? "#d97706" : "#2563eb"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        </div>
      );
    },
    "por-empresa": () => {
      if (!grupo) return null;
      const periodoDe = (d) => (sel === "ano" ? d.ano_total : typeof sel === "string" ? d.trimestres[Number(sel.slice(1)) - 1] : d.meses[sel]);
      const linhas = membros.map((membro) => { const d = dadosDaEmpresa(membro, ano); return { membro, p: d ? periodoDe(d) : null }; }).filter((x) => x.p);
      if (!linhas.length) return null;
      const maxImp = Math.max(...linhas.map((x) => x.p.impTotal || 0), 1);
      return (
        <Bloco key="por-empresa" titulo="Por empresa do grupo" nota={`${titulo} · clique numa empresa para ver os tributos dela`} className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className={CABECALHO}><th className="px-3 py-2 text-left font-semibold">Empresa</th><th className={TH}>Faturamento</th><th className={TH}>Impostos próprios</th><th className={TH}>Carga</th><th className={TH}>% dos impostos do grupo</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ membro, p }) => {
                const aberta = empresasAbertas.has(membro.id);
                const impostos = grupos.map((g) => ({ g, v: p.imp?.[g.id] || 0 })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
                return (
                  <Fragment key={membro.id}>
                    <tr className="cursor-pointer border-b border-line hover:bg-surface-muted/60" onClick={() => alternarEmpresa(membro.id)}>
                      <td className="px-3 py-2 text-left"><span className="mr-1.5 inline-block align-middle text-ink-400">{aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>{membro.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(p.fat.total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(p.impTotal)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{pctCarga(p.carga)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{periodo.impTotal ? pctCarga(p.impTotal / periodo.impTotal) : "—"}<span className="ml-2 inline-block h-2 rounded bg-accent-500 align-middle" style={{ width: `${Math.round(((p.impTotal || 0) / maxImp) * 60)}px` }} /></td>
                    </tr>
                    {aberta && (
                      <tr className="border-b border-line bg-surface-muted/40">
                        <td colSpan={5} className="px-3 pb-3 pt-1">
                          {impostos.length ? (
                            <table className="w-full border-collapse text-[12.5px]">
                              <thead><tr className={CABECALHO}><th className="px-3 py-1.5 text-left font-semibold">Imposto — {membro.name}</th><th className={TH}>Valor</th><th className={TH}>% do faturamento</th><th className={TH}>% dos impostos da empresa</th></tr></thead>
                              <tbody>
                                {impostos.map(({ g, v }) => (
                                  <tr key={g.id} className="border-b border-line/60">
                                    <td className="px-3 py-1.5 text-left"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COR[g.id] || "#64748b" }} />{g.nome}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{money(v)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{fracao(v, p.fat.total)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{pctCarga(p.impTotal ? v / p.impTotal : 0)}</td>
                                  </tr>
                                ))}
                                <tr className="font-semibold"><td className="px-3 py-1.5 text-left">Total de impostos próprios</td><td className="px-3 py-1.5 text-right tabular-nums">{money(p.impTotal)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fracao(p.impTotal, p.fat.total)}</td><td className="px-3 py-1.5 text-right">100,00%</td></tr>
                              </tbody>
                            </table>
                          ) : <p className="px-3 py-2 text-[12.5px] text-ink-400">Sem imposto próprio apurado neste período para esta empresa.</p>}
                          {(p.retTotal > 0 || p.folhaTotal > 0) && (
                            <p className="mt-1.5 px-3 text-[12px] text-ink-500">
                              Fora da carga própria:{p.retTotal > 0 ? ` retidos na fonte ${money(p.retTotal)}` : ""}{p.retTotal > 0 && p.folhaTotal > 0 ? " ·" : ""}{p.folhaTotal > 0 ? ` encargos da folha ${money(p.folhaTotal)}` : ""}.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="bg-surface-muted font-bold">
                <td className="px-3 py-2 text-left">Grupo</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(periodo.fat.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(periodo.impTotal)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pctCarga(periodo.carga)}</td>
                <td className="px-3 py-2 text-right">{periodo.impTotal ? "100,00%" : "—"}</td>
              </tr>
            </tbody>
          </table>
        </Bloco>
      );
    },
    resumo: () => {
      const impostos = grupos.map((g) => ({ g, v: periodo.imp[g.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      const sobra = fatP ? Math.max(fatP - periodo.impTotal, 0) : 0;
      const mesAnt = mesSel != null && mesSel > 0 ? dados.meses[mesSel - 1] : null;
      const variacao = mesAnt && mesAnt.carga != null && periodo.carga != null ? periodo.carga - mesAnt.carga : null;
      return (
        <section key="resumo" className="rounded-2xl bg-surface-card p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Carga tributária · {titulo}</p>
              <p className="mt-1 text-[44px] font-bold leading-none tabular-nums text-ink-900">{pctCarga(periodo.carga)}</p>
              {variacao != null && (
                <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${variacao > 0.0005 ? "bg-warning-50 text-warning-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {variacao > 0.0005 ? "▲" : variacao < -0.0005 ? "▼" : "•"} {Math.abs(variacao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p. vs {MES_CURTO[mesSel - 1].toLowerCase()}
                </p>
              )}
              {periodo.carga != null && <p className="mt-2 text-[12.5px] text-ink-500">A cada R$ 100 faturados, <b className="text-ink-800">{moneyFull(periodo.carga * 100)}</b> vão para impostos próprios.</p>}
            </div>
            <div className="flex flex-wrap gap-x-9 gap-y-3">
              <Stat label="Faturamento" value={moneyFull(fatP)} hint={`${periodo.fat.notasServicos + periodo.fat.notasVendas} notas`} />
              <Stat label="Impostos próprios" value={moneyFull(periodo.impTotal)} />
              <Stat label="Maior imposto" value={periodo.impTotal > 0 && maior ? nomeCurto(maior.nome) : "—"} hint={periodo.impTotal > 0 && maior ? `${pctCarga(periodo.imp[maior.id] / periodo.impTotal)} dos impostos` : ""} />
            </div>
          </div>
          {fatP > 0 && impostos.length > 0 && (
            <div className="mt-5">
              <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full bg-surface-muted">
                {impostos.map(({ g, v }) => <div key={g.id} title={`${nomeCurto(g.nome)}: ${moneyFull(v)} · ${pctCarga(v / fatP)} do faturamento`} style={{ width: `${(v / fatP) * 100}%`, background: COR[g.id] || "#64748b" }} />)}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-500">
                {impostos.map(({ g, v }) => (
                  <span key={g.id}><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COR[g.id] || "#64748b" }} />{nomeCurto(g.nome)} <b className="text-ink-800">{pctCarga(v / fatP)}</b></span>
                ))}
                <span className="text-ink-400">Sobra após impostos <b className="text-ink-700">{pctCarga(sobra / fatP)}</b></span>
              </div>
            </div>
          )}
        </section>
      );
    },
    painel: () => {
      const impostos = grupos.map((g) => ({ g, v: periodo.imp[g.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      // 100 quadradinhos: cada um é R$ 1 de cada R$ 100 faturados (maior resto distribui os arredondamentos)
      const cotas = fatP ? impostos.map(({ g, v }) => ({ g, v, exato: (v / fatP) * 100 })) : [];
      cotas.forEach((x) => { x.n = Math.floor(x.exato); });
      let faltam = Math.min(100, Math.round(cotas.reduce((t, x) => t + x.exato, 0))) - cotas.reduce((t, x) => t + x.n, 0);
      [...cotas].sort((a, b) => (b.exato - b.n) - (a.exato - a.n)).forEach((x) => { if (faltam > 0) { x.n += 1; faltam -= 1; } });
      const quadrados = cotas.flatMap((x) => Array.from({ length: x.n }, () => x.g.id));
      while (quadrados.length < 100) quadrados.push("sobra");
      const serie = dados.meses.map((m, i) => ({ mes: MES_CURTO[i], fat: m.fat.total || null, imp: m.impTotal || null, carga: m.carga == null || !(m.fat.total || m.impTotal) ? null : Number((m.carga * 100).toFixed(2)) }));
      return (
        <div key="painel" className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Bloco titulo="A cada R$ 100 faturados" nota={titulo} className="xl:col-span-2">
            {fatP > 0 && cotas.length ? (
              <div className="flex flex-wrap items-center gap-5">
                <div className="grid shrink-0 grid-cols-10 gap-[3px]">
                  {quadrados.map((id, i) => <span key={i} className="block h-[15px] w-[15px] rounded-[3px]" style={{ background: id === "sobra" ? "#d1fae5" : COR[id] || "#64748b" }} />)}
                </div>
                <div className="flex min-w-[140px] flex-1 flex-col gap-2 text-[12.5px]">
                  {cotas.map(({ g, v }) => (
                    <div key={g.id} className="flex items-center justify-between gap-3">
                      <span className="truncate"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: COR[g.id] || "#64748b" }} />{nomeCurto(g.nome)}</span>
                      <b className="tabular-nums text-ink-800">{moneyFull((v / fatP) * 100)}</b>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
                    <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: "#d1fae5" }} />Sobra</span>
                    <b className="tabular-nums text-emerald-700">{moneyFull(Math.max(100 - (periodo.impTotal / fatP) * 100, 0))}</b>
                  </div>
                </div>
              </div>
            ) : <p className="py-10 text-center text-[13px] text-ink-400">Sem faturamento ou sem imposto neste período.</p>}
          </Bloco>
          <Bloco titulo={`Faturamento × impostos — ${ano}`} nota="barras: R$ · linha: carga do mês" className="xl:col-span-3">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serie} margin={{ top: 10, right: 6, left: -10, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11.5 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="v" tick={{ fontSize: 11.5 }} tickFormatter={compacto} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 11.5 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value, name) => (name === "Carga" ? [`${Number(value).toLocaleString("pt-BR")}%`, name] : [moneyFull(value), name])} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar yAxisId="v" dataKey="fat" name="Faturamento" fill="#bfdbfe" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar yAxisId="v" dataKey="imp" name="Impostos" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="p" type="monotone" dataKey="carga" name="Carga" stroke="#d97706" strokeWidth={2.2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Bloco>
        </div>
      );
    },
    avisos: () => {
      const itens = [];
      if (naoClass.length) itens.push(["warn", `Impostos fora do catálogo (não entraram em nenhuma soma — confira): ${naoClass.map(([nome, valor]) => `${nome} ${moneyFull(valor)}`).join(" · ")}`]);
      if (total.fat.outrasSaidas > 0) itens.push(["warn", `Saídas que não contam como faturamento (devolução, remessa, transferência…): ${moneyFull(total.fat.outrasSaidas)} no ano.`]);
      if ((total.reforma?.ibs || 0) + (total.reforma?.cbs || 0) > 0) itens.push(["info", `Reforma tributária (valores de teste de ${ano}): IBS ${moneyFull(total.reforma.ibs)} · CBS ${moneyFull(total.reforma.cbs)} — não entram na carga.`]);
      const tc = dadosBrutos?.ano_total;  // já com os valores informados à mão
      const soContabil = !grupo && tc?.contabilTotal > 0 ? grupos.filter((g) => tc.contabil?.[g.id] > 0) : [];
      if (!itens.length && !soContabil.length) return null;
      return (
        <div key="avisos" className="flex flex-col gap-2">
          {soContabil.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border-l-[3px] border-warning-500 bg-warning-50 px-3 py-2 text-[12.5px] text-warning-700">
              <span className="min-w-0 flex-1">
                Há imposto provisionado no contábil sem apuração no fiscal: {soContabil.map((g) => `${nomeCurto(g.nome)} ${moneyFull(tc.contabil[g.id])}`).join(" · ")}.{" "}
                {usarContabil ? "Estes valores ESTÃO somados na carga." : "Estes valores NÃO estão somados na carga."}
              </span>
              {podeEditar && (
                <button type="button" disabled={salvandoContabil} onClick={alternarContabil} className="rounded-md border border-warning-500 px-2.5 py-1 font-semibold hover:bg-warning-100 disabled:opacity-60">
                  {usarContabil ? "Não considerar" : "Considerar na carga"}
                </button>
              )}
            </div>
          )}
          {itens.map(([tipo, texto], i) => (
            <div key={i} className={`rounded-lg border-l-[3px] px-3 py-2 text-[12.5px] ${tipo === "warn" ? "border-warning-500 bg-warning-50 text-warning-700" : "border-accent-500 bg-accent-500/10 text-ink-700"}`}>{texto}</div>
          ))}
        </div>
      );
    },
    composicao: () => {
      const linhas = grupos.map((g) => ({ g, v: periodo.imp[g.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      const maxV = linhas.length ? linhas[0].v : 1;
      return (
        <Bloco key="composicao" titulo="Composição dos impostos" nota={`${titulo} · valor e % do total`}>
          {linhas.length ? (
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[190px_1fr]">
              <div className="relative mx-auto h-[190px] w-[190px]">
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10.5px] text-ink-400">Total</span>
                  <span className="text-[17px] font-bold text-ink-900">{compacto(periodo.impTotal)}</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {pizza.map((p) => <Cell key={p.id} fill={COR[p.id] || "#64748b"} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${moneyFull(value)} · ${pctCarga(periodo.impTotal ? value / periodo.impTotal : 0)}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0">
                {linhas.map(({ g, v }) => (
                  <div key={g.id} className="grid grid-cols-[minmax(110px,1.1fr)_2fr_auto_56px] items-center gap-3 border-b border-line py-2 text-[13px] last:border-0">
                    <span className="truncate"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COR[g.id] || "#64748b" }} />{g.nome}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${(v / maxV) * 100}%`, background: COR[g.id] || "#64748b" }} /></div>
                    <span className="text-right tabular-nums text-ink-800">{money(v)}</span>
                    <span className="text-right tabular-nums text-ink-400">{pctCarga(periodo.impTotal ? v / periodo.impTotal : 0)}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-[13px] font-semibold">
                  <span>Total · {fracao(periodo.impTotal, fatP)} do faturamento</span>
                  <span className="tabular-nums">{money(periodo.impTotal)}</span>
                </div>
              </div>
            </div>
          ) : <p className="py-8 text-center text-[13px] text-ink-400">Sem imposto apurado neste período.</p>}
        </Bloco>
      );
    },
    impacto: () => {
      // cascata: parte do faturamento, desconta cada imposto (do maior pro menor) e mostra o que sobra
      const impostos = grupos.map((g) => ({ g, v: periodo.imp[g.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      if (!fatP || !impostos.length) {
        return <Bloco key="impacto" titulo="Impacto dos impostos na receita" nota={titulo}><p className="py-10 text-center text-[13px] text-ink-400">Sem faturamento ou sem imposto apurado neste período.</p></Bloco>;
      }
      let atual = fatP;
      const passos = [{ nome: "Faturamento", base: 0, valor: fatP, cor: "#2563eb", rotulo: moneyFull(fatP), pct: 1 }];
      impostos.forEach(({ g, v }) => {
        atual -= v;
        passos.push({ nome: nomeCurto(g.nome), base: atual, valor: v, cor: COR[g.id] || "#64748b", rotulo: `−${compacto(v)}`, pct: v / fatP });
      });
      passos.push({ nome: "Sobra após impostos", base: 0, valor: Math.max(atual, 0), cor: "#16a34a", rotulo: moneyFull(atual), pct: atual / fatP });
      return (
        <Bloco key="impacto" titulo="Impacto dos impostos na receita" nota={`${titulo} · de cada R$ 100 faturados, ${periodo.carga == null ? "—" : moneyFull(periodo.carga * 100)} vão para impostos próprios`}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={passos} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11.5 }} interval={0} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={compacto} />
                <Tooltip cursor={false} formatter={(value, name, item) => (name === "base" ? null : [`${moneyFull(value)} · ${pctCarga(item.payload.pct)} do faturamento`, item.payload.nome])} />
                <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="valor" stackId="c" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {passos.map((p, i) => <Cell key={i} fill={p.cor} />)}
                  <LabelList dataKey="rotulo" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-500">
            {impostos.map(({ g, v }) => (
              <span key={g.id}><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COR[g.id] || "#64748b" }} />{nomeCurto(g.nome)}: <b className="text-ink-800">{pctCarga(v / fatP)}</b> do faturamento</span>
            ))}
            <span>Sobra: <b className="text-ink-800">{pctCarga(atual / fatP)}</b> do faturamento</span>
          </div>
        </Bloco>
      );
    },
    retidos: () => (
      <Bloco key="retidos" titulo="Impostos retidos na fonte" nota={`${titulo} · a empresa retém de terceiros e recolhe — não entram na carga própria`} className="overflow-x-auto">
        <TabelaGrupos grupos={gruposRet} valores={ret} total={retTotal} faturamento={fatP} vazio="Nenhum imposto retido apurado neste período." />
        {gruposRet.some((g) => (total.ret || {})[g.id]) && (
          <table className="mt-4 w-full border-collapse text-[12.5px]">
            <thead>
              <tr className={CABECALHO}><th className="px-3 py-2 text-left font-semibold">Mês</th>{gruposRet.filter((g) => (total.ret || {})[g.id]).map((g) => <th key={g.id} className={TH}>{g.nome}</th>)}<th className={TH}>Total</th></tr>
            </thead>
            <tbody>
              {dados.meses.map((m, i) => (m.retTotal ? (
                <tr key={i} className="border-b border-line">
                  <td className="px-3 py-1.5 text-left">{MES_LONGO[i]}</td>
                  {gruposRet.filter((g) => (total.ret || {})[g.id]).map((g) => <td key={g.id} className="px-3 py-1.5 text-right tabular-nums">{m.ret?.[g.id] ? money(m.ret[g.id]) : "–"}</td>)}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{money(m.retTotal)}</td>
                </tr>
              ) : null))}
            </tbody>
          </table>
        )}
      </Bloco>
    ),
    folha: () => (
      <Bloco key="folha" titulo="Encargos da folha" nota={`${titulo} · fora da carga própria`} className="overflow-x-auto">
        <TabelaGrupos grupos={gruposFolha} valores={folha} total={folhaTotal} faturamento={fatP} vazio="Nenhum encargo de folha apurado no fiscal neste período." />
      </Bloco>
    ),
    "visao-completa": () => {
      const reforma = (periodo.reforma?.ibs || 0) + (periodo.reforma?.cbs || 0);
      const linhas = [
        ["Impostos próprios (compõem a carga)", periodo.impTotal, true],
        ["Impostos retidos na fonte", retTotal, false],
        ["Encargos da folha", folhaTotal, false],
      ];
      const somaTudo = periodo.impTotal + retTotal + folhaTotal;
      return (
        <Bloco key="visao-completa" titulo="Visão completa" nota={`${titulo} · tudo que a Domínio apura, separado por tipo`} className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className={CABECALHO}><th className="px-3 py-2 text-left font-semibold">Tipo</th><th className={TH}>Valor</th><th className={TH}>% do faturamento</th></tr></thead>
            <tbody>
              {linhas.map(([nome, valor, forte]) => (
                <tr key={nome} className={`border-b border-line ${forte ? "font-semibold" : ""}`}>
                  <td className="px-3 py-2 text-left">{nome}</td><td className="px-3 py-2 text-right tabular-nums">{money(valor)}</td><td className="px-3 py-2 text-right tabular-nums">{fracao(valor, fatP)}</td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-bold"><td className="px-3 py-2 text-left">Total de tributos</td><td className="px-3 py-2 text-right tabular-nums">{money(somaTudo)}</td><td className="px-3 py-2 text-right tabular-nums">{fracao(somaTudo, fatP)}</td></tr>
              {reforma > 0 && <tr className="text-ink-500"><td className="px-3 py-2 text-left">IBS e CBS (teste, fora dos totais)</td><td className="px-3 py-2 text-right tabular-nums">{money(reforma)}</td><td className="px-3 py-2 text-right tabular-nums">{fracao(reforma, fatP)}</td></tr>}
            </tbody>
          </table>
        </Bloco>
      );
    },
    evolucao: () => (
      <Bloco key="evolucao" titulo={`Evolução mensal de ${ano}`} nota="barras: impostos por tipo (R$) · linha: carga do mês (%)">
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
    ),
    acumulada: () => (
      <Bloco key="acumulada" titulo="Carga acumulada no ano" nota="impostos acumulados ÷ faturamento acumulado">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={acumulada} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga acumulada"]} />
              <Area type="monotone" dataKey="carga" name="Carga acumulada" stroke="#d97706" fill="#d97706" fillOpacity={0.18} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Bloco>
    ),
    "faturamento-mes": () => (
      <Bloco key="faturamento-mes" titulo="Faturamento por mês" nota={temVendas ? "serviços e vendas" : "notas de serviço"}>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fatMes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={compacto} />
              <Tooltip formatter={(value, name) => [moneyFull(value), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="servicos" name="Serviços" stackId="f" fill="#2563eb" />
              {temVendas && <Bar dataKey="vendas" name="Vendas" stackId="f" fill="#0891b2" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Bloco>
    ),
    trimestres: () => (
      <div key="trimestres" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco titulo="Carga por trimestre" nota="IRPJ e CSLL são trimestrais">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tri} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga"]} />
                <Bar dataKey="carga" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, formatter: (v) => (v ? pct1(v) : "") }}>
                  {tri.map((_, index) => <Cell key={index} fill={sel === `T${index + 1}` ? "#d97706" : "#2563eb"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="Trimestre a trimestre" className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className={CABECALHO}><th className="px-3 py-2 text-left font-semibold">Trimestre</th><th className={TH}>Faturamento</th><th className={TH}>Impostos</th><th className={TH}>Carga</th></tr></thead>
            <tbody>
              {dados.trimestres.map((t, i) => (
                <tr key={i} className={`border-b border-line ${sel === `T${i + 1}` ? "bg-accent-500/10" : ""}`}>
                  <td className="px-3 py-2 text-left">{i + 1}º trimestre</td><td className="px-3 py-2 text-right tabular-nums">{money(t.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{money(t.impTotal)}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{pctCarga(t.carga)}</td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-bold"><td className="px-3 py-2 text-left">Ano {ano}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(total.carga)}</td></tr>
            </tbody>
          </table>
        </Bloco>
      </div>
    ),
    comparativo: () => {
      if (!tAnt) return <Bloco key="comparativo" titulo={`Comparativo ${ano} × ${ano - 1}`}><p className="text-[13px] text-ink-400">Não há dados de {ano - 1} para comparar.</p></Bloco>;
      return (
        <Bloco key="comparativo" titulo={`Comparativo ${ano} × ${ano - 1}`} nota="ano inteiro" className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className={CABECALHO}><th className="px-3 py-2 text-left font-semibold"> </th><th className={TH}>{ano - 1}</th><th className={TH}>{ano}</th><th className={TH}>Variação</th></tr></thead>
            <tbody>
              <tr className="border-b border-line font-semibold"><td className="px-3 py-2 text-left">Faturamento</td><td className="px-3 py-2 text-right tabular-nums">{money(tAnt.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.fat.total)}</td><td className="px-3 py-2 text-right tabular-nums">{deltaTxt(delta(total.fat.total, tAnt.fat.total))}</td></tr>
              {grupos.filter((g) => total.imp[g.id] || tAnt.imp[g.id]).map((g) => (
                <tr key={g.id} className="border-b border-line"><td className="px-3 py-2 text-left">{g.nome}</td><td className="px-3 py-2 text-right tabular-nums">{money(tAnt.imp[g.id])}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.imp[g.id])}</td><td className="px-3 py-2 text-right tabular-nums">{deltaTxt(delta(total.imp[g.id], tAnt.imp[g.id]))}</td></tr>
              ))}
              <tr className="border-b border-line font-semibold"><td className="px-3 py-2 text-left">Total de impostos</td><td className="px-3 py-2 text-right tabular-nums">{money(tAnt.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{money(total.impTotal)}</td><td className="px-3 py-2 text-right tabular-nums">{deltaTxt(delta(total.impTotal, tAnt.impTotal))}</td></tr>
              <tr className="bg-surface-muted font-bold"><td className="px-3 py-2 text-left">Carga tributária</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(tAnt.carga)}</td><td className="px-3 py-2 text-right tabular-nums">{pctCarga(total.carga)}</td><td className="px-3 py-2 text-right tabular-nums">{tAnt.carga != null && total.carga != null ? `${((total.carga - tAnt.carga) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p.` : "—"}</td></tr>
            </tbody>
          </table>
        </Bloco>
      );
    },
    calor: () => (
      <Bloco key="calor" titulo="Mapa de calor dos impostos" nota="quanto mais forte a cor, maior o valor do imposto naquele mês" className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead><tr className="text-[10.5px] uppercase tracking-wide text-ink-500"><th className="px-2 py-1.5 text-left font-semibold">Imposto</th>{MES_CURTO.map((m) => <th key={m} className="px-2 py-1.5 text-center font-semibold">{m}</th>)}</tr></thead>
          <tbody>
            {calor.map(({ g, vals, max }) => (
              <tr key={g.id}>
                <td className="whitespace-nowrap px-2 py-1 text-left text-[12.5px]">{nomeCurto(g.nome)}</td>
                {vals.map((v, i) => (
                  <td key={i} title={v ? `${nomeCurto(g.nome)} · ${MES_LONGO[i]}: ${moneyFull(v)}` : ""} className="px-1 py-1 text-center tabular-nums" style={{ background: v ? `color-mix(in srgb, ${COR[g.id] || "#64748b"} ${Math.round(12 + (v / max) * 70)}%, transparent)` : "transparent" }}>{v ? compacto(v) : ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
    ),
    "mes-a-mes": () => (
      <Bloco key="mes-a-mes" titulo="Mês a mês" nota="IRPJ e CSLL são trimestrais — caem no último mês do trimestre" className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className={CABECALHO}>
              <th className="px-3 py-2 text-left font-semibold">Mês</th><th className={TH}>Faturamento</th>
              {colunas.map((g) => <th key={g.id} className={TH}>{nomeCurto(g.nome)}</th>)}
              <th className={TH}>Impostos</th><th className={TH}>Carga</th>
            </tr>
          </thead>
          <tbody>
            {dados.meses.flatMap((m, i) => {
              const out = [linhaMes(MES_LONGO[i], m)];
              if (i % 3 === 2) out.push(linhaMes(`${Math.floor(i / 3) + 1}º trimestre`, dados.trimestres[Math.floor(i / 3)], "bg-accent-500/10 font-semibold"));
              return out;
            })}
            {linhaMes(`Ano ${ano}`, total, "bg-surface-muted font-bold")}
          </tbody>
        </table>
      </Bloco>
    ),
    metodologia: () => (
      <div key="metodologia" className="rounded-xl bg-surface-card p-4 text-[12.5px] leading-relaxed text-ink-500 shadow-sm">
        <p className="mb-1 text-[14px] font-semibold text-ink-900">Como é calculado</p>
        <p><b className="text-ink-800">Impostos próprios:</b> saldo devedor apurado mês a mês no fiscal da Domínio (ISS, ICMS com DIFAL/ST/antecipação, IPI, PIS, COFINS, CSLL, IRPJ e Simples) — o imposto devido, antes de retenções sofridas e de pagamentos. Só eles entram na carga tributária.</p>
        <p><b className="text-ink-800">Faturamento:</b> valor das notas de serviço e das notas de saída de venda, sem canceladas e denegadas.</p>
        <p><b className="text-ink-800">Retidos e folha:</b> mostrados à parte. Retidos são impostos que a empresa retém de terceiros e recolhe (IRRF, PIS/COFINS/CSLL, INSS e ISS retidos); folha são os encargos apurados no fiscal (INSS, FGTS, IRRF). Reforma tributária (IBS/CBS) de teste fica fora dos totais.</p>
      </div>
    ),
  };

  // monta a tela na ordem escolhida; cartões seguidos viram uma grade
  const itens = [];
  let grade = null;
  ligados.forEach((id) => {
    const bloco = POR_ID.get(id);
    if (!bloco) return;
    if (bloco.kind === "kpi") {
      if (!grade) {
        grade = { chave: `grade-${id}`, cartoes: [] };
        itens.push(grade);
      }
      grade.cartoes.push(KPIS[id]());
      return;
    }
    grade = null;
    const el = SECOES[id]?.();
    if (el) itens.push({ chave: id, el });
  });

  return (
    <div className="flex flex-col gap-4">
      {/* cabeçalho + período */}
      <div className="rounded-xl bg-surface-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Percent size={16} /> Carga tributária</p>
            <p className="mt-0.5 max-w-2xl text-[12px] text-ink-400">Os impostos próprios apurados no fiscal da Domínio sobre o faturamento (valor das notas): quanto a empresa realmente paga de imposto para cada R$ 1 faturado.</p>
            {grupo && <p className="mt-1 max-w-2xl text-[12px] font-medium text-ink-600">Grupo {grupo.name}: soma de {membros.length} empresas ({membros.map((membro) => membro.name).join(", ")}). Cada uma entra com os valores informados à mão e a opção do contábil que tiver na própria empresa.</p>}
          </div>
          <div className="flex items-center gap-2">
            {podeEditar && !editando && (
              <button type="button" onClick={abrirPersonalizar} className="flex h-8 items-center gap-1.5 rounded-md border border-accent-500/40 bg-accent-500/10 px-3 text-[12px] font-medium text-accent-700 hover:bg-accent-500/20">
                <SlidersHorizontal size={13} strokeWidth={1.8} /> Personalizar
              </button>
            )}
            <div className="inline-flex rounded-full bg-surface-muted p-1">
              {rows.map((item) => (
                <button key={item.ano} type="button" onClick={() => { setAno(item.ano); setSel("ano"); }} className={`rounded-full px-3 py-1 text-[12.5px] ${ano === item.ano ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : "text-ink-500"}`}>{item.ano}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1">
          {dados.meses.map((m, i) => {
            const vazio = !m.fat.total && !m.impTotal && !m.retTotal && !m.folhaTotal;
            return (
              <button key={i} type="button" onClick={() => setSel(i)} className={`flex min-w-[58px] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[12px] ${sel === i ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : vazio ? "text-ink-300" : "text-ink-600 hover:bg-surface-card/60"}`}>
                {MES_CURTO[i]}{m.manual && <Pencil size={9} className="ml-1 inline text-accent-600" />}
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

      {/* personalização: escolher e ordenar os blocos */}
      {editando && rascunho && (
        <div className="rounded-xl border border-accent-500/40 bg-surface-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-ink-900">Personalizar a tela</p>
          <p className="mt-0.5 text-[12px] text-ink-400">Marque o que quer ver e use as setas para mudar a ordem. Vale para quem abrir esta empresa.</p>
          <div className="mt-3 grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {rascunho.ordem.map((id) => {
              const bloco = POR_ID.get(id);
              const on = rascunho.ligados.has(id);
              return (
                <div key={id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${on ? "border-accent-500/40 bg-accent-500/5" : "border-line"}`}>
                  <input type="checkbox" checked={on} onChange={() => alternar(id)} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{bloco.nome}{bloco.kind === "kpi" && <span className="ml-1 text-[10.5px] text-ink-400">indicador</span>}</span>
                  {on && (
                    <>
                      <button type="button" onClick={() => mover(id, -1)} aria-label="Subir" className="rounded p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700"><ArrowUp size={13} /></button>
                      <button type="button" onClick={() => mover(id, 1)} aria-label="Descer" className="rounded p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700"><ArrowDown size={13} /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={salvar} disabled={salvando} className="rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600 disabled:opacity-50">{salvando ? "Salvando…" : "Salvar"}</button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted">Cancelar</button>
            <button type="button" onClick={() => setRascunho({ ordem: [...PADRAO, ...BLOCOS.map((b) => b.id).filter((id) => !PADRAO.includes(id))], ligados: new Set(PADRAO) })} className="ml-auto text-[12px] text-ink-500 underline decoration-dotted hover:text-ink-800">Voltar ao essencial</button>
          </div>
          {error && <p className="mt-2 text-[12px] text-danger-600">{error}</p>}
        </div>
      )}

      {mesSel != null && (mesSemFiscal || manualAno[mesSel]) && (podeEditar || manualAno[mesSel]) && (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900"><Pencil size={13} /> {MES_LONGO[mesSel]} sem dados do fiscal — {manualAno[mesSel] ? "valores informados manualmente" : "informe à mão se quiser"}</p>
          {podeEditar ? (
            <>
              <p className="mt-0.5 text-[12px] text-ink-400">Use quando o mês ainda não está na apuração da Domínio. Só entra na carga enquanto o fiscal não tiver o mês. Deixe em branco o que não existe.</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Faturamento
                  <input value={manualForm.fat} onChange={(e) => setManualForm((a) => ({ ...a, fat: e.target.value }))} inputMode="decimal" placeholder="0,00" className="mt-1 w-full rounded-md border border-line-strong bg-surface-card px-2 py-1.5 text-[13px] font-normal normal-case tabular-nums text-ink-900" />
                </label>
                {grupos.filter((g) => g.id !== "outros").map((g) => (
                  <label key={g.id} className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{nomeCurto(g.nome)}
                    <input value={manualForm.imp[g.id] || ""} onChange={(e) => setManualForm((a) => ({ ...a, imp: { ...a.imp, [g.id]: e.target.value } }))} inputMode="decimal" placeholder="0,00" className="mt-1 w-full rounded-md border border-line-strong bg-surface-card px-2 py-1.5 text-[13px] font-normal normal-case tabular-nums text-ink-900" />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={salvandoManual} onClick={() => salvarManual(false)} className="rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600 disabled:opacity-50">{salvandoManual ? "Salvando…" : "Salvar valores"}</button>
                {manualAno[mesSel] && <button type="button" disabled={salvandoManual} onClick={() => salvarManual(true)} className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted">Remover</button>}
              </div>
            </>
          ) : <p className="mt-0.5 text-[12px] text-ink-400">Valores informados pela contabilidade; o fiscal da Domínio ainda não tem este mês.</p>}
        </div>
      )}

      <p className="-mb-1 text-[16px] font-bold text-ink-900">{titulo}<span className="ml-3 text-[12px] font-normal text-ink-400">atualizado em {new Date(row.synced_at).toLocaleString("pt-BR")}</span></p>

      {itens.map((item) =>
        item.cartoes ? (
          <div key={item.chave} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{item.cartoes}</div>
        ) : (
          item.el
        )
      )}
      {!itens.length && <p className="rounded-xl bg-surface-card p-6 text-center text-[13px] text-ink-400 shadow-sm">Nenhum bloco escolhido. {podeEditar ? "Use Personalizar para escolher o que mostrar." : ""}</p>}
    </div>
  );
}
