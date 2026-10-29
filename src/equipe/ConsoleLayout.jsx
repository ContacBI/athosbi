import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "../hub/hub.css";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CornerDownLeft,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Network,
  Repeat,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useAppState } from "../data/useStore.js";
import { useTheme } from "../lib/theme.js";
import { EH_TESTE } from "../lib/ambiente.js";
import { QUEM_VE_O_HUB, hubLigado, preferirPortalAtual } from "../lib/hub.js";
import { entrarNoModo, realStaff } from "../lib/modoEquipe.js";
import { lembrarGrupoContexto } from "../lib/unidades.js";
import { useAbrirWorkspace } from "../lib/useAbrirWorkspace.js";
import { RESET_SECTION_EVENT } from "../components/ParametrosSidebar.jsx";
import AthosMark from "../components/AthosMark.jsx";
import Avatar from "../components/Avatar.jsx";
import Carregando from "../components/Carregando.jsx";
import WorkspaceLoading from "../components/WorkspaceLoading.jsx";

const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// O menu do console. As telas de cadastro são as mesmas de Parâmetros, nos
// mesmos sub-endereços (/parametros/x vira /equipe/x — ver App.jsx).
// `so`: "admin" (Total), "reforma" (escritório da Reforma) ou ninguém.
const MENU = [
  {
    itens: [
      { to: "/equipe", nome: "Visão geral", icone: LayoutDashboard, fim: true },
      { to: "/equipe/clientes", nome: "Grupos e empresas", icone: Network },
      { to: "/equipe/carteira", nome: "Saúde da carteira", icone: HeartPulse },
    ],
  },
  {
    titulo: "Pessoas",
    itens: [
      { to: "/equipe/acessos", nome: "Acessos e convites", icone: ShieldCheck },
      { to: "/equipe/responsaveis", nome: "Responsáveis", icone: UserCheck },
      { to: "/equipe/colaborar", nome: "Equipe", icone: UserCog, so: "admin" },
    ],
  },
  {
    titulo: "Padrões",
    itens: [
      { to: "/equipe/planos-padrao", nome: "Planos padrão", icone: Layers },
      { to: "/equipe/de-para", nome: "De/Para", icone: Repeat },
      { to: "/equipe/bi", nome: "Modelos do B.I.", icone: BarChart3, so: "admin" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { to: "/equipe/empresas", nome: "Empresas", icone: Building2 },
      { to: "/equipe/grupo", nome: "Grupos", icone: Boxes },
      { to: "/equipe/representantes", nome: "Representantes", icone: Users },
      { to: "/equipe/reforma", nome: "Reforma Tributária", icone: Scale, so: "reforma" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { to: "/equipe/central", nome: "Central", icone: Activity, so: "admin" },
      { to: "/equipe/sistema", nome: "Configurações", icone: SlidersHorizontal, so: "admin" },
    ],
  },
];

function menuDe(state) {
  const pode = (item) => !item.so || (item.so === "admin" && state.realIsAdmin) || (item.so === "reforma" && state.isReformaEscritorio);
  return MENU.map((secao) => ({ ...secao, itens: secao.itens.filter(pode) })).filter((secao) => secao.itens.length);
}

function BotaoTema() {
  const [tema, alternar] = useTheme();
  const escuro = tema === "dark";
  return (
    <button type="button" onClick={alternar} aria-label={escuro ? "Usar o tema claro" : "Usar o tema escuro"} title={escuro ? "Tema claro" : "Tema escuro"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hub-borda)] text-[var(--hub-texto-2)] transition-colors hover:text-[var(--hub-texto)]">
      {escuro ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function MenuDoConsole({ state, onIr }) {
  const location = useLocation();
  // Clicar de novo no item aberto: as telas com navegação interna (De/Para,
  // Planos padrão, Responsáveis) voltam pra lista — o mesmo aviso que a barra
  // de Parâmetros manda, no endereço antigo que elas conhecem.
  const clicar = (to) => {
    if (location.pathname === to) window.dispatchEvent(new CustomEvent(RESET_SECTION_EVENT, { detail: { path: to.replace(/^\/equipe/, "/parametros") } }));
    onIr?.();
  };
  return (
    <nav className="flex flex-col gap-5" aria-label="Console da equipe">
      {menuDe(state).map((secao, i) => (
        <div key={secao.titulo || i}>
          {secao.titulo && <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--hub-texto-3)]">{secao.titulo}</p>}
          <div className="flex flex-col gap-0.5">
            {secao.itens.map(({ to, nome, icone: Icone, fim }) => (
              <NavLink key={to} to={to} end={fim} onClick={() => clicar(to)} className="console-item">
                <Icone size={16} strokeWidth={1.9} />
                {nome}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// Busca (Ctrl+K ou /): telas do console, grupos e empresas — o grupo ou a
// empresa abre a ficha dele aqui no console.
function Busca({ aberta, onFechar, state }) {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState(0);
  const campo = useRef(null);
  useEffect(() => {
    if (!aberta) return undefined;
    setTermo("");
    setIndice(0);
    const t = setTimeout(() => campo.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [aberta]);
  const resultados = useMemo(() => {
    const busca = norm(termo.trim());
    const telas = menuDe(state)
      .flatMap((secao) => secao.itens)
      .filter((item) => !busca || norm(item.nome).includes(busca))
      .map((item) => ({ chave: `tela:${item.to}`, nome: item.nome, detalhe: "Tela do console", icone: item.icone, ir: item.to }));
    if (!busca) return telas.slice(0, 8);
    const grupos = state.groups.filter((group) => norm(group.name).includes(busca)).map((group) => ({ chave: `grupo:${group.id}`, nome: group.name, detalhe: `Grupo · ${(group.companyIds || []).length} empresas`, icone: Network, ir: `/equipe/clientes/grupo/${group.id}` }));
    const empresas = state.companies
      .filter((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(busca))
      .map((company) => ({ chave: `empresa:${company.id}`, nome: company.name, detalhe: [company.codigo, company.cnpj].filter(Boolean).join(" · ") || "Empresa", icone: Building2, ir: `/equipe/clientes/empresa/${company.id}` }));
    return [...grupos, ...empresas, ...telas].slice(0, 10);
  }, [termo, state]);
  if (!aberta) return null;
  const escolher = (item) => {
    onFechar();
    navigate(item.ir);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#030712]/45 px-4 pt-[12vh] backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] shadow-[var(--hub-sombra-forte)]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Buscar no console">
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
            placeholder="Grupo, empresa ou tela do console…"
            className="h-16 flex-1 bg-transparent text-[16px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)]"
          />
          <kbd className="rounded-md border border-[var(--hub-borda-forte)] px-1.5 py-0.5 text-[11px] text-[var(--hub-texto-3)]">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {resultados.length === 0 && <p className="px-4 py-6 text-center text-[13.5px] text-[var(--hub-texto-3)]">Nada encontrado para "{termo.trim()}".</p>}
          {resultados.map((item, i) => {
            const Icone = item.icone;
            return (
              <button key={item.chave} type="button" onMouseEnter={() => setIndice(i)} onClick={() => escolher(item)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${i === indice ? "bg-[var(--hub-acento-suave)]" : ""}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] text-[var(--hub-acento)]">
                  <Icone size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[var(--hub-texto)]">{item.nome}</span>
                  <span className="block truncate text-[12px] text-[var(--hub-texto-3)]">{item.detalhe}</span>
                </span>
                {i === indice && <CornerDownLeft size={15} className="shrink-0 text-[var(--hub-texto-3)]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Lateral({ state, onBusca, onIr }) {
  const navigate = useNavigate();
  const nome = state.nomeUsuario || state.userEmail || "";
  return (
    <div className="flex h-full flex-col">
      <button type="button" onClick={() => navigate("/equipe")} className="flex items-center gap-2.5 px-5 pb-5 pt-6 text-left">
        <AthosMark size={30} />
        <span className="hub-display text-[18px] font-bold text-[var(--hub-texto)]">
          Athos
          <span className="ml-1.5 rounded-md bg-[var(--hub-acento-suave)] px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hub-acento)]">Console</span>
        </span>
      </button>
      <div className="px-3">
        <button type="button" onClick={onBusca} className="mb-5 flex h-10 w-full items-center gap-2.5 rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-3 text-[13px] text-[var(--hub-texto-3)] transition-colors hover:border-[var(--hub-borda-forte)]">
          <Search size={15} />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded-md border border-[var(--hub-borda-forte)] px-1.5 text-[11px]">Ctrl K</kbd>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <MenuDoConsole state={state} onIr={onIr} />
      </div>
      <div className="space-y-2 border-t border-[var(--hub-borda)] p-3">
        <button type="button" onClick={() => navigate("/hub")} className="flex w-full items-center justify-between rounded-xl bg-[var(--hub-acento-suave)] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--hub-acento)] transition-colors hover:bg-[var(--hub-acento)] hover:text-white" title="O portal: cada grupo e empresa exatamente como o cliente vê">
          Abrir o portal
          <ArrowUpRight size={15} />
        </button>
        <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1">
          <Avatar name={nome} size={32} className="rounded-full" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[var(--hub-texto)]">{state.nomeUsuario || "Minha conta"}</span>
            <span className="block truncate text-[11.5px] text-[var(--hub-texto-3)]">{state.realIsAdmin ? "Administrador" : "Colaborador"}</span>
          </span>
          <BotaoTema />
          <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sair" title="Sair" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hub-borda)] text-[var(--hub-texto-2)] transition-colors hover:text-[var(--hub-texto)]">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SemAcessoAoConsole({ state }) {
  const navigate = useNavigate();
  const liberado = QUEM_VE_O_HUB.includes(String(state.userEmail || "").toLowerCase());
  return (
    <div className="hub flex min-h-screen items-center justify-center px-5">
      <div className="hub-cartao w-full max-w-[520px] p-8 text-center sm:p-10">
        <AthosMark size={40} className="mx-auto" />
        <h1 className="hub-display mt-6 text-[28px] font-extrabold leading-tight">O console não abriu</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">
          Você entrou como <b className="text-[var(--hub-texto)]">{state.userEmail || "—"}</b>.{" "}
          {liberado ? "Esse e-mail não está como administrador ou colaborador neste banco de teste." : `Por enquanto o console só abre pra ${QUEM_VE_O_HUB.join(" e ")}.`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => supabase.auth.signOut()} className="hub-botao hub-botao-primario">
            Entrar com outro e-mail
          </button>
          <button type="button" onClick={() => navigate("/")} className="hub-botao hub-botao-fantasma">
            Ir para o início
          </button>
        </div>
      </div>
    </div>
  );
}

// Console da equipe (/equipe — pedido do Izaias, 29/10/2026): o back-office,
// separado do produto do cliente. Mesmo login; quem entra por aqui edita
// (lib/modoEquipe.js), quem entra pelo hub vê como o cliente. Só no site de
// teste e só pra quem tem o hub, como o resto do hub.
export default function ConsoleLayout() {
  const state = useAppState();
  const location = useLocation();
  const [busca, setBusca] = useState(false);
  const [menuMovel, setMenuMovel] = useState(false);
  const { pending, abrirEmpresa, abrirGrupo, cancelar } = useAbrirWorkspace();
  const pode = hubLigado(state) && realStaff(state);

  // Antes de pintar: a equipe aqui é a equipe de verdade (com edição) — as
  // telas de cadastro conferem isAdmin logo de cara.
  // Entrar pelo console é escolher o jeito novo — mesmo vindo do "portal atual".
  useLayoutEffect(() => {
    if (!pode) return;
    preferirPortalAtual(false);
    entrarNoModo("console");
  }, [pode, location.pathname]);

  useEffect(() => {
    setMenuMovel(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    function tecla(event) {
      const tag = document.activeElement?.tagName;
      const digitando = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setBusca(true);
      } else if (event.key === "/" && !digitando && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setBusca(true);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // No oficial o console não existe (volta pro início). No teste, em vez de
  // voltar calado, diz por que não abriu — quase sempre é o e-mail logado.
  if (!pode) return EH_TESTE ? <SemAcessoAoConsole state={state} /> : <Navigate to="/" replace />;

  // Abrir no B.I. a partir do console: editando (o modo daqui) ou vendo
  // exatamente como o cliente vê — a troca de modo só acontece na hora de
  // sair do console (se a pessoa desistir no carregamento, continua aqui).
  const abrir = (item, { destino = "/empresa", comoCliente = false, pessoa = null } = {}) => {
    const opcoes = comoCliente || pessoa ? { antesDeNavegar: () => entrarNoModo("portal", { pessoa }) } : {};
    if (item.tipo === "grupo") {
      lembrarGrupoContexto(item.id);
      abrirGrupo(item.id, destino, opcoes);
    } else abrirEmpresa(item.id, destino, opcoes);
  };
  const contexto = { abrir, abrirBusca: () => setBusca(true) };
  const pronto = state.modoEquipe === "console";

  return (
    <div className="hub console relative flex min-h-screen">
      <aside className="console-lateral sticky top-0 z-30 hidden h-screen w-[264px] shrink-0 border-r border-[var(--hub-borda)] lg:block">
        <Lateral state={state} onBusca={() => setBusca(true)} />
      </aside>

      {menuMovel && (
        <div className="fixed inset-0 z-[55] bg-[#030712]/50 backdrop-blur-sm lg:hidden" onClick={() => setMenuMovel(false)}>
          <div className="hub console-lateral absolute inset-y-0 left-0 w-[min(86vw,300px)] border-r border-[var(--hub-borda)]" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setMenuMovel(false)} aria-label="Fechar o menu" className="absolute right-3 top-5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--hub-borda)]">
              <X size={17} />
            </button>
            <Lateral state={state} onBusca={() => setBusca(true)} onIr={() => setMenuMovel(false)} />
          </div>
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        <div className="hub-fundo-decor pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
        <header className="hub-topo sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--hub-borda)] px-5 lg:hidden">
          <button type="button" onClick={() => setMenuMovel(true)} aria-label="Abrir o menu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)]">
            <Menu size={18} />
          </button>
          <AthosMark size={26} />
          <span className="hub-display text-[16px] font-bold">Console</span>
          <button type="button" onClick={() => setBusca(true)} aria-label="Buscar" className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)]">
            <Search size={17} />
          </button>
        </header>
        <main className="relative mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 lg:pt-10">
          {pronto ? (
            <Suspense fallback={<Carregando />}>
              <Outlet context={contexto} />
            </Suspense>
          ) : (
            <Carregando />
          )}
        </main>
      </div>

      <Busca aberta={busca} onFechar={() => setBusca(false)} state={state} />
      {pending && <WorkspaceLoading name={pending.name} isGroup={pending.isGroup} phase={pending.phase} progress={state.journalLoadProgress} onCancel={cancelar} />}
    </div>
  );
}
