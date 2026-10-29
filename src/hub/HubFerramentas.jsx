import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, ChevronDown, Eye, EyeOff, Network } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { ferramentasDaTela } from "../lib/modulos.js";
import Avatar from "../components/Avatar.jsx";
import { iconeDaFerramenta } from "./iconesDasFerramentas.js";
import { Revelar, moverLuz } from "./efeitos.jsx";

// Um desenho de cada ferramenta no cartão (só ilustração, sem número de
// verdade) — nas cores da marca.
function Previa({ id }) {
  if (id === "orcamento") {
    const meses = [
      [62, 70],
      [58, 52],
      [74, 80],
      [66, 61],
      [80, 86],
      [72, 78],
    ];
    return (
      <span className="flex h-full items-end gap-2.5">
        {meses.map(([orcado, realizado], i) => (
          <span key={i} className="flex h-full flex-1 items-end gap-1">
            <span className="flex-1 rounded-t-md bg-[var(--hub-borda-forte)]" style={{ height: `${orcado}%` }} />
            <span className="flex-1 rounded-t-md bg-gradient-to-t from-[#e8691f] to-[#f4a96f]" style={{ height: `${realizado}%` }} />
          </span>
        ))}
      </span>
    );
  }
  if (id === "carga-tributaria") {
    const fatias = [
      ["ICMS", 38, "#e8691f"],
      ["PIS/Cofins", 27, "#f4a96f"],
      ["IRPJ/CSLL", 21, "#2f6fed"],
      ["Outros", 14, "var(--hub-borda-forte)"],
    ];
    return (
      <span className="flex h-full flex-col justify-end gap-3">
        <span className="flex items-baseline gap-2">
          <span className="hub-display text-[34px] font-extrabold leading-none text-[var(--hub-texto)]">%</span>
          <span className="text-[12px] font-semibold text-[var(--hub-texto-3)]">dos impostos sobre o faturamento</span>
        </span>
        <span className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full">
          {fatias.map(([nome, peso, cor]) => (
            <span key={nome} style={{ width: `${peso}%`, background: cor }} />
          ))}
        </span>
      </span>
    );
  }
  if (id === "analise-desempenho") {
    const itens = [92, 74, 58, 41, 27];
    return (
      <span className="flex h-full flex-col justify-end gap-1.5">
        {itens.map((largura, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="h-2 w-6 shrink-0 rounded-full bg-[var(--hub-borda)]" />
            <span className="h-2.5 rounded-full" style={{ width: `${largura}%`, background: i === 0 ? "linear-gradient(90deg,#e8691f,#f4a96f)" : "var(--hub-borda-forte)" }} />
          </span>
        ))}
      </span>
    );
  }
  // Entradas x Saídas
  const pares = [
    [55, 40],
    [70, 52],
    [48, 61],
    [82, 58],
    [64, 47],
    [76, 69],
  ];
  return (
    <span className="flex h-full items-center gap-2.5">
      {pares.map(([entrada, saida], i) => (
        <span key={i} className="flex h-full flex-1 flex-col justify-center gap-1">
          <span className="w-full rounded-md bg-[#2f6fed]/70" style={{ height: `${entrada / 2}%` }} />
          <span className="w-full rounded-md bg-gradient-to-b from-[#e8691f] to-[#f4a96f]" style={{ height: `${saida / 2}%` }} />
        </span>
      ))}
    </span>
  );
}

