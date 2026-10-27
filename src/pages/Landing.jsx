import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, ChevronRight, Clock, LayoutGrid, LogOut, MessageSquare, Network, Presentation, Scale, Search, Settings, Activity } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useAppState } from "../data/useStore.js";
import { temBi as temModuloBi, temReforma as temModuloReforma } from "../lib/modulos.js";
import { groupCompanies } from "../lib/groups.js";
import { ensureCompanyJournalLoaded } from "../lib/companies.js";
import { numerosDaEmpresa, primeiroNome, resumoCarteira, saudacao } from "../lib/inicio.js";
import { recentes } from "../lib/recentes.js";
import { useAbrirWorkspace } from "../lib/useAbrirWorkspace.js";
import { compactValue } from "../lib/presentations.js";
import { configResumo } from "../lib/resumoCelular.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import AthosMark from "../components/AthosMark.jsx";
import WorkspaceLoading from "../components/WorkspaceLoading.jsx";

// Início: a primeira tela depois do login, diferente pra cada um.
//  - Cliente: a(s) empresa(s) dele em cartões, já com o resultado do último
//    mês e do ano, o recado do escritório e atalho pra última apresentação.
//    Com poucas empresas, o razão já vem carregando aqui — abrir fica rápido.
//  - Equipe: busca pra abrir qualquer empresa, as abertas por último, a
//    situação da carteira numa linha e os atalhos do dia a dia.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (mes) => MESES[Number(String(mes).slice(5, 7)) - 1] || "";
const mesCurto = (mes) => (mes ? `${nomeDoMes(mes).slice(0, 3)}/${String(mes).slice(2, 4)}` : "");
const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Cliente com até tantas empresas: os números de cada uma são calculados
// aqui (precisa do razão). Mais que isso, o cartão mostra só até quando vão
// os dados — não vale baixar o razão de todas só pra tela inicial.
const MAX_COM_NUMEROS = 4;

function quando(iso) {
  const dias = Math.floor((Date.now() - Date.parse(iso || "")) / 86400000);
  if (!Number.isFinite(dias)) return "";
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "há 1 mês" : `há ${meses} meses`;
}

function Topo({ staff, onConfig }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 sm:px-8">
      <span className="flex items-center gap-2.5">
        <AthosMark size={28} />
        <span className="text-[16px] font-semibold tracking-tight text-white">AthosBI</span>
      </span>
      <span className="flex items-center gap-1">
        <ThemeToggle />
        {staff && (
          <button type="button" onClick={onConfig} aria-label="Configurações" title="Configurações" className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white">
            <Settings size={19} />
          </button>
        )}
        <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sair" title="Sair" className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut size={18} />
        </button>
      </span>
    </div>
  );
}

function Valor({ rotulo, valor, destaque = false }) {
  const negativo = valor < -0.5;
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] text-ink-400">{rotulo}</p>
      <p className={`truncate font-semibold tabular-nums ${destaque ? "text-[22px] leading-tight" : "text-[15px]"} ${negativo ? "text-danger-600" : "text-ink-900"}`}>{compactValue(valor, "money")}</p>
    </div>
  );
}

