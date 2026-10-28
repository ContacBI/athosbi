import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import CompanyLayout from "./components/CompanyLayout.jsx";
import SaveErrorBanner from "./components/SaveErrorBanner.jsx";
import ParametrosLayout from "./components/ParametrosLayout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import SetPassword from "./pages/SetPassword.jsx";
import ConfirmAccess from "./pages/ConfirmAccess.jsx";
import { supabase } from "./lib/supabaseClient.js";
import { ligarRegistroDeUso, mudouDeTela } from "./lib/uso.js";
import { EH_TESTE } from "./lib/ambiente.js";
import Empresas from "./pages/Empresas.jsx";
import CompanyHome from "./pages/CompanyHome.jsx";
import { loadPlan } from "./lib/plan.js";
import { loadCompanies } from "./lib/companies.js";
import { selectGroup } from "./lib/groups.js";
import { loadRepresentantes } from "./lib/representantes.js";
import { loadIndicatorOverrides } from "./lib/indicators.js";
import { isPortalAdmin, currentUserEmail, minhaFicha } from "./lib/access.js";
import { isColaborador, listAdmins, listColaboradores } from "./lib/colaboradores.js";
import { loadPlanosPadrao, refreshEffectivePlano } from "./lib/planosPadrao.js";
import { isReformaEscritorio } from "./lib/modulos.js";
import { listarEmpresas as listarEmpresasReforma } from "./lib/reforma/api.js";
import { setData } from "./data/useStore.js";
import { limparCopiaLocal } from "./lib/journalCache.js";
import Carregando from "./components/Carregando.jsx";

// Carregadas sob demanda (React.lazy) em vez de no pacote inicial — são as
// telas que só entram depois que a pessoa já navegou pra dentro de uma
// empresa/parâmetros, e várias delas puxam bibliotecas pesadas (jsPDF,
// html2canvas, xlsx, exceljs) só usadas nesse momento. Landing/Login/
// Empresas/CompanyHome continuam no pacote inicial — são a primeira tela
// que qualquer sessão vê.
const PainelTab = lazy(() => import("./pages/PainelTab.jsx"));
const SharedPresentation = lazy(() => import("./pages/SharedPresentation.jsx"));
const Celular = lazy(() => import("./pages/Celular.jsx"));
const PersonalizarHub = lazy(() => import("./pages/PersonalizarHub.jsx"));
const Demonstrativos = lazy(() => import("./pages/Demonstrativos.jsx"));
const Dfc = lazy(() => import("./pages/Dfc.jsx"));
const Depara = lazy(() => import("./pages/Depara.jsx"));
const Conferencia = lazy(() => import("./pages/Conferencia.jsx"));
const VinculoDfc = lazy(() => import("./pages/VinculoDfc.jsx"));
const RelatoriosMensais = lazy(() => import("./pages/RelatoriosMensais.jsx"));
const Apresentacoes = lazy(() => import("./pages/Apresentacoes.jsx"));
const Carteira = lazy(() => import("./pages/Carteira.jsx"));
const Orcamento = lazy(() => import("./pages/Orcamento.jsx"));
const CargaTributaria = lazy(() => import("./pages/CargaTributaria.jsx"));
const AnaliseDesempenho = lazy(() => import("./pages/AnaliseDesempenho.jsx"));
const CompaniesAdmin = lazy(() => import("./pages/parametros/CompaniesAdmin.jsx"));
const GruposAdmin = lazy(() => import("./pages/parametros/GruposAdmin.jsx"));
const DeParaAdmin = lazy(() => import("./pages/parametros/DeParaAdmin.jsx"));
const Representantes = lazy(() => import("./pages/parametros/Representantes.jsx"));
const ResponsaveisAdmin = lazy(() => import("./pages/parametros/ResponsaveisAdmin.jsx"));
const BiAdmin = lazy(() => import("./pages/parametros/BiAdmin.jsx"));
const AcessosAdmin = lazy(() => import("./pages/parametros/AcessosAdmin.jsx"));
const Sistema = lazy(() => import("./pages/parametros/Sistema.jsx"));
const PlanoGerencial = lazy(() => import("./pages/parametros/PlanoGerencial.jsx"));
const HistoricoVersoes = lazy(() => import("./pages/parametros/HistoricoVersoes.jsx"));
const PlanoPadraoAdmin = lazy(() => import("./pages/parametros/PlanoPadraoAdmin.jsx"));
const ColaborarAdmin = lazy(() => import("./pages/parametros/ColaborarAdmin.jsx"));
const ReformaParametros = lazy(() => import("./pages/parametros/ReformaParametros.jsx"));
const Central = lazy(() => import("./pages/parametros/Central.jsx"));
const ReformaHome = lazy(() => import("./pages/reforma/ReformaHome.jsx"));
const ReformaSimulacao = lazy(() => import("./pages/reforma/ReformaSimulacao.jsx"));
const ReformaPainel = lazy(() => import("./pages/reforma/ReformaPainel.jsx"));
const ReformaEmpresa = lazy(() => import("./pages/reforma/ReformaEmpresa.jsx"));

