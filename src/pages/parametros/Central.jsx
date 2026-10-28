import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Activity, AlertCircle, Building2, CalendarClock, Clock, Laptop, Lightbulb, Lock, LogIn, MonitorSmartphone, RefreshCw, Smartphone, Tablet, Target, Timer, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "../../components/PageHeader.jsx";
import { useAppState } from "../../data/useStore.js";
import { listAccessGrants, listAccessPeople } from "../../lib/access.js";
import { listAdmins, listColaboradores } from "../../lib/colaboradores.js";
import { DONO_DA_CENTRAL, carregarUso, duracao, haQuanto, pistasDeUso, resumoDeUso } from "../../lib/uso.js";

// Parâmetros › Central: como o portal está sendo usado — quantas vezes cada
// pessoa entrou, em que telas passa mais tempo, em que horários e por qual
// aparelho. Pra decidir onde melhorar. Admin vê os clientes; a aba "Equipe
// interna" é só do dono da Central (o banco garante — ver uso_eventos em
// supabase/schema.sql). Os dados vêm de lib/uso.js.

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];
const SEMANA = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [0, "Dom"],
];
const DISPOSITIVOS = [
  { id: "computador", rotulo: "Computador", icone: Laptop },
  { id: "celular", rotulo: "Celular", icone: Smartphone },
  { id: "tablet", rotulo: "Tablet", icone: Tablet },
];

const ICONE_DA_PISTA = { foco: Target, atencao: AlertCircle, celular: Smartphone, bom: TrendingUp, horario: CalendarClock };
const TOM_DA_PISTA = { foco: "bg-accent-50 text-accent-600", atencao: "bg-warning-50 text-warning-700", celular: "bg-surface-muted text-ink-600", bom: "bg-success-50 text-success-600", horario: "bg-surface-muted text-ink-600" };

function inicioDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function Variacao({ atual, anterior }) {
  if (!anterior && !atual) return null;
  if (!anterior) return <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-700">novo</span>;
  const pct = ((atual - anterior) / anterior) * 100;
  const subiu = pct >= 0;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${Math.abs(pct) < 0.5 ? "bg-surface-muted text-ink-500" : subiu ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-700"}`}>
      {subiu ? "▲" : "▼"} {Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
    </span>
  );
}

function Numero({ icone: Icone, rotulo, valor, sub, atual, anterior }) {
  return (
    <div className="central-numero rounded-2xl bg-surface-card p-4 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500">
          <Icone size={14} className="text-accent-500" /> {rotulo}
        </span>
        <Variacao atual={atual} anterior={anterior} />
      </div>
      <p className="mt-2 text-[24px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">{valor}</p>
      {sub && <p className="mt-1.5 text-[11.5px] text-ink-400">{sub}</p>}
    </div>
  );
}

function Cartao({ titulo, sub, direita, children, className = "" }) {
  return (
    <section className={`rounded-2xl bg-surface-card p-5 ring-1 ring-line ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-ink-900">{titulo}</h2>
          {sub && <p className="mt-0.5 text-[11.5px] text-ink-400">{sub}</p>}
        </div>
        {direita}
      </div>
      {children}
    </section>
  );
}

function DicaDoDia({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl bg-navy-950 px-3 py-2 text-[12px] text-white shadow-xl ring-1 ring-white/10">
      <p className="text-white/60">{item.rotulo}</p>
      <p className="font-semibold">
        {item.acessos} acesso{item.acessos === 1 ? "" : "s"} · {item.pessoas} pessoa{item.pessoas === 1 ? "" : "s"}
      </p>
      <p className="text-white/60">{duracao(item.segundos)} de uso</p>
    </div>
  );
}

// Dia da semana × hora: mais forte = mais acessos.
function Horarios({ horarios }) {
  const maior = Math.max(1, ...horarios.flat());
  const pico = horarios.flatMap((linha, dia) => linha.map((valor, hora) => ({ dia, hora, valor }))).sort((a, b) => b.valor - a.valor)[0];
  const nomeDia = Object.fromEntries(SEMANA.map(([indice, nome]) => [indice, nome]));
  return (
    <div>
      <div className="central-horarios grid gap-[3px]" style={{ gridTemplateColumns: "32px repeat(24, minmax(0, 1fr))" }}>
        {SEMANA.map(([indice, nome]) => (
          <div key={nome} className="contents">
            <span className="flex items-center text-[10.5px] text-ink-400">{nome}</span>
            {horarios[indice].map((valor, hora) => (
              <span
                key={hora}
                title={`${nome}, ${hora}h: ${valor ? valor : "nenhum"}`}
                className="h-[18px] rounded-[4px]"
                style={{ background: valor ? `color-mix(in srgb, var(--color-accent-500) ${Math.round(14 + (valor / maior) * 80)}%, transparent)` : "var(--color-surface-muted)" }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hora) => (
          <span key={hora} className="pt-1 text-center text-[9.5px] tabular-nums text-ink-300">
            {hora % 3 === 0 ? `${hora}h` : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-400">
        <span>{pico?.valor ? `Pico: ${nomeDia[pico.dia]} às ${pico.hora}h` : "Sem acessos no período"}</span>
        <span className="flex items-center gap-1.5">
          menos
          {[14, 40, 66, 94].map((forca) => (
            <span key={forca} className="h-2.5 w-3.5 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--color-accent-500) ${forca}%, transparent)` }} />
          ))}
          mais
        </span>
      </div>
    </div>
  );
}

