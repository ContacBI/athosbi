import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CompanyLayout from "./components/CompanyLayout.jsx";
import ParametrosLayout from "./components/ParametrosLayout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import { supabase } from "./lib/supabaseClient.js";
import Empresas from "./pages/Empresas.jsx";
import CompanyHome from "./pages/CompanyHome.jsx";
import { loadPlan } from "./lib/plan.js";
import { loadCompanies } from "./lib/companies.js";
import { selectGroup } from "./lib/groups.js";
import { loadRepresentantes } from "./lib/representantes.js";
import { loadIndicatorOverrides } from "./lib/indicators.js";

// Carregadas sob demanda (React.lazy) em vez de no pacote inicial — são as
// telas que só entram depois que a pessoa já navegou pra dentro de uma
// empresa/parâmetros, e várias delas puxam bibliotecas pesadas (jsPDF,
// html2canvas, xlsx, exceljs) só usadas nesse momento. Landing/Login/
// Empresas/CompanyHome continuam no pacote inicial — são a primeira tela
// que qualquer sessão vê.
const PainelTab = lazy(() => import("./pages/PainelTab.jsx"));
const PersonalizarHub = lazy(() => import("./pages/PersonalizarHub.jsx"));
const Demonstrativos = lazy(() => import("./pages/Demonstrativos.jsx"));
const Dfc = lazy(() => import("./pages/Dfc.jsx"));
const Depara = lazy(() => import("./pages/Depara.jsx"));
const VinculoDfc = lazy(() => import("./pages/VinculoDfc.jsx"));
const RelatoriosMensais = lazy(() => import("./pages/RelatoriosMensais.jsx"));
const CompaniesAdmin = lazy(() => import("./pages/parametros/CompaniesAdmin.jsx"));
const GruposAdmin = lazy(() => import("./pages/parametros/GruposAdmin.jsx"));
const DeParaAdmin = lazy(() => import("./pages/parametros/DeParaAdmin.jsx"));
const Representantes = lazy(() => import("./pages/parametros/Representantes.jsx"));
const BiAdmin = lazy(() => import("./pages/parametros/BiAdmin.jsx"));
const Sistema = lazy(() => import("./pages/parametros/Sistema.jsx"));
const PlanoGerencial = lazy(() => import("./pages/parametros/PlanoGerencial.jsx"));

function RouteFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-[13px] text-ink-400">
      Carregando…
    </div>
  );
}

export default function App() {
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
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setSession(data.session); return; }
      // TEMPORÁRIO (login de e-mail/senha travado por falta de acesso ao
      // primeiro usuário — ver conversa) — entra com sessão anônima
      // automática em vez de mostrar a tela de login, só pra destravar o
      // teste. Exige "Allow anonymous sign-ins" habilitado no projeto
      // Supabase. REVERTER assim que o login normal estiver funcionando:
      // trocar essa chamada de volta por `setSession(null)`.
      supabase.auth.signInAnonymously().then(({ data: anonData, error: anonError }) => {
        if (anonError) { console.error("Falha no login anônimo temporário:", anonError); setSession(null); return; }
        setSession(anonData.session);
      });
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        // Sessão encerrada (logout, token expirado) — volta pra tela de
        // carregar de novo da próxima vez que logar, em vez de continuar
        // mostrando dados de uma sessão que não existe mais.
        bootedForUserRef.current = null;
        setReady(false);
        setBootError("");
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (bootedForUserRef.current === session.user.id) return; // já carregado pra esse usuário — token só renovou
    bootedForUserRef.current = session.user.id;
    Promise.all([loadPlan(), loadCompanies(), loadRepresentantes(), loadIndicatorOverrides()])
      .then(([, companiesResult]) => {
        if (companiesResult?.groupId) selectGroup(companiesResult.groupId, { skipPersist: true });
      })
      .catch((error) => {
        console.error("Falha ao iniciar o portal:", error);
        setBootError(String(error?.message || error));
        bootedForUserRef.current = null; // permite tentar de novo
      })
      .finally(() => setReady(true));
  }, [session]);

  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-page text-[13px] text-ink-400">
        Carregando portal…
      </div>
    );
  }

  if (session === null) {
    return <Login />;
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-page text-[13px] text-ink-400">
        Carregando portal…
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-page px-6 text-center text-[13px] text-danger-600">
        Erro ao carregar o portal: {bootError}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="parametros" element={<ParametrosLayout />}>
          <Route index element={<Navigate to="empresas" replace />} />
          <Route path="empresas" element={<CompaniesAdmin />} />
          <Route path="grupo" element={<GruposAdmin />} />
          <Route path="de-para" element={<DeParaAdmin />} />
          <Route path="representantes" element={<Representantes />} />
          <Route path="bi" element={<BiAdmin />} />
          <Route path="sistema" element={<Sistema />} />
          <Route path="sistema/plano-gerencial" element={<PlanoGerencial />} />
        </Route>
        <Route path="empresa" element={<CompanyLayout />}>
          <Route index element={<CompanyHome />} />
          <Route path="painel/:tabId" element={<PainelTab />} />
          <Route path="personalizar" element={<PersonalizarHub />} />
          <Route path="demonstrativos" element={<Demonstrativos />} />
          <Route path="dfc" element={<Dfc />} />
          <Route path="de-para" element={<Depara />} />
          <Route path="vinculo-dfc" element={<VinculoDfc />} />
          <Route path="relatorios" element={<RelatoriosMensais />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