// Uso do portal pra Central (lib/uso.js): liga a coleta uma vez e avisa
// cada troca de tela.
function RegistroDeUso() {
  const { pathname } = useLocation();
  useEffect(() => {
    ligarRegistroDeUso();
  }, []);
  useEffect(() => {
    mudouDeTela(pathname);
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return <Carregando />;
}

function AuthedApp() {
  const [session, setSession] = useState(undefined); // undefined = ainda não checou, null = deslogado
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState("");
  // Supabase dispara onAuthStateChange pra bem mais coisa que login/logout —
  // renovação silenciosa de token, revalidação ao voltar o foco na aba —
  // cada uma entregando um objeto de sessão NOVO (referência diferente)
  // mesmo sendo o mesmo usuário logado continuando. Sem essa trava, o efeito
  // de baixo re-rodava loadCompanies() a cada uma dessas, que zera
  // activeCompanyId por uma fração de segundo antes de restaurar — tempo
  // suficiente pro CompanyLayout achar que não tem empresa ativa e chutar
  // de volta pra /empresas no meio de qualquer edição. Só recarrega quando
  // o usuário logado de fato muda (login novo, troca de conta, logout).
  const bootedForUserRef = useRef(null);

  // Auth primeiro: só faz sentido ir buscar dados no Supabase (empresas,
  // plano gerencial etc.) depois de saber que existe uma sessão — as
  // políticas de RLS do banco exigem usuário autenticado pra tudo (ver
  // supabase/schema.sql), então sem isso as leituras só voltariam vazias.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        // Sessão encerrada (logout, token expirado) — volta pra tela de
        // carregar de novo da próxima vez que logar, em vez de continuar
        // mostrando dados de uma sessão que não existe mais.
        bootedForUserRef.current = null;
        setReady(false);
        setBootError("");
        // A cópia local do razão (ver lib/journalCache.js) não fica no
        // navegador depois que a pessoa sai.
        limparCopiaLocal();
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (bootedForUserRef.current === session.user.id) return; // já carregado pra esse usuário — token só renovou
    bootedForUserRef.current = session.user.id;
    Promise.all([
      loadPlan(),
      loadCompanies(),
      loadRepresentantes(),
      loadIndicatorOverrides(),
      isPortalAdmin(),
      loadPlanosPadrao(),
      isColaborador(),
      currentUserEmail(),
      isReformaEscritorio(),
      // Empresas da Reforma Tributária que a pessoa enxerga (RLS) — sem
      // elas o portal abre normalmente, só sem o botão da Reforma.
      listarEmpresasReforma().catch((error) => {
        console.error("Falha ao listar as empresas da Reforma Tributária:", error);
        return [];
      }),
    ])
      .then(async ([, companiesResult, , , adminFlag, , colaboradorFlag, email, reformaFlag, reformaEmpresas]) => {
        setData({ isAdmin: adminFlag, isColaborador: colaboradorFlag, userEmail: email, isReformaEscritorio: reformaFlag, reformaEmpresas });
        // Cliente: quais módulos complementares (Orçamento, Carga…) foram
        // liberados na ficha dele — sem ficha (ou sem a tabela), só o B.I.
        if (!adminFlag && !colaboradorFlag) {
          minhaFicha()
            .then((ficha) => setData({ modulosCliente: Array.isArray(ficha?.modulos) ? ficha.modulos : [], nomeUsuario: ficha?.nome || "" }))
            .catch(() => setData({ modulosCliente: [] }));
        } else {
          // Equipe: o nome vem do cadastro de admin/colaborador (Parâmetros ›
          // Colaborar) — só pra saudação do Início.
          Promise.all([listAdmins().catch(() => []), listColaboradores().catch(() => [])]).then(([admins, colaboradores]) => {
            const eu = [...admins, ...colaboradores].find((pessoa) => pessoa.email === email && pessoa.nome);
            if (eu) setData({ nomeUsuario: eu.nome });
          });
        }
        // selectGroup marca state.activeGroupId de forma SÍNCRONA (antes de
        // qualquer await) — isso basta pro CompanyLayout não chutar de volta
        // pra /empresas num F5 dentro de um grupo. O razão dos membros chega
        // depois, em segundo plano, com o percentual na barra do topo; NÃO
        // espera por ele aqui, senão um grupo grande deixava o portal
        // inteiro preso em "Carregando portal…" até baixar tudo.
        if (companiesResult?.groupId) {
          selectGroup(companiesResult.groupId, { skipPersist: true }).catch((error) => console.error("Falha ao reabrir o grupo:", error));
        }
        // loadCompanies() já chama selectCompany() internamente, que por
        // sua vez chama refreshEffectivePlano() — mas isso roda em
        // paralelo com loadPlanosPadrao() aqui em cima (mesmo Promise.all),
        // sem garantia de ordem. Se planosPadrao ainda não tinha chegado
        // naquele momento, as contas extras ficariam de fora até a próxima
        // troca de empresa. Chamar de novo aqui, já com tudo resolvido,
        // garante que a primeira tela já sai certa.
        refreshEffectivePlano();
      })
      .catch((error) => {
        console.error("Falha ao iniciar o portal:", error);
        setBootError(String(error?.message || error));
        bootedForUserRef.current = null; // permite tentar de novo
      })
      .finally(() => setReady(true));
  }, [session]);

  if (session === undefined) {
    return <Carregando tela texto="Carregando portal…" />;
  }

  if (session === null) {
    return <Login />;
  }

  if (!ready) {
    return <Carregando tela texto="Carregando portal…" />;
  }

  if (bootError) {
    const sessaoVencida = /JWT expired|PGRST303|sess[aã]o/i.test(bootError);
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface-page px-6 text-center">
        <p className="max-w-md text-[14px] font-medium text-ink-900">{sessaoVencida ? "Sua sessão venceu enquanto o portal estava fechado." : "Não consegui carregar o portal agora."}</p>
        <p className="max-w-lg text-[12.5px] text-ink-500">{sessaoVencida ? "Tente de novo — se continuar, entre de novo com seu e-mail e senha." : `Detalhe: ${bootError}`}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600">
            Tentar de novo
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()} className="rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-muted">
            Entrar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RegistroDeUso />
      <SaveErrorBanner />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="definir-senha" element={<SetPassword />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="carteira" element={<Carteira />} />
        <Route path="parametros" element={<ParametrosLayout />}>
          <Route index element={<Navigate to="empresas" replace />} />
          <Route path="central" element={<Central />} />
          <Route path="empresas" element={<CompaniesAdmin />} />
          <Route path="grupo" element={<GruposAdmin />} />
          <Route path="de-para" element={<DeParaAdmin />} />
          <Route path="representantes" element={<Representantes />} />
          <Route path="responsaveis" element={<ResponsaveisAdmin />} />
          <Route path="bi" element={<BiAdmin />} />
          <Route path="acessos" element={<AcessosAdmin />} />
          <Route path="sistema" element={<Sistema />} />
          <Route path="sistema/plano-gerencial" element={<PlanoGerencial />} />
          <Route path="sistema/historico" element={<HistoricoVersoes />} />
          <Route path="planos-padrao" element={<PlanoPadraoAdmin />} />
          <Route path="colaborar" element={<ColaborarAdmin />} />
          <Route path="reforma" element={<ReformaParametros />} />
        </Route>
        <Route path="reforma" element={<ReformaHome />} />
        <Route path="reforma/painel" element={<ReformaPainel />} />
        <Route path="reforma/empresa/:id" element={<ReformaEmpresa />} />
        <Route path="reforma/simulacao/:id" element={<ReformaSimulacao />} />
        <Route path="empresa" element={<CompanyLayout />}>
          <Route index element={<CompanyHome />} />
          <Route path="painel/:tabId" element={<PainelTab />} />
          <Route path="celular" element={<Celular />} />
          <Route path="personalizar" element={<PersonalizarHub />} />
          <Route path="demonstrativos" element={<Demonstrativos />} />
          <Route path="dfc" element={<Dfc />} />
          <Route path="de-para" element={<Depara />} />
          <Route path="conferencia" element={<Conferencia />} />
          <Route path="vinculo-dfc" element={<VinculoDfc />} />
          <Route path="relatorios" element={<RelatoriosMensais />} />
          <Route path="apresentacoes" element={<Apresentacoes />} />
          <Route path="orcamento" element={<Orcamento />} />
          <Route path="carga-tributaria" element={<CargaTributaria />} />
          <Route path="analise-desempenho" element={<AnaliseDesempenho />} />
          <Route path="apresentacoes/:deckId" element={<Apresentacoes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Site de teste (homologação): selo fixo em todas as telas e "[TESTE]" no
// título da aba — pra ninguém confundir com o oficial (ver lib/ambiente.js).
// Mostra de quando é a cópia do oficial (copia_do_oficial, só no banco de
// teste — ver supabase/teste/copia_do_oficial.sql); antes do login, ou sem
// cópia ainda, só "Ambiente de teste".
function SeloDeTeste() {
  const [copia, setCopia] = useState("");
  useEffect(() => {
    if (!document.title.startsWith("[TESTE]")) document.title = `[TESTE] ${document.title}`;
    const buscar = () =>
      supabase
        .from("copia_do_oficial")
        .select("feita_em")
        .order("feita_em", { ascending: false })
        .limit(1)
        .then(({ data }) => setCopia(data?.[0]?.feita_em ? new Date(data[0].feita_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""));
    buscar();
    const { data } = supabase.auth.onAuthStateChange((evento) => evento === "SIGNED_IN" && buscar());
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <div className="selo-teste pointer-events-none fixed left-1/2 top-1.5 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-full bg-warning-500/95 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white shadow-lg ring-2 ring-white/70">
      Ambiente de teste{copia ? ` · cópia do oficial de ${copia}` : ""}
    </div>
  );
}

export default function App() {
  return (
    <>
      {EH_TESTE && <SeloDeTeste />}
      <AppConteudo />
    </>
  );
}

function AppConteudo() {
  // Antes de qualquer checagem de sessão — quem chega aqui (link de convite
  // ou de "esqueci minha senha", ver ConfirmAccess.jsx) ainda não está
  // logado de propósito; a troca de verdade só acontece dentro do clique
  // no botão daquela página. Fica FORA de AuthedApp (que já usa useState
  // logo na primeira linha) pra não ter hook nenhum condicionado a essa
  // checagem de pathname. Comparação crua de window.location porque isso
  // roda antes do <BrowserRouter> existir.
  if (window.location.pathname === "/confirmar-acesso") {
    return <ConfirmAccess />;
  }
  // Apresentação compartilhada por link (/p/<código>): aberta por quem não
  // tem login — nem passa pela checagem de sessão nem carrega o portal.
  const shared = window.location.pathname.match(/^\/p\/([A-Za-z0-9]{20,64})\/?$/);
  if (shared) {
    return (
      <Suspense fallback={<Carregando escuro texto="Abrindo a apresentação…" />}>
        <SharedPresentation token={shared[1]} />
      </Suspense>
    );
  }
  return <AuthedApp />;
}
