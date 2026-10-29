import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "./hub.css";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Building2, Check, ChevronDown, CornerDownLeft, LayoutGrid, LogOut, Menu, Moon, Network, Search, Sun, Wrench, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { setData, useAppState } from "../data/useStore.js";
import { useTheme } from "../lib/theme.js";
import { AREAS_DO_HUB, preferirPortalAtual } from "../lib/hub.js";
import { entrarNoModo, realStaff, sairDosModos } from "../lib/modoEquipe.js";
import { moduloDaRota } from "../lib/modulos.js";
import { selectCompany } from "../lib/companies.js";
import { groupCompanies, selectGroup } from "../lib/groups.js";
import { grupoDoContexto, grupoLembrado, lembrarGrupoContexto, unidadesDaCarteira } from "../lib/unidades.js";
import { primeiroNome } from "../lib/inicio.js";
import { useAbrirWorkspace } from "../lib/useAbrirWorkspace.js";
import AthosMark from "../components/AthosMark.jsx";
import Avatar from "../components/Avatar.jsx";
import WorkspaceLoading from "../components/WorkspaceLoading.jsx";
import Carregando from "../components/Carregando.jsx";
import SeletorDeEmpresa from "../components/SeletorDeEmpresa.jsx";
import { recentes } from "../lib/recentes.js";

const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Marca({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-2.5" aria-label="Início do hub">
      <AthosMark size={30} className="transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="hub-display text-[19px] font-bold text-[var(--hub-texto)]">
        Athos<span className="ml-1 align-top text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--hub-acento)]">hub</span>
      </span>
    </button>
  );
}

