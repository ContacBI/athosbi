import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, Minus } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { saveNotasConfig } from "../lib/companies.js";
import { groupCompanies } from "../lib/groups.js";
import { CONFIG_PADRAO, TIPOS, considerado, fetchNotas, montarEntradasSaidas, sugerirConsiderar } from "../lib/notasFiscais.js";
import Carregando from "../components/Carregando.jsx";

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const moneyFull = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const compacto = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

function Card({ label, value, hint, tone }) {
  const borda = tone === "warn" ? "border-warning-500" : tone === "accent" ? "border-accent-500" : "border-line-strong";
  return (
    <div className={`min-w-0 rounded-xl border-l-[3px] bg-surface-card p-4 shadow-sm ${borda}`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 truncate text-[20px] font-bold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  );
}

function Seletor({ rotulo, valor, opcoes, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] text-ink-400">{rotulo}</span>
      <div className="inline-flex rounded-xl bg-surface-muted p-1 text-[12.5px]">
        {opcoes.map(([id, nome]) => (
          <button key={id} type="button" onClick={() => onChange(id)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${valor === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{nome}</button>
        ))}
      </div>
    </div>
  );
}

export default function EntradasSaidas() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : company ? [company] : []), [grupo, company, state.companies]);
  const idsMembros = membros.map((m) => m.id).join(",");
  const [brutos, setBrutos] = useState(null); // { [companyId]: linhas do dominio_notas }
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ano, setAno] = useState(null);
  const [mesDe, setMesDe] = useState(1);
  const [mesAte, setMesAte] = useState(12);
  const [aba, setAba] = useState("S");
  const [foco, setFoco] = useState("todas"); // grupo: "todas" (consolidado) ou o id de uma empresa
  const [verAcumuladores, setVerAcumuladores] = useState(false);
  const equipe = Boolean(state.isAdmin || state.isColaborador); // cliente só vê as informações; os acumuladores (configuração) são da equipe
  const membrosUso = useMemo(() => (grupo && foco !== "todas" ? membros.filter((m) => m.id === foco) : membros), [membros, grupo, foco]);
  const ehConsolidado = Boolean(grupo) && foco === "todas";
  const config = (!grupo && company?.notasConfig) || (grupo && foco !== "todas" && membrosUso[0]?.notasConfig) || CONFIG_PADRAO;
  const base = config.base || "nota";
  const valor = config.valor || "nota";
  const podeEditar = Boolean(!grupo && company && (state.isAdmin || (company.responsaveis || []).includes(state.userEmail)));

  useEffect(() => {
    if (!membros.length) return undefined;
    let ativo = true;
    setBrutos(null);
    setErro("");
    Promise.all(membros.map((m) => fetchNotas(m.id).then((linhas) => [m.id, linhas])))
      .then((pares) => ativo && setBrutos(Object.fromEntries(pares)))
      .catch((err) => {
        console.error("Falha ao ler as notas fiscais:", err);
        if (ativo) setErro("Não consegui carregar as notas fiscais agora. Tente de novo.");
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsMembros]);

  const anos = useMemo(() => [...new Set(Object.values(brutos || {}).flatMap((linhas) => linhas.map((item) => item.ano)))].sort((a, b) => b - a), [brutos]);
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[0]);
  }, [anos, ano]);
  const sincronizado = useMemo(() => Object.values(brutos || {}).flatMap((linhas) => linhas.filter((i) => i.ano === ano).map((i) => i.synced_at)).sort().pop(), [brutos, ano]);

  const r = useMemo(() => (brutos && ano ? montarEntradasSaidas({ membros: membrosUso, brutos, ano, mesDe, mesAte, base, valor, ehGrupo: ehConsolidado }) : null), [membrosUso, brutos, ano, mesDe, mesAte, base, valor, ehConsolidado]);
  // grupo: uma linha por empresa pra comparar (cada uma com a própria escolha de acumuladores e a mesma base/valor)
  const comparativo = useMemo(() => (grupo && brutos && ano ? membros.map((m) => ({ membro: m, r: montarEntradasSaidas({ membros: [m], brutos, ano, mesDe, mesAte, base, valor }) })) : []), [grupo, membros, brutos, ano, mesDe, mesAte, base, valor]);

  async function gravar(proxima) {
    setAviso("");
    try {
      await saveNotasConfig(proxima);
    } catch (err) {
      console.error("Falha ao salvar a escolha dos acumuladores:", err);
      setAviso("Não consegui salvar a escolha agora. Tente de novo.");
    }
  }
  const alternar = (tipo, linha) => {
    const atual = considerado(config, tipo, linha.codigo, linha.nome);
    gravar({ ...CONFIG_PADRAO, ...config, flags: { ...(config.flags || {}), [tipo]: { ...(config.flags?.[tipo] || {}), [String(linha.codigo)]: !atual } } });
  };
  const emMassa = (tipo, modo) => {
    const lista = r?.linhas[tipo] || [];
    const novo = {};
    if (modo !== "sugestao") lista.forEach((linha) => { novo[String(linha.codigo)] = modo === "todos"; });
    gravar({ ...CONFIG_PADRAO, ...config, flags: { ...(config.flags || {}), [tipo]: novo } });
  };

  if (!membros.length) return <p className="p-6 text-[13px] text-ink-400">Abra uma empresa ou um grupo para ver as notas fiscais.</p>;
  if (erro) return <p className="p-6 text-[13px] text-danger-600">{erro}</p>;
  if (!brutos) return <Carregando texto="Carregando as notas fiscais…" />;
  if (!anos.length) {
    return (
      <div className="mx-auto max-w-[900px] p-6">
        <div className="rounded-xl bg-surface-card p-6 shadow-sm">
          <h1 className="text-[20px] font-semibold text-ink-900">Entradas x Saídas</h1>
          <p className="mt-2 text-[13px] text-ink-500">Ainda não chegaram notas fiscais da Domínio para {grupo ? "este grupo" : "esta empresa"}. A Central envia uma vez por dia; assim que chegarem, elas aparecem aqui.</p>
        </div>
      </div>
    );
  }

  if (!r) return <Carregando texto="Carregando as notas fiscais…" />; // o ano é escolhido no efeito logo depois da primeira leitura

  const dadosGrafico = (r?.meses || []).map((m, i) => ({
    mes: MES_CURTO[i],
    ativo: i + 1 >= mesDe && i + 1 <= mesAte,
    saidas: m.S.v + m.V.v,
    entradas: m.E.v,
    ticket: m.S.c + m.V.c ? (m.S.v + m.V.v) / (m.S.c + m.V.c) : null,
  })).filter((m) => m.ativo);
  const unidade = base === "item" ? "peças" : "notas";
  const totalLinhas = (tipo) => (r?.linhas[tipo] || []).reduce((s, l) => ({ notas: s.notas + l.notas, itens: s.itens + l.itens, qtd: s.qtd + l.qtd, vcon: s.vcon + l.vcon, vprod: s.vprod + l.vprod }), { notas: 0, itens: 0, qtd: 0, vcon: 0, vprod: 0 });
  const tot = totalLinhas(aba);
  const totBase = valor === "itens" ? tot.vprod : tot.vcon;

  return (
    <div className="flex w-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Notas fiscais</span>
            <h1 className="mt-1 flex items-center gap-2 text-[20px] font-semibold text-ink-900"><ArrowLeftRight size={18} /> Entradas x Saídas</h1>
            <p className="mt-0.5 text-[12.5px] text-ink-400">Da escrituração fiscal da Domínio, por acumulador. Só entra na conta o que está marcado.{sincronizado ? ` Atualizado em ${new Date(sincronizado).toLocaleDateString("pt-BR")}.` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <select value={ano || ""} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-line bg-surface-card px-2 py-1.5">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={mesDe} onChange={(e) => { const v = Number(e.target.value); setMesDe(v); if (v > mesAte) setMesAte(v); }} className="rounded-lg border border-line bg-surface-card px-2 py-1.5">
              {MES_CURTO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <span className="text-ink-400">a</span>
            <select value={mesAte} onChange={(e) => { const v = Number(e.target.value); setMesAte(v); if (v < mesDe) setMesDe(v); }} className="rounded-lg border border-line bg-surface-card px-2 py-1.5">
              {MES_CURTO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Seletor rotulo="Ticket médio por" valor={base} opcoes={[["nota", "Nota"], ["item", "Item (peças)"]]} onChange={podeEditar ? (id) => gravar({ ...CONFIG_PADRAO, ...config, base: id }) : () => setAviso("Só quem edita a empresa muda essa opção.")} />
          <Seletor rotulo="Valor" valor={valor} opcoes={[["nota", "Total da nota"], ["itens", "Só os itens"]]} onChange={podeEditar ? (id) => gravar({ ...CONFIG_PADRAO, ...config, valor: id }) : () => setAviso("Só quem edita a empresa muda essa opção.")} />
          {grupo && (
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-ink-400">Ver</span>
              <select value={foco} onChange={(e) => setFoco(e.target.value)} className="rounded-lg border border-line bg-surface-card px-2 py-1.5 text-[12.5px]">
                <option value="todas">Todas as empresas (consolidado)</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          {grupo && <span className="text-[11.5px] text-ink-400">No grupo, cada empresa usa a própria escolha de acumuladores; para mudar, abra a empresa.</span>}
        </div>
        {aviso && <p className="text-[12px] text-warning-700">{aviso}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Faturamento (saídas + serviços)" value={moneyFull(r.faturamento)} hint={`${inteiro(r.vendas)} ${unidade} consideradas`} tone="accent" />
        <Card label="Entradas consideradas" value={moneyFull(r.totais.E.v)} hint={`${inteiro(r.totais.E.c)} ${unidade}`} />
        <Card label="Faturamento − entradas" value={moneyFull(r.saldo)} hint="o que sai menos o que entra" tone={r.saldo < 0 ? "warn" : undefined} />
        <Card label={`Ticket médio por ${base === "item" ? "peça" : "nota"}`} value={r.ticket == null ? "—" : moneyFull(r.ticket)} hint="faturamento ÷ vendas consideradas" />
        <Card label="Entradas ÷ faturamento" value={r.faturamento ? `${((r.totais.E.v / r.faturamento) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"} hint="quanto do faturamento vira entrada" />
      </div>

      {grupo && comparativo.length > 1 && (
        <div className="rounded-xl bg-surface-card p-4 shadow-sm">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-900">Comparativo entre as empresas do grupo</h2>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
                    <th className="py-2 pr-3">Empresa</th>
                    <th className="py-2 pr-3 text-right">Faturamento</th>
                    <th className="py-2 pr-3 text-right">Entradas</th>
                    <th className="py-2 pr-3 text-right">Fat. − entradas</th>
                    <th className="py-2 pr-3 text-right">Ticket médio</th>
                    <th className="py-2 text-right">Entradas ÷ fat.</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.map(({ membro, r: re }) => (
                    <tr key={membro.id} onClick={() => setFoco(membro.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-muted/60" title="Ver só esta empresa">
                      <td className="py-2 pr-3">{membro.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(re.faturamento)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(re.totais.E.v)}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${re.saldo < 0 ? "text-danger-600" : ""}`}>{moneyFull(re.saldo)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{re.ticket == null ? "—" : moneyFull(re.ticket)}</td>
                      <td className="py-2 text-right tabular-nums">{re.faturamento ? `${((re.totais.E.v / re.faturamento) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={comparativo.map(({ membro, r: re }) => ({ nome: String(membro.name).split(" ")[0], faturamento: re.faturamento, entradas: re.totais.E.v }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(v, nome) => [moneyFull(v), nome]} />
                  <Legend />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="entradas" name="Entradas" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-400">Clique numa empresa para ver só ela. Cada empresa usa a própria escolha de acumuladores.</p>
        </div>
      )}

      <div className="rounded-xl bg-surface-card p-4 shadow-sm">
        <h2 className="mb-3 text-[13px] font-semibold text-ink-900">Mês a mês: o que sai × o que entra</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="v" tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
              <YAxis yAxisId="t" orientation="right" tickFormatter={compacto} tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v, nome) => [moneyFull(v), nome]} />
              <Legend />
              <Bar yAxisId="v" dataKey="saidas" name="Saídas + serviços" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="v" dataKey="entradas" name="Entradas" fill="#dc2626" radius={[3, 3, 0, 0]} />
              <Line yAxisId="t" dataKey="ticket" name="Ticket médio" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {equipe && (
      <div className="rounded-xl bg-surface-card p-4 shadow-sm">
        <button type="button" onClick={() => setVerAcumuladores((v) => !v)} className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-ink-900">
          {verAcumuladores ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Acumuladores: escolher o que entra na conta
          <span className="ml-1 text-[11.5px] font-normal text-ink-400">(só a equipe vê esta parte)</span>
        </button>
        {verAcumuladores && (<>
        <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-surface-muted p-1 text-[12.5px]">
            {TIPOS.map((t) => (
              <button key={t.id} type="button" onClick={() => setAba(t.id)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${aba === t.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{t.nome}</button>
            ))}
          </div>
          {podeEditar && (
            <div className="flex flex-wrap gap-2 text-[12px]">
              <button type="button" onClick={() => emMassa(aba, "sugestao")} className="rounded-lg border border-line px-2.5 py-1 text-ink-600 hover:bg-surface-muted">Usar sugestão</button>
              <button type="button" onClick={() => emMassa(aba, "todos")} className="rounded-lg border border-line px-2.5 py-1 text-ink-600 hover:bg-surface-muted">Marcar todos</button>
              <button type="button" onClick={() => emMassa(aba, "nenhum")} className="rounded-lg border border-line px-2.5 py-1 text-ink-600 hover:bg-surface-muted">Desmarcar todos</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
                <th className="w-10 py-2 pr-2">Conta</th>
                <th className="py-2 pr-3">Acumulador</th>
                <th className="py-2 pr-3 text-right">Notas</th>
                <th className="py-2 pr-3 text-right">Itens</th>
                <th className="py-2 pr-3 text-right">Total da nota</th>
                <th className="py-2 pr-3 text-right">Só os itens</th>
                <th className="py-2 text-right">% do tipo</th>
              </tr>
            </thead>
            <tbody>
              {(r.linhas[aba] || []).map((linha) => {
                const base$ = valor === "itens" ? linha.vprod : linha.vcon;
                const marcado = linha.conta === "sim";
                return (
                  <tr key={linha.chave} className={`border-b border-line last:border-0 ${linha.conta === "nao" ? "text-ink-400" : ""}`}>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        disabled={!podeEditar}
                        onClick={() => alternar(aba, linha)}
                        title={podeEditar ? (marcado ? "Tirar da conta" : "Considerar na conta") : linha.conta === "parcial" ? "Considerado só em parte das empresas" : "Escolha dentro de cada empresa"}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${marcado ? "border-accent-500 bg-accent-500 text-white" : linha.conta === "parcial" ? "border-accent-500 text-accent-600" : "border-line-strong text-transparent"} ${podeEditar ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                      >
                        {linha.conta === "parcial" ? <Minus size={13} /> : <Check size={13} />}
                      </button>
                    </td>
                    <td className="py-2 pr-3"><span className="mr-2 text-[11.5px] tabular-nums text-ink-400">{linha.codigo}</span>{linha.nome}{!podeEditar ? "" : sugerirConsiderar(aba, linha.nome) === marcado ? "" : <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 text-[10.5px] text-ink-500">escolha sua</span>}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{inteiro(linha.notas)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{inteiro(linha.itens)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(linha.vcon)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(linha.vprod)}</td>
                    <td className="py-2 text-right tabular-nums">{totBase ? `${((base$ / totBase) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td>
                  </tr>
                );
              })}
              {!(r.linhas[aba] || []).length && <tr><td colSpan={7} className="py-6 text-center text-ink-400">Nenhuma nota deste tipo no período.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong font-semibold text-ink-900">
                <td />
                <td className="py-2 pr-3">Total do tipo (todos os acumuladores)</td>
                <td className="py-2 pr-3 text-right tabular-nums">{inteiro(tot.notas)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{inteiro(tot.itens)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(tot.vcon)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(tot.vprod)}</td>
                <td />
              </tr>
              <tr className="text-accent-700">
                <td />
                <td className="py-1 pr-3">Considerado na conta</td>
                <td colSpan={5} className="py-1 text-right tabular-nums">{moneyFull(r.totais[aba].v)} · {inteiro(r.totais[aba].c)} {unidade}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-ink-400">Acumuladores de venda e de compra de mercadoria vêm marcados por sugestão; devolução, remessa, bonificação e demonstração vêm desmarcados. Ajuste ao seu critério: a escolha fica salva na empresa.</p>
        </>)}
      </div>
      )}
    </div>
  );
}