// Ferramentas (pedido do Izaias, 29/10/2026): os módulos que ficavam no menu
// lateral do B.I. — Orçamento, Carga tributária, Análise de desempenho e
// Entradas x Saídas — pra empresa ou grupo do momento (num grupo, o
// consolidado). O cliente vê só as liberadas pra ele; a equipe vê todas, com
// o selo de quem vê (ferramentasDaTela em lib/modulos.js).
export default function HubFerramentas() {
  const state = useAppState();
  const navigate = useNavigate();
  // A troca de empresa/grupo é a do menu principal do hub (HubLayout).
  const { abrir, escolherEmpresa } = useOutletContext();

  const grupo = state.activeGroupId ? state.groups.find((group) => group.id === state.activeGroupId) : null;
  const empresa = !grupo && state.activeCompanyId ? state.companies.find((company) => company.id === state.activeCompanyId) : null;
  const alvo = grupo ? { tipo: "grupo", id: grupo.id, nome: grupo.name } : empresa ? { tipo: "empresa", id: empresa.id, nome: empresa.name } : null;
  const ferramentas = alvo ? ferramentasDaTela(state) : [];
  const equipe = Boolean(state.modoEquipe) && !state.pessoaVista;
  const carregado = !state.journalLoading && (state.accounts.length > 0 || state.journal.length > 0);
  const temDados = state.accounts.length > 0 || state.journal.length > 0 || state.journalLoading;

  // Já aberta e com os dados na memória: entra direto; senão espera carregar (a tela de carregamento do hub).
  const usar = (ferramenta) => {
    if (carregado && !state.journalLoadFailed) navigate(ferramenta.rota);
    else abrir(alvo, ferramenta.rota);
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
          <p className="mt-5 max-w-[580px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Orçamento, impostos, desempenho e notas fiscais — cada ferramenta com os números da empresa ou do grupo{grupo ? " (o consolidado)" : ""}.</p>
        </Revelar>
        <Revelar atraso={0.18} className="mt-7">
          <button type="button" onClick={escolherEmpresa} className="inline-flex h-12 max-w-full items-center gap-2.5 rounded-full border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] pl-1.5 pr-4 text-left transition-colors hover:border-[var(--hub-acento)]">
            {grupo ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white">
                <Network size={16} />
              </span>
            ) : alvo ? (
              <Avatar name={alvo.nome} size={36} className="rounded-full" />
            ) : null}
            <span className="min-w-0 truncate text-[14.5px] font-semibold">
              {alvo ? (
                <>
                  <span className="text-[var(--hub-texto-3)]">Para </span>
                  {alvo.nome}
                </>
              ) : (
                "Escolher a empresa ou o grupo"
              )}
            </span>
            {grupo && <span className="shrink-0 rounded-full bg-[var(--hub-acento-suave)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--hub-acento)]">Consolidado</span>}
            <ChevronDown size={15} className="shrink-0 text-[var(--hub-texto-3)]" />
          </button>
        </Revelar>
      </section>

      {ferramentas.length > 0 && (
        <section className="mx-auto hub-largura px-5 sm:px-8">
          <div className="grid gap-5 md:grid-cols-2">
            {ferramentas.map((ferramenta, i) => {
              const Icone = iconeDaFerramenta(ferramenta.id);
              const semDados = ferramenta.precisaDeDados && !temDados;
              return (
                <Revelar key={ferramenta.id} atraso={i * 0.06}>
                  <button type="button" onClick={() => usar(ferramenta)} disabled={semDados} onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo group flex h-full w-full flex-col overflow-hidden text-left disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="flex items-start justify-between gap-4 p-7 pb-0 sm:p-8 sm:pb-0">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white shadow-[0_12px_24px_-12px_rgba(232,105,31,0.8)]">
                        <Icone size={24} />
                      </span>
                      {equipe && ferramenta.doCliente === false && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hub-borda)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--hub-texto-3)]" title="Não liberada para o cliente — libere na ficha do grupo, no console">
                          <EyeOff size={13} /> Só a equipe vê
                        </span>
                      )}
                      {equipe && ferramenta.doCliente === true && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(29,158,117,0.12)] px-2.5 py-1 text-[11.5px] font-semibold text-[#1d9e75]">
                          <Eye size={13} /> O cliente vê
                        </span>
                      )}
                    </span>
                    <span className="px-7 pt-6 sm:px-8">
                      <span className="hub-display block text-[26px] font-bold leading-tight">{ferramenta.nome}</span>
                      <span className="mt-2 block text-[15px] leading-relaxed text-[var(--hub-texto-2)]">{ferramenta.descricao}</span>
                    </span>
                    <span className="mx-7 mt-6 block h-28 rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] p-4 sm:mx-8" aria-hidden="true">
                      <Previa id={ferramenta.id} />
                    </span>
                    <span className="mt-auto flex items-center justify-between px-7 pb-7 pt-6 sm:px-8 sm:pb-8">
                      <span className="text-[14px] font-bold text-[var(--hub-acento)]">{semDados ? "Sem dados importados ainda" : "Abrir"}</span>
                      {!semDados && (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hub-acento)] text-white transition-transform group-hover:translate-x-1">
                          <ArrowRight size={17} />
                        </span>
                      )}
                    </span>
                  </button>
                </Revelar>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
