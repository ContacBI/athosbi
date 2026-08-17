import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CompanyLayout from "./components/CompanyLayout.jsx";
import ParametrosLayout from "./components/ParametrosLayout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import { supabase } from "./lib/supabaseClient.js";
import Empresas from "./pages/Empresas.jsx";
import CompanyHome from "./pages/CompanyHome.jsx";
import PainelTab from "./pages/PainelTab.jsx";
import PersonalizarHub from "./pages/PersonalizarHub.jsx";
import Demonstrativos from "./pages/Demonstrativos.jsx";
import Depara from "./pages/Depara.jsx";
import RelatoriosMensais from "./pages/RelatoriosMensais.jsx";
import CompaniesAdmin from "./pages/parametros/CompaniesAdmin.jsx";
import GruposAdmin from "./pages/parametros/GruposAdmin.jsx";
import DeParaAdmin from "./pages/parametros/DeParaAdmin.jsx";
import Representantes from "./pages/parametros/Representantes.jsx";
import BiAdmin from "./pages/parametros/BiAdmin.jsx";
import Sistema from "./pages/parametros/Sistema.jsx";
import PlanoGerencial from "./pages/parametros/PlanoGerencial.jsx";
import { loadPlan } from "./lib/plan.js";
import { loadCompanies } from "./lib/companies.js";
import { selectGroup } from "./lib/groups.js";
import { loadRepresentantes } from "./lib/representantes.js";
import { loadIndicatorOverrides } from "./lib/indicators.js";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ainda não checou, null = deslogado
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState("");

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
        setReady(false);
        setBootError("");
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    Promise.all([loadPlan(), loadCompanies(), loadRepresentantes(), loadIndicatorOverrides()])
      .then(([, companiesResult]) => {
        if (companiesResult?.groupId) selectGroup(companiesResult.groupId, { skipPersist: true });
      })
      .catch((error) => {
        console.error("Falha ao iniciar o portal:", error);
        setBootError(String(error?.message || error));
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
          <Route path="de-para" element={<Depara />} />
          <Route path="relatorios" element={<RelatoriosMensais />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