// Cartão de uma empresa (cliente).
function CartaoEmpresa({ company, numeros, calculando, grande, onAbrir, onApresentacao }) {
  const recado = configResumo(company.resumoCelular).recado.trim();
  const ocultos = configResumo(company.resumoCelular).ocultos;
  const ultimaApresentacao = [...(company.presentations || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
  const ate = numeros?.mes || String(company.lastBalanceteMeta?.fim || "").slice(0, 7);
  return (
    <article className={`inicio-empresa flex flex-col rounded-2xl bg-surface-card shadow-sm ring-1 ring-line ${grande ? "p-6" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Building2 size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`truncate font-semibold text-ink-900 ${grande ? "text-[18px]" : "text-[15px]"}`}>{company.name}</h3>
          <p className="truncate text-[12px] text-ink-400">
            {company.cnpj || ""}
            {company.cnpj && ate ? " · " : ""}
            {ate ? `dados até ${mesCurto(ate)}` : ""}
          </p>
        </div>
      </div>

      {calculando ? (
        <div className="mt-5 grid grid-cols-2 gap-4" aria-label="Calculando os números">
          {[0, 1].map((item) => (
            <div key={item} className="flex flex-col gap-2">
              <span className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
              <span className="h-6 w-28 animate-pulse rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : (
        numeros && (
          <div className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-3 ${grande ? "sm:grid-cols-4" : ""}`}>
            <Valor rotulo={`${numeros.lucroMes < -0.5 ? "Prejuízo" : "Lucro"} de ${nomeDoMes(numeros.mes)}`} valor={numeros.lucroMes} destaque />
            <Valor rotulo={`Receita de ${nomeDoMes(numeros.mes)}`} valor={numeros.receitaMes} destaque />
            <Valor rotulo={`${numeros.lucroAno < -0.5 ? "Prejuízo" : "Lucro"} no ano (até ${mesCurto(numeros.mes)})`} valor={numeros.lucroAno} destaque={grande} />
            <Valor rotulo={`Receita no ano (até ${mesCurto(numeros.mes)})`} valor={numeros.receitaAno} destaque={grande} />
          </div>
        )
      )}

      {recado && !ocultos.includes("recado") && (
        <div className="mt-4 flex gap-2.5 rounded-xl bg-accent-50 p-3 ring-1 ring-accent-200">
          <MessageSquare size={16} className="mt-0.5 shrink-0 text-accent-600" />
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-accent-700">Recado do escritório</p>
            <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-ink-800">{recado}</p>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button type="button" onClick={onAbrir} className="inicio-abrir flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600">
          Abrir <ArrowRight size={15} />
        </button>
        {ultimaApresentacao && (
          <button type="button" onClick={() => onApresentacao(ultimaApresentacao.id)} title={ultimaApresentacao.name} className="inicio-apresentacao flex min-w-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-2 text-[12.5px] text-ink-700 hover:bg-surface-muted">
            <Presentation size={14} className="shrink-0" />
            <span className="truncate">Última apresentação</span>
          </button>
        )}
      </div>
    </article>
  );
}

function Atalho({ icone: Icone, titulo, texto, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-3 rounded-xl bg-surface-card p-3.5 text-left shadow-sm ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-500 group-hover:text-accent-600">
        <Icone size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink-900">{titulo}</span>
        {texto && <span className="block truncate text-[11.5px] text-ink-400">{texto}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-300" />
    </button>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const state = useAppState();
  const staff = Boolean(state.isAdmin || state.isColaborador);
  // Um caminho por módulo liberado (ver lib/modulos.js) — cliente só da
  // Reforma Tributária nem vê o B.I.
  const temBi = temModuloBi(state);
  const temReforma = temModuloReforma(state);
  const { pending, abrirEmpresa, abrirGrupo, cancelar } = useAbrirWorkspace();
  const nome = primeiroNome(state.nomeUsuario);
  const ola = `${saudacao()}${nome ? `, ${nome}` : ""}`;

  // Grupos que o cliente enxerga inteiros (mesma regra de Empresas.jsx).
  const gruposCliente = useMemo(
    () => (staff ? [] : state.groups.filter((group) => (group.companyIds || []).length > 0 && groupCompanies(group).length === group.companyIds.length)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, state.groups, state.companies]
  );

  // ── Cliente: números de cada empresa (razão carregando aqui mesmo) ──
  const [numeros, setNumeros] = useState({}); // id → números | null (sem dados)
  const calcularNumeros = !staff && temBi && state.companies.length <= MAX_COM_NUMEROS;
  const idsEmpresas = state.companies.map((company) => company.id).join("|");
  useEffect(() => {
    if (!calcularNumeros) return undefined;
    let vivo = true;
    (async () => {
      for (const company of state.companies) {
        try {
          const carregado = company.journalLoaded ? company : await ensureCompanyJournalLoaded(company);
          if (!vivo) return;
          const pronto = carregado && !carregado.journalLoadFailed ? { ...company, ...carregado, journalLoaded: true } : null;
          const valor = pronto ? numerosDaEmpresa(pronto) : null;
          setNumeros((atual) => ({ ...atual, [company.id]: valor }));
        } catch (error) {
          console.warn("Início: sem números de", company.name, error?.message || error);
          if (vivo) setNumeros((atual) => ({ ...atual, [company.id]: null }));
        }
        // Uma por vez, devolvendo a vez pro navegador entre elas.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcularNumeros, idsEmpresas]);

  // ── Equipe: busca, abertas por último e a carteira ──
  const [busca, setBusca] = useState("");
  const buscaRef = useRef(null);
  const resultados = useMemo(() => {
    const termo = norm(busca.trim());
    if (!staff || !termo) return [];
    const grupos = state.groups.filter((group) => norm(group.name).includes(termo)).map((group) => ({ tipo: "grupo", id: group.id, nome: group.name, detalhe: `Grupo · ${(group.companyIds || []).length} empresas` }));
    const empresas = state.companies.filter((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(termo)).map((company) => ({ tipo: "empresa", id: company.id, nome: company.name, detalhe: [company.codigo, company.cnpj].filter(Boolean).join(" · ") }));
    return [...grupos, ...empresas].slice(0, 8);
  }, [staff, busca, state.companies, state.groups]);

  const abertas = useMemo(() => {
    if (!staff) return [];
    return recentes()
      .map((item) => {
        const registro = item.tipo === "grupo" ? state.groups.find((group) => group.id === item.id) : state.companies.find((company) => company.id === item.id);
        return registro ? { ...item, nome: registro.name } : null;
      })
      .filter(Boolean)
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, state.companies, state.groups]);

  const [carteira, setCarteira] = useState(null);
  useEffect(() => {
    if (!staff || !state.companies.length) return undefined;
    // Depois da primeira pintura: com muitas empresas são alguns instantes.
    const timer = setTimeout(() => {
      try {
        setCarteira(resumoCarteira(state.companies));
      } catch (error) {
        console.warn("Início: resumo da carteira falhou", error);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [staff, state.companies]);

  // "/" vai pra busca (mesmo atalho da lista de empresas).
  useEffect(() => {
    if (!staff) return undefined;
    function tecla(event) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      buscaRef.current?.focus();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [staff]);

  const abrir = (item, destino) => (item.tipo === "grupo" ? abrirGrupo(item.id, destino) : abrirEmpresa(item.id, destino));

  const hero = (
    <div className="relative z-10 bg-navy-950 text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(640px circle at 18% 0%, rgba(47,111,237,0.30), transparent 60%), radial-gradient(420px circle at 90% 120%, rgba(232,105,31,0.16), transparent 60%)" }} />
      <div className="relative">
        <Topo staff={staff} onConfig={() => navigate("/parametros")} />
        <div className="mx-auto max-w-5xl px-5 pb-9 pt-4 sm:px-8 sm:pb-11 sm:pt-6">
          <h1 className="inicio-ola text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{ola}</h1>
          <p className="mt-1.5 text-[14px] text-white/60">
            {staff
              ? `${state.companies.length} ${state.companies.length === 1 ? "empresa" : "empresas"} na carteira${state.groups.length ? ` · ${state.groups.length} ${state.groups.length === 1 ? "grupo" : "grupos"}` : ""}`
              : temBi
                ? "Os números da sua empresa, atualizados pelo escritório."
                : temReforma
                  ? "Simule o impacto da Reforma Tributária na sua empresa, produto a produto."
                  : ""}
          </p>

          {staff && (
            <div className="relative mt-6 max-w-xl">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && resultados[0]) abrir(resultados[0]);
                  if (event.key === "Escape") setBusca("");
                }}
                placeholder="Abrir empresa ou grupo — digite o nome, código ou CNPJ"
                className="inicio-busca h-12 w-full rounded-xl border border-white/15 bg-white/10 pl-11 pr-12 text-[14px] text-white outline-none placeholder:text-white/45 focus:border-white/35 focus:bg-white/15"
              />
              <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/20 px-1.5 text-[11px] text-white/45 sm:block">/</kbd>
              {busca.trim() && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl bg-surface-card text-ink-900 shadow-2xl ring-1 ring-line">
                  {resultados.length === 0 ? (
                    <p className="px-4 py-3 text-[13px] text-ink-400">Nada encontrado para "{busca.trim()}".</p>
                  ) : (
                    resultados.map((item, index) => (
                      <button key={`${item.tipo}:${item.id}`} type="button" onClick={() => abrir(item)} className={`inicio-resultado flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted ${index === 0 ? "bg-surface-muted/60" : ""}`}>
                        {item.tipo === "grupo" ? <Network size={16} className="shrink-0 text-ink-400" /> : <Building2 size={16} className="shrink-0 text-ink-400" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{item.nome}</span>
                          {item.detalhe && <span className="block truncate text-[11.5px] text-ink-400">{item.detalhe}</span>}
                        </span>
                        {index === 0 && <span className="shrink-0 text-[11px] text-ink-400">Enter</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="inicio min-h-screen bg-surface-page pb-16">
      {pending && <WorkspaceLoading name={pending.name} isGroup={pending.isGroup} phase={pending.phase} progress={state.journalLoadProgress} onCancel={cancelar} />}
      {hero}

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 pt-7 sm:px-8">
        {staff ? (
          <>
            {abertas.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
                  <Clock size={13} /> Abertas por último
                </h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {abertas.map((item) => (
                    <button key={`${item.tipo}:${item.id}`} type="button" onClick={() => abrir(item)} className="inicio-recente group flex items-center gap-3 rounded-xl bg-surface-card p-3.5 text-left shadow-sm ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">{item.tipo === "grupo" ? <Network size={17} /> : <Building2 size={17} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink-900">{item.nome}</span>
                        <span className="block text-[11.5px] text-ink-400">
                          {item.tipo === "grupo" ? "Grupo · " : ""}
                          {quando(item.at)}
                        </span>
                      </span>
                      <ArrowRight size={15} className="shrink-0 text-ink-300 group-hover:text-accent-600" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
                <Activity size={13} /> Situação da carteira
              </h2>
              <button type="button" onClick={() => navigate("/carteira")} className="inicio-carteira group flex w-full flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-surface-card p-5 text-left shadow-sm ring-1 ring-line transition-all hover:shadow-md">
                {!carteira ? (
                  <span className="text-[13px] text-ink-400">{state.companies.length ? "Calculando a situação das empresas…" : "Nenhuma empresa cadastrada ainda."}</span>
                ) : (
                  [
                    { valor: carteira.critico, rotulo: carteira.critico === 1 ? "crítica" : "críticas", cor: "bg-danger-500" },
                    { valor: carteira.atencao, rotulo: "em atenção", cor: "bg-warning-500" },
                    { valor: carteira.ok, rotulo: "em dia", cor: "bg-success-500" },
                    { valor: carteira.atrasadas, rotulo: carteira.atrasadas === 1 ? "com dados atrasados" : "com dados atrasados", cor: "bg-ink-300" },
                    { valor: carteira.depara, rotulo: "com De/Para pendente", cor: "bg-ink-300" },
                  ].map((item) => (
                    <span key={item.rotulo} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.cor}`} />
                      <span className="text-[20px] font-semibold tabular-nums text-ink-900">{item.valor}</span>
                      <span className="text-[13px] text-ink-500">{item.rotulo}</span>
                    </span>
                  ))
                )}
                <span className="ml-auto flex items-center gap-1 text-[12.5px] font-medium text-accent-600">
                  Ver a carteira <ChevronRight size={15} />
                </span>
              </button>
            </section>

            <section>
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Atalhos</h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <Atalho icone={LayoutGrid} titulo="Todas as empresas" texto="Lista completa e grupos" onClick={() => navigate("/empresas")} />
                <Atalho icone={Activity} titulo="Carteira" texto="Saúde dos dados" onClick={() => navigate("/carteira")} />
                {temReforma && <Atalho icone={Scale} titulo="Reforma Tributária" texto="Simulações" onClick={() => navigate("/reforma")} />}
                <Atalho icone={Settings} titulo="Parâmetros" texto="Cadastros e acessos" onClick={() => navigate("/parametros")} />
              </div>
            </section>
          </>
        ) : (
          <>
            {temBi && (state.companies.length > 0 || gruposCliente.length > 0) && (
              <section>
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-400">{state.companies.length + gruposCliente.length === 1 ? "Sua empresa" : "Suas empresas"}</h2>
                <div className={`grid grid-cols-1 gap-4 ${state.companies.length + gruposCliente.length > 1 ? "md:grid-cols-2" : ""}`}>
                  {gruposCliente.map((group) => (
                    <article key={group.id} className="inicio-grupo flex flex-col rounded-2xl bg-surface-card p-5 shadow-sm ring-1 ring-line">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                          <Network size={19} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-semibold text-ink-900">{group.name}</h3>
                          <p className="text-[12px] text-ink-400">Consolidado de {(group.companyIds || []).length} empresas</p>
                        </div>
                      </div>
                      <div className="mt-auto pt-5">
                        <button type="button" onClick={() => abrirGrupo(group.id)} className="flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600">
                          Abrir o consolidado <ArrowRight size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                  {state.companies.map((company) => (
                    <CartaoEmpresa
                      key={company.id}
                      company={company}
                      grande={state.companies.length + gruposCliente.length === 1}
                      numeros={numeros[company.id]}
                      calculando={calcularNumeros && !(company.id in numeros)}
                      onAbrir={() => abrirEmpresa(company.id)}
                      onApresentacao={(deckId) => abrirEmpresa(company.id, `/empresa/apresentacoes/${deckId}?apresentar=1`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {temReforma && (
              <section>
                <Atalho icone={Scale} titulo="Reforma Tributária" texto="Simule o impacto da reforma na sua empresa, produto a produto" onClick={() => navigate("/reforma")} />
              </section>
            )}

            {!temBi && !temReforma && (
              <div className="rounded-2xl bg-surface-card p-8 text-center shadow-sm ring-1 ring-line">
                <p className="text-[14px] font-medium text-ink-900">Nenhum acesso liberado ainda</p>
                <p className="mt-1 text-[13px] text-ink-400">Fale com o escritório para liberar as suas empresas.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
