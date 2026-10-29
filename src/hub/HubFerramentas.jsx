import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, ArrowLeftRight, Network } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { selectCompany } from "../lib/companies.js";
import { selectGroup } from "../lib/groups.js";
import { FERRAMENTAS_EM_PREPARACAO, MODULOS_COMPLEMENTARES, modulosLiberados } from "../lib/modulos.js";
import { lembrarGrupoContexto } from "../lib/unidades.js";
import Avatar from "../components/Avatar.jsx";
import SeletorDeEmpresa from "../components/SeletorDeEmpresa.jsx";
import { iconeDaFerramenta } from "./iconesDasFerramentas.js";
import { Revelar, moverLuz } from "./efeitos.jsx";

// Ferramentas (pedido do Izaias, 29/10/2026): os módulos que ficavam no menu
// lateral do B.I. (Orçamento, Carga tributária, Análise de desempenho,
// Entradas x Saídas) moram aqui agora, pra empresa ou grupo aberto — e o que
// ainda vai entrar (Apuração de ICMS). Só aparece o que está liberado pra
// ela (lib/modulos.js).
export default function HubFerramentas() {
  const state = useAppState();
  const navigate = useNavigate();
  const { abrir } = useOutletContext();
  const [seletor, setSeletor] = useState(false);

  const grupo = state.activeGroupId ? state.groups.find((group) => group.id === state.activeGroupId) : null;
  const empresa = !grupo && state.activeCompanyId ? state.companies.find((company) => company.id === state.activeCompanyId) : null;
  const alvo = grupo ? { tipo: "grupo", id: grupo.id, nome: grupo.name } : empresa ? { tipo: "empresa", id: empresa.id, nome: empresa.name } : null;
  const liberados = modulosLiberados(state);
  const ferramentas = MODULOS_COMPLEMENTARES.filter((modulo) => liberados.includes(modulo.id));
  const carregado = !state.journalLoading && (state.accounts.length > 0 || state.journal.length > 0);
  const temDados = state.accounts.length > 0 || state.journal.length > 0 || state.journalLoading;

  // Já aberta e com os dados na memória: entra direto; senão espera carregar (a tela de carregamento do hub).
  const usar = (ferramenta) => {
    if (!alvo) {
      setSeletor(true);
      return;
    }
    if (carregado && !state.journalLoadFailed) navigate(ferramenta.rota);
    else abrir(alvo, ferramenta.rota);
  };
  // Trocar aqui só escolhe pra quem são as ferramentas — o B.I. não abre.
  const escolher = (item) => {
    if (item.tipo === "grupo") {
      lembrarGrupoContexto(item.id);
      selectGroup(item.id).catch((error) => console.error("Falha ao abrir o grupo:", error));
    } else selectCompany(item.id).catch((error) => console.error("Falha ao abrir a empresa:", error));
  };

  return (
    <>
      <section className="mx-auto hub-largura px-5 pb-12 pt-12 sm:px-8 lg:pt-16">
        <Revelar>
          <p className="hub-rotulo">Ferramentas</p>
        </Revelar>
        <Revelar atraso={0.06}>
          <h1 className="hub-display mt-5 max-w-3xl text-[42px] font-extrabold leading-[1.03] sm:text-[56px]">
            O dia a dia da empresa, <span className="hub-italico">à mão</span>
            <span className="hub-pontuacao">.</span>
          </h1>
        </Revelar>
        <Revelar atraso={0.12}>
          <p className="mt-5 max-w-[580px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Orçamento, impostos, desempenho e notas fiscais — cada ferramenta com os números da empresa ou do grupo escolhido.</p>
        </Revelar>
        <Revelar atraso={0.18} className="mt-8">
          <button type="button" onClick={() => setSeletor(true)} className="hub-cartao flex w-full max-w-[520px] items-center gap-3.5 p-3 pr-4 text-left transition-colors hover:border-[var(--hub-acento)]">
            {alvo ? (
              alvo.tipo === "grupo" ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white">
                  <Network size={19} />
                </span>
              ) : (
                <Avatar name={alvo.nome} size={44} className="rounded-2xl" />
              )
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[var(--hub-borda-forte)] text-[var(--hub-texto-3)]">
                <ArrowLeftRight size={18} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hub-texto-3)]">{alvo ? (alvo.tipo === "grupo" ? "Grupo" : "Empresa") : "Para quem"}</span>
              <span className="block truncate text-[15.5px] font-bold">{alvo ? alvo.nome : "Escolha a empresa ou o grupo"}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hub-borda-forte)] px-3 py-1.5 text-[12.5px] font-semibold">
              <ArrowLeftRight size={13} /> Trocar
            </span>
          </button>
        </Revelar>
      </section>

      <section className="mx-auto hub-largura px-5 sm:px-8">
        {alvo && ferramentas.length === 0 && (
          <Revelar>
            <div className="hub-cartao px-7 py-10 text-[15px] text-[var(--hub-texto-2)]">Nenhuma ferramenta liberada para {alvo.nome} ainda. Fale com a sua equipe na Athos.</div>
          </Revelar>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ferramentas.map((ferramenta, i) => {
            const Icone = iconeDaFerramenta(ferramenta.id);
            const semDados = alvo && ferramenta.precisaDeDados && !temDados;
            return (
              <Revelar key={ferramenta.id} atraso={i * 0.05}>
                <button type="button" onClick={() => usar(ferramenta)} disabled={semDados} onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex h-full w-full flex-col gap-5 p-7 text-left disabled:cursor-not-allowed disabled:opacity-60">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
                    <Icone size={22} />
                  </span>
                  <span>
                    <span className="hub-display block text-[22px] font-bold leading-tight">{ferramenta.nome}</span>
                    <span className="mt-2 block text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">{ferramenta.descricao}</span>
                  </span>
                  <span className="mt-auto inline-flex items-center gap-2 text-[14px] font-bold text-[var(--hub-acento)]">
                    {semDados ? "Sem dados importados ainda" : "Abrir"} {!semDados && <ArrowRight size={16} />}
                  </span>
                </button>
              </Revelar>
            );
          })}
          {FERRAMENTAS_EM_PREPARACAO.map((item, i) => {
            const Icone = iconeDaFerramenta(item.id);
            return (
              <Revelar key={item.id} atraso={(ferramentas.length + i) * 0.05}>
                <div className="flex h-full flex-col gap-5 rounded-[24px] border border-dashed border-[var(--hub-borda-forte)] p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-[var(--hub-borda-forte)] text-[var(--hub-texto-3)]">
                    <Icone size={22} />
                  </span>
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="hub-display text-[22px] font-bold leading-tight">{item.nome}</span>
                      <span className="hub-selo">Em preparação</span>
                    </span>
                    <span className="mt-2 block text-[14.5px] leading-relaxed text-[var(--hub-texto-3)]">{item.descricao}</span>
                  </span>
                </div>
              </Revelar>
            );
          })}
        </div>
      </section>

      <SeletorDeEmpresa aberto={seletor} onFechar={() => setSeletor(false)} onEscolher={escolher} />
    </>
  );
}