export default function Central() {
  const state = useAppState();
  const dono = String(state.userEmail || "").toLowerCase() === DONO_DA_CENTRAL;
  const [aba, setAba] = useState("clientes");
  const [dias, setDias] = useState(30);
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState("");
  const [nomes, setNomes] = useState(new Map());
  const [comAcesso, setComAcesso] = useState([]);
  const [todasTelas, setTodasTelas] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const interno = aba === "equipe";

  const agora = useMemo(() => new Date(), [dias, aba, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps
  const inicio = useMemo(() => {
    const data = inicioDoDia(agora);
    data.setDate(data.getDate() - (dias - 1));
    return data;
  }, [agora, dias]);
  const inicioAnterior = useMemo(() => {
    const data = new Date(inicio);
    data.setDate(data.getDate() - dias);
    return data;
  }, [inicio, dias]);

  useEffect(() => {
    if (!state.isAdmin) return;
    let vivo = true;
    setLinhas(null);
    setErro("");
    carregarUso({ desde: inicioAnterior.toISOString(), interno })
      .then((dados) => vivo && setLinhas(dados))
      .catch((error) => {
        if (!vivo) return;
        console.error("Central:", error);
        setErro(/uso_eventos|PGRST205|42P01/.test(String(error?.message || error?.code || "")) ? "tabela" : String(error?.message || error));
        setLinhas([]);
      });
    return () => {
      vivo = false;
    };
  }, [state.isAdmin, inicioAnterior, interno]);

  // Nomes e quem tem acesso (pra "ainda não entraram").
  useEffect(() => {
    if (!state.isAdmin) return;
    let vivo = true;
    if (interno) {
      Promise.all([listAdmins().catch(() => []), listColaboradores().catch(() => [])]).then(([admins, colaboradores]) => {
        if (!vivo) return;
        const pessoas = [...admins, ...colaboradores];
        setNomes(new Map(pessoas.map((pessoa) => [pessoa.email, pessoa.nome || ""])));
        setComAcesso([...new Set(pessoas.map((pessoa) => pessoa.email))]);
      });
    } else {
      Promise.all([listAccessPeople().catch(() => new Map()), listAccessGrants().catch(() => [])]).then(([fichas, concessoes]) => {
        if (!vivo) return;
        setNomes(new Map([...fichas.values()].map((ficha) => [ficha.email, ficha.nome || ""])));
        setComAcesso([...new Set([...concessoes.map((item) => String(item.email || "").toLowerCase()), ...fichas.keys()])].filter(Boolean));
      });
    }
    return () => {
      vivo = false;
    };
  }, [state.isAdmin, interno]);

  const resumo = useMemo(() => (linhas ? resumoDeUso(linhas, { inicio, fim: new Date(agora.getTime() + 1000) }) : null), [linhas, inicio, agora]);
  const anterior = useMemo(() => (linhas ? resumoDeUso(linhas, { inicio: inicioAnterior, fim: inicio }) : null), [linhas, inicioAnterior, inicio]);

  if (!state.isAdmin) return <Navigate to="/parametros/empresas" replace />;

  const nomeDe = (email) => nomes.get(email) || email.split("@")[0];
  const dadosDia = (resumo?.porDia || []).map((item) => ({ ...item, rotulo: item.dia.slice(8, 10) + "/" + item.dia.slice(5, 7) }));
  const maiorTela = Math.max(1, ...(resumo?.telas || []).map((item) => item.segundos));
  const listaTelas = (resumo?.telas || []).slice(0, todasTelas ? 50 : 8);
  const quemEntrou = new Set((resumo?.pessoasLista || []).map((pessoa) => pessoa.email));
  const naoEntraram = comAcesso.filter((email) => !quemEntrou.has(email) && !(!interno && email === DONO_DA_CENTRAL)).sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));
  const totalDispositivos = Object.values(resumo?.dispositivos || {}).reduce((soma, valor) => soma + valor, 0);
  const vazio = resumo && !resumo.acessos && !resumo.telas.length;
  const pistas = pistasDeUso(resumo, { anterior, naoEntraram: naoEntraram.length, interno });

  return (
    <div className="central">
      <PageHeader eyebrow="Central" title="Uso do portal" icon={Activity} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-muted p-1" role="tablist">
          <button type="button" role="tab" aria-selected={!interno} onClick={() => setAba("clientes")} className={`central-aba-clientes flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${!interno ? "bg-surface-card text-ink-900 shadow-sm ring-1 ring-line" : "text-ink-500 hover:text-ink-900"}`}>
            <Users size={14} /> Clientes
          </button>
          {dono && (
            <button type="button" role="tab" aria-selected={interno} onClick={() => setAba("equipe")} className={`central-aba-equipe flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${interno ? "bg-surface-card text-ink-900 shadow-sm ring-1 ring-line" : "text-ink-500 hover:text-ink-900"}`} title="Só você vê esta aba">
              <Lock size={13} /> Equipe interna
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
            {PERIODOS.map((periodo) => (
              <button key={periodo.dias} type="button" onClick={() => setDias(periodo.dias)} className={`central-periodo rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${dias === periodo.dias ? "bg-surface-card text-ink-900 shadow-sm ring-1 ring-line" : "text-ink-500 hover:text-ink-900"}`}>
                {periodo.rotulo}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setRecarregar((valor) => valor + 1)} title="Atualizar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 ring-1 ring-line hover:bg-surface-muted hover:text-ink-900">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {erro === "tabela" ? (
        <div className="rounded-2xl bg-warning-50 p-5 text-[13px] text-warning-700 ring-1 ring-warning-500/30">A tabela da Central ainda não foi criada no Supabase. Rode o trecho “Central” do supabase/schema.sql no SQL Editor e atualize esta página.</div>
      ) : erro ? (
        <div className="rounded-2xl bg-danger-50 p-5 text-[13px] text-danger-700">Não consegui carregar a Central: {erro}</div>
      ) : !resumo ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Carregando">
          {[0, 1, 2, 3].map((item) => (
            <span key={item} className="h-[104px] animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {interno && (
            <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
              <Lock size={13} className="text-accent-500" /> Uso da equipe (administradores e colaboradores). Só você vê esta aba.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero icone={LogIn} rotulo="Acessos" valor={resumo.acessos.toLocaleString("pt-BR")} sub={`nos últimos ${dias} dias`} atual={resumo.acessos} anterior={anterior.acessos} />
            <Numero icone={Users} rotulo="Pessoas que entraram" valor={resumo.pessoas.toLocaleString("pt-BR")} sub={comAcesso.length ? `de ${comAcesso.length} com acesso` : ""} atual={resumo.pessoas} anterior={anterior.pessoas} />
            <Numero icone={Clock} rotulo="Tempo de uso" valor={duracao(resumo.segundos)} sub="com a tela aberta e em uso" atual={resumo.segundos} anterior={anterior.segundos} />
            <Numero icone={Timer} rotulo="Tempo por acesso" valor={duracao(resumo.mediaPorAcesso)} sub="em média" atual={resumo.mediaPorAcesso} anterior={anterior.mediaPorAcesso} />
          </div>

          {vazio && (
            <div className="rounded-2xl bg-accent-50 p-4 text-[12.5px] leading-relaxed text-ink-700 ring-1 ring-accent-200/80">
              Ainda não há registros neste período. A Central conta os acessos a partir da publicação desta versão — conforme {interno ? "a equipe usa" : "os clientes entram"}, os números aparecem aqui.
            </div>
          )}

          <Cartao titulo="Acessos por dia" sub="Passe o mouse num dia para ver pessoas e tempo de uso">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosDia} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10.5, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<DicaDoDia />} cursor={{ fill: "var(--color-surface-muted)", radius: 4 }} />
                  <Bar dataKey="acessos" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Cartao>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Cartao
              titulo="Onde passam mais tempo"
              sub="Tempo somado de todas as pessoas em cada tela"
              direita={
                (resumo.telas.length > 8 || todasTelas) && (
                  <button type="button" onClick={() => setTodasTelas((valor) => !valor)} className="text-[12px] font-medium text-accent-600 hover:underline">
                    {todasTelas ? "Ver menos" : `Ver todas (${resumo.telas.length})`}
                  </button>
                )
              }
            >
              {listaTelas.length ? (
                <ol className="central-telas flex flex-col gap-3">
                  {listaTelas.map((item, index) => (
                    <li key={item.tela}>
                      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate font-medium text-ink-800">
                          <span className="mr-1.5 tabular-nums text-ink-300">{index + 1}</span>
                          {item.tela}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-ink-900">{duracao(item.segundos)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.max(2, (item.segundos / maiorTela) * 100)}%`, opacity: 1 - index * 0.06 }} />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {item.visitas} visita{item.visitas === 1 ? "" : "s"} · {duracao(item.mediaPorVisita)} por visita · {item.pessoas} pessoa{item.pessoas === 1 ? "" : "s"}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-[12.5px] text-ink-400">Nenhuma tela registrada no período.</p>
              )}
            </Cartao>

            <div className="flex flex-col gap-4">
              <Cartao titulo="Quando entram" sub="Dia da semana e hora dos acessos">
                <Horarios horarios={resumo.horarios} />
              </Cartao>
              <Cartao titulo="Por onde entram" sub="Aparelho de cada acesso">
                {totalDispositivos ? (
                  <>
                    <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
                      {DISPOSITIVOS.map((item, index) =>
                        resumo.dispositivos[item.id] ? <div key={item.id} style={{ width: `${(resumo.dispositivos[item.id] / totalDispositivos) * 100}%`, background: `color-mix(in srgb, var(--color-accent-500) ${100 - index * 32}%, transparent)` }} /> : null
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {DISPOSITIVOS.map(({ id, rotulo, icone: Icone }, index) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--color-accent-500) ${100 - index * 32}%, transparent)` }} />
                          <Icone size={14} className="shrink-0 text-ink-400" />
                          <span className="min-w-0 text-[12px] text-ink-600">
                            {rotulo}
                            <span className="ml-1 font-semibold tabular-nums text-ink-900">{Math.round(((resumo.dispositivos[id] || 0) / totalDispositivos) * 100)}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-[12.5px] text-ink-400">
                    <MonitorSmartphone size={15} /> Sem acessos no período.
                  </p>
                )}
              </Cartao>
              {pistas.length > 0 && (
                <Cartao titulo="Pistas pra melhorar" sub="Tiradas dos números do período" direita={<Lightbulb size={16} className="text-accent-500" />}>
                  <ul className="central-pistas flex flex-col gap-2.5">
                    {pistas.map((pista) => {
                      const Icone = ICONE_DA_PISTA[pista.tipo] || Lightbulb;
                      return (
                        <li key={pista.texto} className="flex gap-2.5 text-[12.5px] leading-snug text-ink-700">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${TOM_DA_PISTA[pista.tipo] || TOM_DA_PISTA.foco}`}>
                            <Icone size={13} />
                          </span>
                          <span className="pt-0.5">{pista.texto}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Cartao>
              )}
            </div>
          </div>

          <Cartao titulo="Quem mais usa" sub={`${resumo.pessoasLista.length} pessoa${resumo.pessoasLista.length === 1 ? "" : "s"} no período, por tempo de uso`}>
            {resumo.pessoasLista.length ? (
              <div className="-mx-5 overflow-x-auto">
                <table className="central-pessoas w-full min-w-[760px] text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                      <th className="px-5 pb-2">Pessoa</th>
                      <th className="px-2 pb-2">Empresa</th>
                      <th className="px-2 pb-2 text-right">Acessos</th>
                      <th className="px-2 pb-2 text-right">Tempo</th>
                      <th className="px-2 pb-2">Mais usa</th>
                      <th className="px-5 pb-2 text-right">Último acesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.pessoasLista.map((pessoa) => {
                      const Aparelho = DISPOSITIVOS.find((item) => item.id === pessoa.dispositivo)?.icone || Laptop;
                      return (
                        <tr key={pessoa.email} className="border-b border-line/70 last:border-0 hover:bg-surface-muted/50">
                          <td className="px-5 py-2.5">
                            <span className="flex items-center gap-2">
                              <Aparelho size={14} className="shrink-0 text-ink-300" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink-900">{nomeDe(pessoa.email)}</span>
                                <span className="block truncate text-[11px] text-ink-400">{pessoa.email}</span>
                              </span>
                            </span>
                          </td>
                          <td className="max-w-[220px] px-2 py-2.5">
                            <span className="block truncate text-ink-600" title={pessoa.empresas.join(", ")}>
                              {pessoa.empresas[0] || "—"}
                              {pessoa.empresas.length > 1 && <span className="ml-1 text-ink-400">+{pessoa.empresas.length - 1}</span>}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-ink-800">{pessoa.acessos}</td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-ink-900">{duracao(pessoa.segundos)}</td>
                          <td className="max-w-[200px] px-2 py-2.5">
                            <span className="block truncate text-ink-600">{pessoa.tela || "—"}</span>
                          </td>
                          <td className="px-5 py-2.5 text-right text-ink-500" title={pessoa.ultimo ? new Date(pessoa.ultimo).toLocaleString("pt-BR") : ""}>
                            {haQuanto(pessoa.ultimo)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-[12.5px] text-ink-400">Ninguém entrou no período.</p>
            )}
          </Cartao>

          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao titulo="Empresas mais vistas" sub="Tempo nas telas de cada empresa">
              {resumo.empresas.length ? (
                <ul className="flex flex-col divide-y divide-line/70">
                  {resumo.empresas.slice(0, 8).map((item) => (
                    <li key={item.empresa} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <Building2 size={14} className="shrink-0 text-ink-300" />
                        <span className="truncate text-ink-800">{item.empresa}</span>
                      </span>
                      <span className="shrink-0 text-ink-500">
                        <span className="font-semibold tabular-nums text-ink-900">{duracao(item.segundos)}</span> · {item.pessoas} pessoa{item.pessoas === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[12.5px] text-ink-400">Nenhuma empresa aberta no período.</p>
              )}
            </Cartao>
            <Cartao titulo="Não entraram no período" sub={interno ? "Pessoas da equipe sem acesso nesses dias" : "Clientes com acesso liberado que não entraram nesses dias"}>
              {naoEntraram.length ? (
                <ul className="central-ausentes flex flex-wrap gap-1.5">
                  {naoEntraram.slice(0, 60).map((email) => (
                    <li key={email} title={email} className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] text-ink-700">
                      {nomeDe(email)}
                    </li>
                  ))}
                  {naoEntraram.length > 60 && <li className="px-2 py-1 text-[12px] text-ink-400">+{naoEntraram.length - 60}</li>}
                </ul>
              ) : (
                <p className="py-6 text-center text-[12.5px] text-ink-400">{comAcesso.length ? "Todo mundo entrou pelo menos uma vez." : "—"}</p>
              )}
            </Cartao>
          </div>
        </div>
      )}
    </div>
  );
}