function BotaoTema({ className = "" }) {
  const [tema, alternar] = useTheme();
  const escuro = tema === "dark";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Usar o tema claro" : "Usar o tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className={`h-10 w-10 items-center justify-center rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] text-[var(--hub-texto-2)] transition-colors hover:text-[var(--hub-texto)] ${className || "flex"}`}
    >
      {escuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function MenuDaConta({ state, onPortalAtual }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const staff = realStaff(state);
  const nome = state.nomeUsuario || state.userEmail || "";
  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] py-1 pl-1 pr-2.5 transition-colors hover:border-[var(--hub-borda-forte)]">
        <Avatar name={nome} size={30} className="rounded-full" />
        <span className="hidden max-w-[120px] truncate text-[13px] font-semibold text-[var(--hub-texto)] lg:block">{primeiroNome(state.nomeUsuario) || "Minha conta"}</span>
        <ChevronDown size={14} className={`text-[var(--hub-texto-3)] transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] p-1.5 shadow-[var(--hub-sombra-forte)]">
            <div className="px-3 pb-2.5 pt-2">
              <p className="truncate text-[13.5px] font-semibold text-[var(--hub-texto)]">{state.nomeUsuario || "Minha conta"}</p>
              <p className="truncate text-[12px] text-[var(--hub-texto-3)]">{state.userEmail}</p>
            </div>
            <div className="my-1 h-px bg-[var(--hub-borda)]" />
            <button type="button" onClick={onPortalAtual} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[var(--hub-texto-2)] hover:bg-[var(--hub-acento-suave)] hover:text-[var(--hub-texto)]">
              <LayoutGrid size={15} /> Voltar ao portal atual
            </button>
            {staff && (
              <button type="button" onClick={() => navigate("/equipe")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[var(--hub-texto-2)] hover:bg-[var(--hub-acento-suave)] hover:text-[var(--hub-texto)]">
                <Wrench size={15} /> Console da equipe
              </button>
            )}
            <button type="button" onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[var(--hub-texto-2)] hover:bg-[var(--hub-acento-suave)] hover:text-[var(--hub-texto)]">
              <LogOut size={15} /> Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Busca rápida (/ ou Ctrl+K): áreas do hub e, pra equipe, empresas e grupos.
function BuscaRapida({ aberta, onFechar, itensDoHub, state, onAbrir }) {
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState(0);
  const campo = useRef(null);
  const staff = realStaff(state);

  useEffect(() => {
    if (!aberta) return;
    setTermo("");
    setIndice(0);
    const t = setTimeout(() => campo.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [aberta]);

  const resultados = useMemo(() => {
    const busca = norm(termo.trim());
    const areas = itensDoHub.filter((item) => !busca || norm(`${item.nome} ${item.resumo || ""}`).includes(busca)).map((item) => ({ ...item, tipo: "area" }));
    if (!busca) return areas;
    const grupos = state.groups.filter((group) => norm(group.name).includes(busca)).map((group) => ({ tipo: "grupo", id: group.id, nome: group.name, detalhe: `Grupo · ${(group.companyIds || []).length} empresas` }));
    const empresas = state.companies
      .filter((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(busca))
      .map((company) => ({ tipo: "empresa", id: company.id, nome: company.name, detalhe: [company.codigo, company.cnpj].filter(Boolean).join(" · ") }));
    return [...areas, ...(staff || state.companies.length > 1 ? [...grupos, ...empresas] : [])].slice(0, 9);
  }, [termo, itensDoHub, state.groups, state.companies, staff]);

  if (!aberta) return null;
  const escolher = (item) => {
    onFechar();
    onAbrir(item);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#030712]/45 px-4 pt-[12vh] backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] shadow-[var(--hub-sombra-forte)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--hub-borda)] px-5">
          <Search size={18} className="text-[var(--hub-texto-3)]" />
          <input
            ref={campo}
            value={termo}
            onChange={(event) => {
              setTermo(event.target.value);
              setIndice(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onFechar();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndice((i) => Math.min(resultados.length - 1, i + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndice((i) => Math.max(0, i - 1));
              }
              if (event.key === "Enter" && resultados[indice]) escolher(resultados[indice]);
            }}
            placeholder={staff ? "Buscar empresa, grupo ou área do hub…" : "Para onde você quer ir?"}
            className="h-16 flex-1 bg-transparent text-[16px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)]"
          />
          <kbd className="rounded-md border border-[var(--hub-borda-forte)] px-1.5 py-0.5 text-[11px] text-[var(--hub-texto-3)]">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {resultados.length === 0 && <p className="px-4 py-6 text-center text-[13.5px] text-[var(--hub-texto-3)]">Nada encontrado para "{termo.trim()}".</p>}
          {resultados.map((item, i) => (
            <button
              key={`${item.tipo}:${item.id}`}
              type="button"
              onMouseEnter={() => setIndice(i)}
              onClick={() => escolher(item)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${i === indice ? "bg-[var(--hub-acento-suave)]" : ""}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] text-[var(--hub-acento)]">
                {item.tipo === "area" ? <LayoutGrid size={16} /> : item.tipo === "grupo" ? <Network size={16} /> : <Building2 size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-[var(--hub-texto)]">{item.nome}</span>
                <span className="block truncate text-[12px] text-[var(--hub-texto-3)]">{item.tipo === "area" ? item.resumo || (item.id === "inicio" ? "Página inicial do hub" : "Área do hub") : item.detalhe}</span>
              </span>
              {i === indice && <CornerDownLeft size={15} className="shrink-0 text-[var(--hub-texto-3)]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Rodape({ irPara }) {
  const ano = new Date().getFullYear();
  return (
    <footer className="relative mt-24 border-t border-[var(--hub-borda)]">
      <div className="mx-auto grid hub-largura gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <AthosMark size={28} />
            <span className="hub-display text-[18px] font-bold">Athos</span>
          </div>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--hub-texto-3)]">Contabilidade, números e impostos da sua empresa explicados de um jeito simples, com a equipe da Athos Consultoria Empresarial do seu lado.</p>
        </div>
        <div>
          <p className="hub-rotulo">No hub</p>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            {AREAS_DO_HUB.filter((area) => area.id !== "inicio").map((area) => (
              <li key={area.id}>
                <button type="button" onClick={() => irPara(area)} className="text-[var(--hub-texto-2)] transition-colors hover:text-[var(--hub-acento)]">
                  {area.nome}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="hub-rotulo">Escritório</p>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            <li>
              <a href="https://athosconsultoriaempresarial.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--hub-texto-2)] transition-colors hover:text-[var(--hub-acento)]">
                athosconsultoriaempresarial.com <ArrowUpRight size={13} />
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--hub-borda)]">
        <div className="mx-auto flex hub-largura flex-wrap items-center justify-between gap-2 px-5 py-5 text-[12.5px] text-[var(--hub-texto-3)] sm:px-8">
          <span>© {ano} Athos Consultoria Empresarial</span>
          <span>Prévia do novo portal · visível só para você no ambiente de teste</span>
        </div>
      </div>
    </footer>
  );
}

// Empresa/grupo do momento, no menu principal (pedido do Izaias, 29/10/2026:
// trocar aqui, não dentro do B.I.). Num grupo: o consolidado e cada empresa;
// e "outra empresa ou grupo" abre a janela de escolha.
function TrocaDeEmpresa({ state, onTrocar, onOutra }) {
  const [aberto, setAberto] = useState(false);
  const staff = Boolean(state.isAdmin || state.isColaborador || realStaff(state));
  const visiveis = useMemo(() => unidadesDaCarteira(state.companies, state.groups, { soCompletos: !staff }).grupos.map((unidade) => unidade.grupo), [state.companies, state.groups, staff]);
  const grupoAberto = state.activeGroupId ? state.groups.find((group) => group.id === state.activeGroupId) : null;
  const empresaAberta = !grupoAberto && state.activeCompanyId ? state.companies.find((company) => company.id === state.activeCompanyId) : null;
  const grupo = grupoDoContexto(state, { lembrado: grupoLembrado(), recentes: recentes(), visiveis });
  const membros = grupo ? groupCompanies(grupo) : [];
  const nome = grupoAberto?.name || empresaAberta?.name || "";
  // Cliente com uma empresa só e sem grupo: não há o que trocar.
  if (!staff && state.companies.length <= 1 && !grupo) return null;
  const clicar = () => (grupo && membros.length ? setAberto((v) => !v) : onOutra());
  const escolher = (item) => {
    setAberto(false);
    onTrocar(item, grupo?.id);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={clicar}
        aria-label="Empresa ou grupo"
        aria-expanded={aberto}
        title="Trocar de empresa ou grupo"
        className="flex h-10 max-w-[240px] items-center gap-2.5 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] py-1 pl-1 pr-3 text-left transition-colors hover:border-[var(--hub-borda-forte)]"
      >
        {grupoAberto ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white">
            <Network size={15} />
          </span>
        ) : nome ? (
          <Avatar name={nome} size={32} className="rounded-full" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--hub-borda-forte)] text-[var(--hub-texto-3)]">
            <Building2 size={15} />
          </span>
        )}
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--hub-texto-3)]">{grupo ? (grupoAberto ? "Consolidado" : grupo.name) : nome ? "Empresa" : "Nenhuma aberta"}</span>
          <span className="block truncate text-[13px] font-semibold leading-tight text-[var(--hub-texto)]">{nome || "Escolher empresa"}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[var(--hub-texto-3)] transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-80 overflow-hidden rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] p-1.5 shadow-[var(--hub-sombra-forte)]" role="menu" aria-label="Trocar de empresa ou grupo">
            <p className="truncate px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hub-texto-3)]">{/^grupo\b/i.test(grupo.name) ? grupo.name : `Grupo ${grupo.name}`}</p>
            <button type="button" role="menuitem" onClick={() => escolher({ tipo: "grupo", id: grupo.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--hub-acento-suave)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white">
                <Network size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-[var(--hub-texto)]">Consolidado</span>
                <span className="block text-[11.5px] text-[var(--hub-texto-3)]">As {membros.length} empresas somadas</span>
              </span>
              {grupoAberto?.id === grupo.id && <Check size={15} className="shrink-0 text-[var(--hub-acento)]" />}
            </button>
            {membros.map((company) => (
              <button key={company.id} type="button" role="menuitem" onClick={() => escolher({ tipo: "empresa", id: company.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left hover:bg-[var(--hub-acento-suave)]">
                <Avatar name={company.name} size={30} className="rounded-lg" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--hub-texto)]">{company.name}</span>
                {!grupoAberto && empresaAberta?.id === company.id && <Check size={15} className="shrink-0 text-[var(--hub-acento)]" />}
              </button>
            ))}
            <div className="my-1.5 h-px bg-[var(--hub-borda)]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                onOutra();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[var(--hub-texto-2)] hover:bg-[var(--hub-acento-suave)] hover:text-[var(--hub-texto)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--hub-borda)]">
                <Search size={14} />
              </span>
              Outra empresa ou grupo…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Telas do B.I. que existem pra empresa e pro grupo: trocar fica nelas; o resto volta pro painel.
const TELAS_EM_COMUM = ["/empresa/demonstrativos", "/empresa/dfc"];

// O hub e o B.I. na mesma casca (pedido do Izaias, 29/10/2026): o B.I. abre
// aqui mesmo — o menu do topo do hub recolhe (com transição) e a setinha no
// topo do B.I. traz ele de volta. Só pra quem tem o hub (ver App.jsx).
export default function HubLayout() {
  const state = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [busca, setBusca] = useState(false);
  const [menuMovel, setMenuMovel] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [seletor, setSeletor] = useState(null); // null | "abrir" (Meu B.I.) | "trocar" (menu principal)
  const [animando, setAnimando] = useState(false);
  const { pending, abrirEmpresa, abrirGrupo, cancelar } = useAbrirWorkspace();
  const naBi = location.pathname.startsWith("/empresa");
  const modulo = moduloDaRota(location.pathname);
  const mostrarTopo = !naBi || state.topoDoHubAberto;

  // As páginas do hub são o portal: a equipe vê cada empresa/grupo como o
  // cliente vê (lib/modoEquipe.js) — antes de pintar. No B.I. fica o modo em
  // que se chegou (do console, editando).
  useLayoutEffect(() => {
    if (naBi) return;
    preferirPortalAtual(false);
    entrarNoModo("portal");
  }, [naBi]);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  // Cada troca de tela fecha o menu (no B.I., recolhe o topo do hub).
  useEffect(() => {
    setMenuMovel(false);
    if (naBi) setData({ topoDoHubAberto: false });
    else window.scrollTo({ top: 0 });
  }, [location.pathname, naBi]);

  // Entrar/sair do B.I.: do topo da página.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [naBi]);

  // Enquanto o topo abre/fecha, o conteúdo dele fica cortado; depois, os menus dele podem sair pra fora.
  const mostrouAntes = useRef(mostrarTopo);
  useEffect(() => {
    if (mostrouAntes.current === mostrarTopo) return undefined;
    mostrouAntes.current = mostrarTopo;
    setAnimando(true);
    const t = setTimeout(() => setAnimando(false), 560);
    return () => clearTimeout(t);
  }, [mostrarTopo]);

  useEffect(() => {
    function tecla(event) {
      const tag = document.activeElement?.tagName;
      const digitando = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setBusca(true);
      } else if (event.key === "/" && !naBi && !digitando && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setBusca(true);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [naBi]);

  // "Meu B.I.": direto na empresa/grupo aberta por último (ou na única do
  // cliente), sem página no meio; sem nenhuma, a janela de escolha.
  const abrirMeuBi = () => {
    const existe = (item) => (item.tipo === "grupo" ? state.groups.some((group) => group.id === item.id) : state.companies.some((company) => company.id === item.id));
    const staff = realStaff(state);
    const ativoAgora = state.activeGroupId ? { tipo: "grupo", id: state.activeGroupId } : state.activeCompanyId ? { tipo: "empresa", id: state.activeCompanyId } : null;
    const alvo = (ativoAgora && existe(ativoAgora) ? ativoAgora : null) || recentes().find(existe) || (!staff && state.companies.length === 1 ? { tipo: "empresa", id: state.companies[0].id } : null);
    if (!alvo) {
      setSeletor("abrir");
      return;
    }
    const jaAberto = alvo.tipo === "grupo" ? state.activeGroupId === alvo.id : !state.activeGroupId && state.activeCompanyId === alvo.id;
    if (jaAberto && !state.journalLoading && !state.journalLoadFailed && (state.accounts.length > 0 || state.journal.length > 0)) navigate("/empresa");
    else abrir(alvo);
  };
  const irPara = (area) => {
    if (area.id === "bi") abrirMeuBi();
    else if (area.rota) navigate(area.rota);
  };
  const abrir = (item, destino) => {
    if (item.tipo === "grupo") abrirGrupo(item.id, destino);
    else if (item.tipo === "empresa") abrirEmpresa(item.id, destino);
    else irPara(item);
  };
  // Trocar pelo menu principal: no B.I., reabre nele (mesma tela quando dá);
  // nas páginas do hub, só passa a ser a empresa/grupo do momento.
  const trocar = (item, grupoId) => {
    if (item.tipo === "grupo") lembrarGrupoContexto(item.id);
    else if (grupoId) lembrarGrupoContexto(grupoId);
    if (naBi) {
      const p = location.pathname;
      abrir(item, TELAS_EM_COMUM.find((tela) => p.startsWith(tela)) || (modulo ? p : "/empresa"));
    } else if (item.tipo === "grupo") selectGroup(item.id).catch((error) => console.error("Falha ao abrir o grupo:", error));
    else selectCompany(item.id).catch((error) => console.error("Falha ao abrir a empresa:", error));
  };
  const portalAtual = () => {
    sairDosModos();
    preferirPortalAtual(true);
    navigate("/");
  };
  const ativo = (area) => {
    if (area.id === "inicio") return location.pathname === "/hub";
    if (area.id === "bi") return naBi && !modulo;
    if (area.id === "ferramentas") return location.pathname.startsWith("/hub/ferramentas") || (naBi && Boolean(modulo));
    return Boolean(area.rota) && location.pathname.startsWith(area.rota);
  };
  const Conteudo = naBi ? "div" : "main";

  return (
    <div className={naBi ? "" : "hub relative min-h-screen overflow-x-clip"}>
      {!naBi && (
        <>
          <div className="hub-fundo-decor pointer-events-none absolute inset-x-0 top-0 h-[900px]" />
          <div className="hub-fundo-grade pointer-events-none absolute inset-x-0 top-0 h-[700px]" />
        </>
      )}

      <div className={`${naBi ? "relative" : "sticky top-0"} z-40`}>
        <div className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" style={{ gridTemplateRows: mostrarTopo ? "1fr" : "0fr" }}>
          <div className={`min-h-0 ${!mostrarTopo || animando ? "overflow-hidden" : ""}`} inert={!mostrarTopo}>
            <header className={`relative transition-[background-color,box-shadow,border-color] duration-300 ${naBi ? "hub border-b border-[var(--hub-borda)]" : rolou ? "hub-topo border-b border-[var(--hub-borda)]" : "border-b border-transparent"}`}>
              <div className="mx-auto flex h-[72px] hub-largura items-center gap-4 px-5 sm:px-8">
                <Marca onClick={() => navigate("/hub")} />
                <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Áreas do hub">
                  {AREAS_DO_HUB.map((area) => (
                    <button key={area.id} type="button" onClick={() => irPara(area)} className="hub-menu-item" aria-current={ativo(area) ? "page" : undefined}>
                      {area.nome}
                      {!area.rota && !naBi && <ArrowUpRight size={13} className="ml-1 opacity-60" />}
                    </button>
                  ))}
                </nav>
                <div className="ml-auto flex items-center gap-2">
                  <div className="hidden md:block">
                    <TrocaDeEmpresa state={state} onTrocar={trocar} onOutra={() => setSeletor("trocar")} />
                  </div>
                  <button type="button" onClick={() => setBusca(true)} aria-label="Buscar" title="Buscar (Ctrl+K)" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] text-[var(--hub-texto-2)] transition-colors hover:border-[var(--hub-borda-forte)] hover:text-[var(--hub-texto)]">
                    <Search size={17} />
                  </button>
                  <BotaoTema className="hidden sm:flex" />
                  <div className="hidden sm:block">
                    <MenuDaConta state={state} onPortalAtual={portalAtual} />
                  </div>
                  <button type="button" onClick={() => setMenuMovel(true)} aria-label="Abrir o menu" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] text-[var(--hub-texto)] lg:hidden">
                    <Menu size={18} />
                  </button>
                </div>
              </div>
            </header>
          </div>
        </div>
      </div>

      {menuMovel && (
        <div className="fixed inset-0 z-[55] bg-[#030712]/50 backdrop-blur-sm lg:hidden" onClick={() => setMenuMovel(false)}>
          <div className="hub absolute inset-y-0 right-0 flex w-[min(86vw,360px)] flex-col gap-1 overflow-y-auto border-l border-[var(--hub-borda)] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <Marca onClick={() => navigate("/hub")} />
              <button type="button" onClick={() => setMenuMovel(false)} aria-label="Fechar o menu" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hub-borda)]">
                <X size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuMovel(false);
                setSeletor("trocar");
              }}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-[var(--hub-borda)] px-4 py-3 text-left"
            >
              <Building2 size={17} className="shrink-0 text-[var(--hub-acento)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hub-texto-3)]">Empresa ou grupo</span>
                <span className="block truncate text-[14.5px] font-semibold">{(state.activeGroupId ? state.groups.find((group) => group.id === state.activeGroupId)?.name : state.companies.find((company) => company.id === state.activeCompanyId)?.name) || "Escolher"}</span>
              </span>
              <ChevronDown size={15} className="shrink-0 text-[var(--hub-texto-3)]" />
            </button>
            {AREAS_DO_HUB.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => irPara(area)}
                className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[16px] font-semibold ${ativo(area) ? "bg-[var(--hub-acento-suave)] text-[var(--hub-texto)]" : "text-[var(--hub-texto-2)]"}`}
              >
                {area.nome}
              </button>
            ))}
            <div className="mt-auto space-y-1 border-t border-[var(--hub-borda)] pt-4">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[14px] font-semibold text-[var(--hub-texto-2)]">Tema</span>
                <BotaoTema />
              </div>
              {realStaff(state) && (
                <button type="button" onClick={() => navigate("/equipe")} className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-[14px] font-semibold text-[var(--hub-texto-2)]">
                  <Wrench size={16} /> Console da equipe
                </button>
              )}
              <button type="button" onClick={portalAtual} className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-[14px] font-semibold text-[var(--hub-texto-2)]">
                <LayoutGrid size={16} /> Voltar ao portal atual
              </button>
              <button type="button" onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-[14px] font-semibold text-[var(--hub-texto-2)]">
                <LogOut size={16} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <Conteudo className={naBi ? "" : "relative"}>
        <div key={naBi ? "bi" : "hub"} className="hub-surgir">
          <Suspense fallback={<Carregando />}>
            <Outlet context={{ abrir, irPara, trocar, abrirBusca: () => setBusca(true), escolherEmpresa: () => setSeletor("trocar") }} />
          </Suspense>
        </div>
      </Conteudo>
      {!naBi && <Rodape irPara={irPara} />}

      {/* Janelas: com as cores do hub mesmo dentro do B.I. (display: contents não desenha caixa nenhuma). */}
      <div className="hub contents">
        <BuscaRapida aberta={busca} onFechar={() => setBusca(false)} itensDoHub={AREAS_DO_HUB} state={state} onAbrir={(item) => abrir(item)} />
      </div>
      <SeletorDeEmpresa aberto={Boolean(seletor)} onFechar={() => setSeletor(null)} onEscolher={(item) => (seletor === "trocar" ? trocar(item) : abrir(item))} />
      {pending && <WorkspaceLoading name={pending.name} isGroup={pending.isGroup} phase={pending.phase} progress={state.journalLoadProgress} onCancel={cancelar} />}
    </div>
  );
}
