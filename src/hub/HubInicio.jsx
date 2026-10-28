import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Calculator, CalendarClock, Clock, Network, Scale, Search, Sparkles } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { AREAS_DO_HUB, LINHA_DA_REFORMA, andamentoDaReforma } from "../lib/hub.js";
import { primeiroNome, resumoCarteira, saudacao } from "../lib/inicio.js";
import { recentes } from "../lib/recentes.js";
import { haQuanto } from "../lib/uso.js";
import Avatar from "../components/Avatar.jsx";
import Mosaico from "./Mosaico.jsx";
import LinhaDaReforma from "./LinhaDaReforma.jsx";
import { Revelar, Secao, moverLuz } from "./efeitos.jsx";

const ICONE_DA_AREA = { bi: BarChart3, tributario: Scale, servicos: CalendarClock, conteudos: BookOpen, ferramentas: Calculator };
const FAIXA = ["Resultado do mês", "Caixa", "Balanço", "Indicadores", "Reforma Tributária", "IBS e CBS", "Obrigações", "Guias", "Conteúdos", "Calculadoras"];

function hojePorExtenso() {
  const texto = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Numero({ valor, rotulo }) {
  return (
    <div>
      <p className="hub-display text-[34px] font-bold leading-none text-[var(--hub-texto)]">{valor}</p>
      <p className="mt-1.5 text-[12.5px] font-medium text-[var(--hub-texto-3)]">{rotulo}</p>
    </div>
  );
}

// Cartão de vidro que flutua por cima do mosaico.
function Flutuante({ className = "", atraso = 0, children, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <div className={`hub-flutua absolute ${className}`} style={{ "--atraso": `${atraso}s` }}>
      <Tag type={onClick ? "button" : undefined} onClick={onClick} onPointerMove={moverLuz} className={`hub-cartao ${onClick ? "hub-cartao-vivo cursor-pointer" : ""} block w-full rounded-[20px] p-4 text-left`}>
        {children}
      </Tag>
    </div>
  );
}

function BarraDaCarteira({ resumo, fina = false }) {
  const total = Math.max(1, resumo.critico + resumo.atencao + resumo.ok);
  return (
    <div className={`flex w-full gap-1 overflow-hidden rounded-full ${fina ? "h-1.5" : "h-2.5"}`}>
      <span className="rounded-full bg-[#d8493a]" style={{ width: `${(resumo.critico / total) * 100}%` }} />
      <span className="rounded-full bg-[#d99a2b]" style={{ width: `${(resumo.atencao / total) * 100}%` }} />
      <span className="rounded-full bg-[#1d9e75]" style={{ width: `${(resumo.ok / total) * 100}%` }} />
    </div>
  );
}

// Mini gráfico de colunas feito de ladrilhos — o B.I. na linguagem da marca:
// um ano de meses subindo, os dois últimos no laranja.
function ColunasDeLadrilho() {
  const alturas = [3, 4, 3, 5, 4, 6, 5, 5, 6, 7, 6, 8];
  return (
    <div className="flex items-end gap-[5px]" aria-hidden="true">
      {alturas.map((altura, coluna) => {
        const destaque = coluna >= alturas.length - 2;
        return (
          <div key={coluna} className="flex flex-col-reverse gap-[5px]">
            {Array.from({ length: altura }, (_, i) => (
              <span
                key={i}
                className="block h-[15px] w-[15px] rounded-[4px] sm:h-[18px] sm:w-[18px] sm:rounded-[5px]"
                style={{ background: destaque ? `rgba(232,105,31,${0.4 + (i / altura) * 0.6})` : `color-mix(in srgb, var(--hub-texto) ${7 + (i / altura) * 10}%, transparent)` }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function HubInicio() {
  const state = useAppState();
  const navigate = useNavigate();
  const { abrir, irPara, abrirBusca } = useOutletContext();
  const staff = Boolean(state.isAdmin || state.isColaborador);
  const nome = primeiroNome(state.nomeUsuario);

  const [carteira, setCarteira] = useState(null);
  useEffect(() => {
    if (!state.isAdmin || !state.companies.length) return undefined;
    const timer = setTimeout(() => {
      try {
        setCarteira(resumoCarteira(state.companies));
      } catch (error) {
        console.warn("Hub: resumo da carteira falhou", error);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [state.isAdmin, state.companies]);

  const abertas = useMemo(
    () =>
      recentes()
        .map((item) => {
          const registro = item.tipo === "grupo" ? state.groups.find((group) => group.id === item.id) : state.companies.find((company) => company.id === item.id);
          return registro ? { ...item, nome: registro.name } : null;
        })
        .filter(Boolean)
        .slice(0, 6),
    [state.companies, state.groups]
  );
  const suasEmpresas = useMemo(() => (staff ? [] : state.companies.map((company) => ({ tipo: "empresa", id: company.id, nome: company.name }))), [staff, state.companies]);
  const continuar = staff ? abertas : suasEmpresas;
  const andamento = andamentoDaReforma();
  const areas = AREAS_DO_HUB.filter((area) => area.id !== "inicio");
  const [bi, tributario, ...embreve] = areas;

  return (
    <>
      {/* ── Abertura ── */}
      <section className="mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.08fr_1fr] lg:gap-10 lg:pb-24 lg:pt-14">
        <div className="relative z-10">
          <Revelar className="flex flex-wrap items-center gap-3">
            <span className="hub-selo hub-selo-vivo">
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> Prévia do novo portal
            </span>
            <span className="text-[13px] font-medium text-[var(--hub-texto-3)]">{hojePorExtenso()}</span>
          </Revelar>
          <Revelar atraso={0.05}>
            <p className="mt-7 text-[18px] font-semibold text-[var(--hub-texto-2)]">
              {saudacao()}
              {nome ? `, ${nome}` : ""}.
            </p>
          </Revelar>
          <Revelar atraso={0.1}>
            <h1 className="hub-display mt-2 text-[44px] font-extrabold leading-[1.02] sm:text-[60px] xl:text-[72px]">
              Sua empresa, <span className="hub-italico">inteira</span>
              <span className="hub-pontuacao">,</span> em um só lugar.
            </h1>
          </Revelar>
          <Revelar atraso={0.16}>
            <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Os números fechados pelo escritório, a Reforma Tributária explicada e, em breve, prazos, guias e conteúdos da equipe Athos.</p>
          </Revelar>
          <Revelar atraso={0.22} className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => irPara(bi)} className="hub-botao hub-botao-primario">
              Abrir meu B.I. <ArrowRight size={17} />
            </button>
            <button type="button" onClick={() => navigate("/hub/tributario")} className="hub-botao hub-botao-fantasma">
              Entender a Reforma
            </button>
          </Revelar>
          {staff && (
            <Revelar atraso={0.28}>
              <button type="button" onClick={abrirBusca} className="mt-8 flex h-14 w-full max-w-[540px] items-center gap-3 rounded-2xl border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] px-4 text-left text-[15px] text-[var(--hub-texto-3)] shadow-[var(--hub-sombra)] backdrop-blur transition-colors hover:border-[var(--hub-acento)]">
                <Search size={18} />
                <span className="flex-1">Abrir empresa ou grupo — nome, código ou CNPJ</span>
                <kbd className="rounded-md border border-[var(--hub-borda-forte)] px-1.5 text-[11px]">/</kbd>
              </button>
            </Revelar>
          )}
          <Revelar atraso={0.34} className="mt-10 grid max-w-[540px] grid-cols-3 gap-6">
            {staff ? (
              <>
                <Numero valor={state.companies.length} rotulo={state.companies.length === 1 ? "empresa na carteira" : "empresas na carteira"} />
                <Numero valor={state.groups.length} rotulo={state.groups.length === 1 ? "grupo" : "grupos"} />
                {carteira && <Numero valor={carteira.ok} rotulo="com tudo em dia" />}
              </>
            ) : (
              <Numero valor={state.companies.length} rotulo={state.companies.length === 1 ? "empresa acompanhada" : "empresas acompanhadas"} />
            )}
          </Revelar>
        </div>

        <Revelar atraso={0.12} className="relative mx-auto w-full max-w-[560px]">
          <div className="absolute -inset-10 rounded-full opacity-70 blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.22), transparent 60%)" }} />
          <Mosaico className="relative" icones={{ "0-3": BarChart3, "1-5": Scale, "3-1": CalendarClock, "4-2": BookOpen }} />
          {carteira ? (
            <Flutuante className="-left-4 top-[6%] w-[230px] sm:-left-10" atraso={0}>
              <p className="hub-rotulo !text-[10px]">Carteira hoje</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="hub-display text-[24px] font-bold leading-none">{carteira.ok}</span>
                <span className="text-[13px] font-semibold text-[var(--hub-texto-3)]">de {carteira.total} em dia</span>
              </p>
              <div className="mt-3">
                <BarraDaCarteira resumo={carteira} fina />
              </div>
            </Flutuante>
          ) : (
            <Flutuante className="-left-4 top-[6%] w-[220px] sm:-left-10" atraso={0}>
              <p className="hub-rotulo !text-[10px]">{staff ? "Carteira" : "Acompanhando"}</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="hub-display text-[24px] font-bold leading-none">{state.companies.length}</span>
                <span className="text-[13px] font-semibold text-[var(--hub-texto-3)]">{state.companies.length === 1 ? "empresa" : "empresas"}</span>
              </p>
            </Flutuante>
          )}
          <Flutuante className="-right-3 top-[44%] w-[250px] sm:-right-8" atraso={1.4} onClick={() => navigate("/hub/tributario")}>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--hub-acento)]">
              <Scale size={13} /> Reforma Tributária
            </p>
            <p className="mt-1.5 text-[14px] font-bold leading-snug">{LINHA_DA_REFORMA[0].ano}: {LINHA_DA_REFORMA[0].titulo.toLowerCase()}</p>
            <p className="mt-1 text-[12px] leading-snug text-[var(--hub-texto-3)]">CBS e IBS já aparecem na nota fiscal.</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--hub-borda)]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#e8691f] to-[#f4a96f]" style={{ width: `${Math.max(4, andamento * 100)}%` }} />
            </div>
          </Flutuante>
          {continuar[0] && (
            <Flutuante className="-bottom-6 left-[8%] w-[260px]" atraso={2.6} onClick={() => abrir(continuar[0])}>
              <p className="hub-rotulo !text-[10px]">{staff ? "Continue de onde parou" : "Sua empresa"}</p>
              <span className="mt-2.5 flex items-center gap-3">
                <Avatar name={continuar[0].nome} size={34} className="rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{continuar[0].nome}</span>
                  <span className="block text-[12px] text-[var(--hub-texto-3)]">{continuar[0].at ? `aberta ${haQuanto(continuar[0].at)}` : "abrir o B.I."}</span>
                </span>
                <ArrowRight size={16} className="text-[var(--hub-acento)]" />
              </span>
            </Flutuante>
          )}
        </Revelar>
      </section>

      {/* ── Faixa que corre ── */}
      <div className="hub-faixa overflow-hidden border-y border-[var(--hub-borda)] py-5">
        <div className="hub-faixa-trilho flex w-max gap-10">
          {[...FAIXA, ...FAIXA].map((palavra, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap text-[15px] font-semibold text-[var(--hub-texto-3)]">
              {palavra}
              <span className="h-2 w-2 rounded-[3px] bg-[var(--hub-acento)] opacity-70" />
            </span>
          ))}
        </div>
      </div>

      {/* ── Áreas ── */}
      <Secao className="mt-24" rotulo="O que tem aqui" titulo="Tudo o que a sua empresa precisa," italico="organizado" depois=".">
        <div className="grid gap-5 md:grid-cols-6">
          <Revelar className="md:col-span-4 md:row-span-2">
            <button type="button" onClick={() => irPara(bi)} onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex h-full w-full flex-col justify-between gap-10 p-7 text-left sm:flex-row sm:items-end sm:p-9">
              <div className="flex flex-col gap-10 self-stretch sm:justify-between">
                <div>
                  <span className="hub-selo hub-selo-vivo">Disponível</span>
                  <h3 className="hub-display mt-5 text-[30px] font-bold leading-tight sm:text-[38px]">{bi.nome}</h3>
                  <p className="mt-3 max-w-sm text-[15.5px] leading-relaxed text-[var(--hub-texto-2)]">{bi.resumo}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-[14.5px] font-bold text-[var(--hub-acento)]">
                  Abrir o B.I. <ArrowRight size={16} />
                </span>
              </div>
              <ColunasDeLadrilho />
            </button>
          </Revelar>
          <Revelar atraso={0.08} className="md:col-span-2 md:row-span-2">
            <button type="button" onClick={() => navigate(tributario.rota)} onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex h-full w-full flex-col gap-6 p-7 text-left">
              <div className="flex items-start justify-between">
                <span className="hub-selo hub-selo-vivo">Disponível</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
                  <Scale size={22} />
                </span>
              </div>
              <div>
                <h3 className="hub-display text-[26px] font-bold leading-tight">{tributario.nome}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">{tributario.resumo}</p>
              </div>
              <ol className="relative mt-auto space-y-3 border-l border-[var(--hub-borda-forte)] pl-5">
                {LINHA_DA_REFORMA.map((marco, i) => (
                  <li key={marco.ano} className="relative">
                    <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-[3px] ${i === 0 ? "bg-[var(--hub-acento)] shadow-[0_0_0_4px_var(--hub-acento-suave)]" : "bg-[var(--hub-borda-forte)]"}`} />
                    <p className="text-[12px] font-bold text-[var(--hub-texto-3)]">{marco.ano}</p>
                    <p className="text-[13.5px] font-semibold">{marco.titulo}</p>
                  </li>
                ))}
              </ol>
            </button>
          </Revelar>
          {embreve.map((area, i) => {
            const Icone = ICONE_DA_AREA[area.id] || Sparkles;
            return (
              <Revelar key={area.id} atraso={0.12 + i * 0.06} className="md:col-span-2">
                <button type="button" onClick={() => navigate(area.rota)} onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex h-full w-full flex-col gap-5 p-7 text-left">
                  <div className="flex items-start justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] text-[var(--hub-texto-2)]">
                      <Icone size={20} />
                    </span>
                    <span className="hub-selo">Em breve</span>
                  </div>
                  <div>
                    <h3 className="hub-display text-[22px] font-bold">{area.nome}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--hub-texto-2)]">{area.resumo}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--hub-texto-3)]">
                    Ver o que vem aí <ArrowUpRight size={15} />
                  </span>
                </button>
              </Revelar>
            );
          })}
        </div>
      </Secao>

      {/* ── Continue de onde parou ── */}
      {continuar.length > 0 && (
        <Secao className="mt-28" rotulo={staff ? "Abertas por último" : "Suas empresas"} titulo={staff ? "Continue de onde" : "O B.I. de cada"} italico={staff ? "parou" : "empresa"} depois=".">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continuar.map((item, i) => (
              <Revelar key={`${item.tipo}:${item.id}`} atraso={i * 0.05}>
                <button type="button" onClick={() => abrir(item)} onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex w-full items-center gap-4 p-5 text-left">
                  <Avatar name={item.nome} size={46} className="rounded-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-bold">{item.nome}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--hub-texto-3)]">
                      {item.tipo === "grupo" ? <Network size={13} /> : <Clock size={13} />}
                      {item.tipo === "grupo" ? "Grupo" : "Empresa"}
                      {item.at ? ` · aberta ${haQuanto(item.at)}` : ""}
                    </span>
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--hub-borda)] text-[var(--hub-acento)]">
                    <ArrowRight size={17} />
                  </span>
                </button>
              </Revelar>
            ))}
          </div>
        </Secao>
      )}

      {/* ── Carteira (admin) ── */}
      {carteira && (
        <Secao
          className="mt-28"
          rotulo="Situação da carteira"
          titulo="Quem está em dia e quem"
          italico="precisa de atenção"
          depois="."
          acao={
            <button type="button" onClick={() => navigate("/carteira")} className="hub-botao hub-botao-fantasma">
              Ver a carteira <ArrowRight size={16} />
            </button>
          }
        >
          <Revelar>
            <div className="hub-cartao p-7 sm:p-9">
              <BarraDaCarteira resumo={carteira} />
              <div className="mt-8 grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["#d8493a", carteira.critico, "críticas"],
                  ["#d99a2b", carteira.atencao, "em atenção"],
                  ["#1d9e75", carteira.ok, "em dia"],
                  [null, carteira.atrasadas, "com dados atrasados"],
                  [null, carteira.depara, "com De/Para pendente"],
                ].map(([cor, valor, rotulo]) => (
                  <div key={rotulo} className="flex items-start gap-3">
                    {cor && <span className="mt-2 h-3 w-3 shrink-0 rounded-[4px]" style={{ background: cor }} />}
                    <div>
                      <p className="hub-display text-[38px] font-bold leading-none">{valor}</p>
                      <p className="mt-1.5 text-[13px] text-[var(--hub-texto-3)]">{rotulo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Revelar>
        </Secao>
      )}

      {/* ── Reforma: a linha do tempo ── */}
      <Secao
        className="mt-28"
        rotulo="Reforma Tributária"
        titulo="O que muda,"
        italico="e quando"
        depois="."
        acao={
          <button type="button" onClick={() => navigate("/reforma")} className="hub-botao hub-botao-primario">
            Abrir o simulador <ArrowRight size={16} />
          </button>
        }
      >
        <Revelar>
          <LinhaDaReforma />
        </Revelar>
      </Secao>

      {/* ── Fecho ── */}
      <section className="mx-auto mt-28 max-w-[1320px] px-5 sm:px-8">
        <Revelar>
          <div className="relative overflow-hidden rounded-[32px] bg-[#081d33] px-7 py-14 text-white sm:px-14">
            <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(600px circle at 90% 120%, rgba(232,105,31,0.45), transparent 60%), radial-gradient(500px circle at 0% -20%, rgba(47,111,237,0.35), transparent 60%)" }} />
            <Mosaico colunas={5} linhas={4} degraus={3} className="pointer-events-none absolute -right-6 bottom-[-20px] hidden w-[300px] opacity-50 md:block" />
            <div className="relative max-w-xl">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">O começo</p>
              <h2 className="hub-display mt-3 text-[32px] font-bold leading-[1.08] sm:text-[42px]">
                Um portal que <span className="hub-italico">cresce</span> com a sua empresa.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-white/70">Cada área nova aparece aqui primeiro. As próximas são Serviços, Conteúdos e Ferramentas.</p>
            </div>
          </div>
        </Revelar>
      </section>
    </>
  );
}
