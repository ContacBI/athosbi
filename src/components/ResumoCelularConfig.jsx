import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Copy, Eye, EyeOff, Network, RotateCcw, Search, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { ALERTAS, BLOCOS, NUMEROS, PADRAO, POSITIVOS, analisesDoPeriodo, configParaReplicar, configResumo } from "../lib/resumoCelular.js";
import { applyResumoCelularToCompanies } from "../lib/companies.js";
import { applyResumoCelularToGroups } from "../lib/groups.js";
import { companiesResponsavel, groupsResponsavel } from "../lib/colaboradores.js";

// Configuração do resumo no celular (o que o cliente vê): blocos e ordem,
// recado, números e — o principal — quais análises aparecem, marcando uma
// a uma as que o período gerou. Usada em Personalizar › Resumo do celular
// (ResumoCelularModal, com o celular do cliente ao lado) e pelo atalho de
// engrenagem dentro do próprio resumo (Celular.jsx).

const NOME_BLOCO = Object.fromEntries(BLOCOS.map((bloco) => [bloco.id, bloco]));
const alternar = (lista, id) => (lista.includes(id) ? lista.filter((item) => item !== id) : lista.concat(id));

function Secao({ titulo, children, ajuda }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{titulo}</h3>
      {ajuda && <p className="mt-0.5 text-[11.5px] text-ink-400">{ajuda}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Expansivel({ titulo, children, className = "" }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={className}>
      <button type="button" onClick={() => setAberto((atual) => !atual)} className="flex w-full items-center justify-between rounded-md bg-surface-muted px-3 py-2 text-[12.5px] font-medium text-ink-700">
        {titulo}
        {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {aberto && <div className="mt-2 flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

// Uma análise do período com a caixinha: marcada = o cliente vê.
function LinhaAnalise({ item, positivo, onToggle }) {
  const cor = positivo ? "bg-success-500" : item.severity >= 3 ? "bg-danger-500" : item.severity === 2 ? "bg-warning-500" : "bg-ink-300";
  return (
    <label className={`resumo-analise flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${item.marcado ? "border-line-strong bg-surface-card" : "border-dashed border-line bg-surface-muted/50"}`}>
      <input type="checkbox" checked={item.marcado} onChange={onToggle} className="mt-0.5 accent-[var(--color-accent-500)]" />
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cor} ${item.marcado ? "" : "opacity-40"}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[12.5px] font-medium leading-snug ${item.marcado ? "text-ink-900" : "text-ink-400 line-through"}`}>{item.title}</span>
        <span className="block text-[11.5px] leading-snug text-ink-400">{item.text}</span>
        {item.marcado && item.motivo && <span className="mt-0.5 inline-block rounded-full bg-warning-50 px-1.5 text-[10.5px] text-warning-700">{item.motivo}</span>}
      </span>
    </label>
  );
}

// "Usar em outras empresas": copia esta configuração (análises marcadas,
// limites, números, blocos) pras empresas/grupos escolhidos — só os que a
// pessoa pode editar (admin: todos; colaborador: onde é responsável). O
// recado é de cada empresa: só vai junto se pedir.
function ReplicarResumo({ config, onClose, onFeito }) {
  const appState = useAppState();
  const [marcados, setMarcados] = useState(new Set());
  const [busca, setBusca] = useState("");
  const [levarRecado, setLevarRecado] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState("");
  const ativoId = appState.activeGroupId || appState.activeCompanyId;
  const empresas = (appState.isAdmin ? appState.companies : companiesResponsavel(appState)).filter((item) => item.id !== ativoId);
  const grupos = (appState.isAdmin ? appState.groups : groupsResponsavel(appState)).filter((item) => item.id !== ativoId);
  const termo = busca.trim().toLowerCase();
  const filtra = (lista) => (termo ? lista.filter((item) => String(item.name || "").toLowerCase().includes(termo)) : lista);
  const secoes = [
    { tipo: "grupo", titulo: "Grupos", icone: Network, itens: filtra(grupos) },
    { tipo: "empresa", titulo: "Empresas", icone: Building2, itens: filtra(empresas) },
  ].filter((secao) => secao.itens.length > 0);
  const chave = (tipo, id) => `${tipo}:${id}`;
  const visiveis = secoes.flatMap((secao) => secao.itens.map((item) => chave(secao.tipo, item.id)));
  const todosMarcados = visiveis.length > 0 && visiveis.every((item) => marcados.has(item));

  function alternarItem(item) {
    setMarcados((atual) => {
      const next = new Set(atual);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }
  function alternarTodos() {
    setMarcados((atual) => {
      const next = new Set(atual);
      visiveis.forEach((item) => (todosMarcados ? next.delete(item) : next.add(item)));
      return next;
    });
  }

  async function aplicar() {
    if (!marcados.size) return;
    if (!confirm(`Substituir a configuração do resumo do celular de ${marcados.size} ${marcados.size === 1 ? "empresa/grupo" : "empresas/grupos"} por esta?${levarRecado ? " O recado também vai junto." : " O recado de cada uma fica como está."}`)) return;
    setAplicando(true);
    setErro("");
    const ids = (tipo) => [...marcados].filter((item) => item.startsWith(`${tipo}:`)).map((item) => item.slice(tipo.length + 1));
    const paraCada = (atual) => configParaReplicar(config, atual, { levarRecado });
    try {
      const [nEmpresas, nGrupos] = await Promise.all([applyResumoCelularToCompanies(paraCada, ids("empresa")), applyResumoCelularToGroups(paraCada, ids("grupo"))]);
      onFeito(nEmpresas + nGrupos);
    } catch (err) {
      setErro(`Não consegui gravar agora: ${String(err?.message || err).slice(0, 160)}`);
      setAplicando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-surface-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-ink-900">Usar em outras empresas</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-400">As mesmas análises, limites, números e blocos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 px-5 pt-3">
          <label className="relative flex flex-1 items-center">
            <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar" className="replicar-resumo-busca h-9 w-full rounded-md border border-line bg-surface-card pl-8 pr-3 text-[13px] outline-none focus:border-accent-400" />
          </label>
          {visiveis.length > 0 && (
            <button type="button" onClick={alternarTodos} className="replicar-resumo-todos shrink-0 rounded-md px-2 py-1.5 text-[12px] font-medium text-accent-600 hover:bg-accent-50">
              {todosMarcados ? "Desmarcar todas" : "Marcar todas"}
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {secoes.length === 0 && <p className="py-6 text-center text-[13px] text-ink-400">{termo ? `Nada encontrado para "${busca}".` : "Nenhuma outra empresa que você possa editar."}</p>}
          {secoes.map(({ tipo, titulo, icone: Icone, itens }) => (
            <div key={tipo} className="mb-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <Icone size={12} /> {titulo}
              </p>
              {itens.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] text-ink-800 hover:bg-surface-muted">
                  <input type="checkbox" checked={marcados.has(chave(tipo, item.id))} onChange={() => alternarItem(chave(tipo, item.id))} className="replicar-resumo-item accent-[var(--color-accent-500)]" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.resumoCelular && <span className="shrink-0 rounded-full bg-surface-muted px-1.5 text-[10.5px] text-ink-400">já configurada</span>}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-line px-5 py-3">
          <label className="flex items-start gap-2 text-[12.5px] text-ink-700">
            <input type="checkbox" checked={levarRecado} onChange={(event) => setLevarRecado(event.target.checked)} disabled={!config.recado.trim()} className="replicar-resumo-recado mt-0.5 accent-[var(--color-accent-500)]" />
            <span>
              Levar o recado também
              <span className="block text-[11.5px] text-ink-400">{config.recado.trim() ? `“${config.recado.trim().slice(0, 60)}${config.recado.trim().length > 60 ? "…" : ""}”` : "Esta empresa não tem recado."}</span>
            </span>
          </label>
          {erro && <p className="mt-2 text-[12px] text-danger-600">{erro}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
              Cancelar
            </button>
            <button type="button" onClick={aplicar} disabled={!marcados.size || aplicando} className="replicar-resumo-aplicar rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50">
              {aplicando ? "Aplicando…" : marcados.size ? `Aplicar em ${marcados.size}` : "Aplicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResumoCelularConfig({ config, onChange, onClose, verComoCliente, onVerComoCliente, salvo, nome, analysis, embutido = false }) {
  const muda = (patch) => onChange(configResumo({ ...config, ...patch }));
  const periodo = useMemo(() => analisesDoPeriodo(analysis, config), [analysis, config]);

  function mover(id, passo) {
    const ordem = [...config.ordem];
    const de = ordem.indexOf(id);
    const para = de + passo;
    if (para < 0 || para >= ordem.length) return;
    [ordem[de], ordem[para]] = [ordem[para], ordem[de]];
    muda({ ordem });
  }
  const tecnicos = ALERTAS.filter((alerta) => alerta.tecnico);
  const [replicando, setReplicando] = useState(false);
  const [aviso, setAviso] = useState("");
  const ocultos = config.alertasOcultos.length + config.positivosOcultos.length;

  return (
    <aside className={`resumo-config flex flex-col bg-surface-card ${embutido ? "h-full min-h-0" : "fixed inset-y-0 right-0 z-[60] w-full shadow-2xl ring-1 ring-line sm:w-[400px]"}`}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Resumo do celular</span>
          <h2 className="mt-0.5 truncate text-[16px] font-semibold text-ink-900">O que o cliente vê</h2>
          <p className="mt-0.5 truncate text-[12px] text-ink-400">
            {nome ? `${nome} · ` : ""}
            {salvo === "salvando" ? "Salvando…" : salvo === "erro" ? "Não foi salvo — tente de novo" : "Salvo automaticamente"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="px-5 py-3">
          <button
            type="button"
            onClick={() => onVerComoCliente(!verComoCliente)}
            className={`resumo-ver-cliente flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors ${verComoCliente ? "border-accent-400 bg-accent-50 text-accent-700" : "border-line-strong text-ink-700 hover:bg-surface-muted"}`}
          >
            {verComoCliente ? <Eye size={14} /> : <EyeOff size={14} />}
            {verComoCliente ? "Mostrando como o cliente vê" : "Mostrando a visão da equipe — ver como o cliente"}
          </button>
          <button type="button" onClick={() => setReplicando(true)} className="resumo-replicar mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-muted">
            <Copy size={14} /> Usar esta configuração em outras empresas
          </button>
          {aviso && <p className="mt-2 text-center text-[12px] text-success-600">{aviso}</p>}
        </div>

        <Secao titulo="Análises que aparecem" ajuda="As análises que o sistema fez para o período escolhido. Desmarque o que o cliente não deve ver — vale também para os próximos meses.">
          {periodo.alertas.length + periodo.positivos.length === 0 ? (
            <p className="text-[12.5px] text-ink-400">Nenhuma análise para este período.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {periodo.alertas.length > 0 && <p className="text-[11.5px] font-medium text-ink-500">Pede atenção</p>}
              {periodo.alertas.map((item) => (
                <LinhaAnalise key={item.id} item={item} onToggle={() => muda({ alertasOcultos: alternar(config.alertasOcultos, item.tipo) })} />
              ))}
              {periodo.positivos.length > 0 && <p className="mt-1.5 text-[11.5px] font-medium text-ink-500">Pontos positivos</p>}
              {periodo.positivos.map((item) => (
                <LinhaAnalise key={item.id} item={item} positivo onToggle={() => muda({ positivosOcultos: alternar(config.positivosOcultos, item.tipo) })} />
              ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-ink-600">
              Alertas no máximo
              <select value={config.maxAlertas} onChange={(event) => muda({ maxAlertas: Number(event.target.value) })} className="resumo-max-alertas rounded-md border border-line-strong bg-surface-card px-2 py-1 text-[13px]">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-600">
              Positivos no máximo
              <select value={config.positivos ? config.maxPositivos : 0} onChange={(event) => (Number(event.target.value) === 0 ? muda({ positivos: false }) : muda({ positivos: true, maxPositivos: Number(event.target.value) }))} className="resumo-max-positivos rounded-md border border-line-strong bg-surface-card px-2 py-1 text-[13px]">
                <option value={0}>Nenhum</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-[12.5px] text-ink-700">
            <input type="checkbox" checked={config.tecnicosSoEquipe} onChange={(event) => muda({ tecnicosSoEquipe: event.target.checked })} className="resumo-tecnicos mt-0.5 accent-[var(--color-accent-500)]" />
            <span>
              Alertas de conferência só para a equipe
              <span className="block text-[11.5px] text-ink-400">{tecnicos.map((alerta) => alerta.nome).join(", ")}.</span>
            </span>
          </label>

          <Expansivel className="mt-3" titulo={`Todos os tipos de análise${ocultos ? ` (${ocultos} desmarcado${ocultos === 1 ? "" : "s"})` : ""}`}>
            <p className="px-1 pb-1 text-[11px] text-ink-400">Inclusive os que não aconteceram neste período.</p>
            <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pede atenção</p>
            {ALERTAS.map((alerta) => (
              <label key={alerta.id} className="flex items-center gap-2 rounded px-1 py-1 text-[12.5px] text-ink-700 hover:bg-surface-muted">
                <input type="checkbox" checked={!config.alertasOcultos.includes(alerta.id)} onChange={() => muda({ alertasOcultos: alternar(config.alertasOcultos, alerta.id) })} className={`resumo-alerta-${alerta.id} accent-[var(--color-accent-500)]`} />
                {alerta.nome}
                {alerta.tecnico && <span className="ml-auto rounded-full bg-surface-muted px-1.5 text-[10px] text-ink-400">conferência</span>}
              </label>
            ))}
            <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pontos positivos</p>
            {POSITIVOS.map((positivo) => (
              <label key={positivo.id} className="flex items-center gap-2 rounded px-1 py-1 text-[12.5px] text-ink-700 hover:bg-surface-muted">
                <input type="checkbox" checked={!config.positivosOcultos.includes(positivo.id)} onChange={() => muda({ positivosOcultos: alternar(config.positivosOcultos, positivo.id) })} className={`resumo-positivo-${positivo.id} accent-[var(--color-accent-500)]`} />
                {positivo.nome}
              </label>
            ))}
          </Expansivel>
        </Secao>

        <Secao titulo="Recado do escritório" ajuda="Aparece no resumo enquanto tiver texto. Ex.: “Reunião de fechamento dia 10”, “Enviar extratos de outubro”.">
          <textarea
            value={config.recado}
            onChange={(event) => muda({ recado: event.target.value })}
            rows={3}
            maxLength={500}
            placeholder="Escreva um recado para o cliente (opcional)"
            className="resumo-recado w-full resize-none rounded-md border border-line-strong bg-surface-card px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-accent-500"
          />
        </Secao>

        <Secao titulo="Números principais" ajuda="Os quadrinhos, na ordem em que você marcar (até 6).">
          <div className="flex flex-wrap gap-1.5">
            {NUMEROS.map((numero) => {
              const posicao = config.numeros.indexOf(numero.id);
              const marcado = posicao >= 0;
              const cheio = !marcado && config.numeros.length >= 6;
              return (
                <button
                  key={numero.id}
                  type="button"
                  disabled={cheio}
                  onClick={() => muda({ numeros: alternar(config.numeros, numero.id) })}
                  className={`resumo-numero-${numero.id} flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-40 ${marcado ? "border-accent-400 bg-accent-50 text-accent-700" : "border-line-strong text-ink-600 hover:bg-surface-muted"}`}
                >
                  {marcado && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-semibold text-white">{posicao + 1}</span>}
                  {numero.nome}
                </button>
              );
            })}
          </div>
        </Secao>

        <Secao titulo="Blocos e ordem" ajuda="Desmarque o que não deve aparecer; use as setas para mudar a ordem.">
          <div className="flex flex-col gap-1.5">
            {config.ordem.map((id, posicao) => {
              const bloco = NOME_BLOCO[id];
              const visivel = !config.ocultos.includes(id);
              return (
                <div key={id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${visivel ? "border-line-strong" : "border-dashed border-line bg-surface-muted/50"}`}>
                  <input type="checkbox" checked={visivel} onChange={() => muda({ ocultos: alternar(config.ocultos, id) })} className={`resumo-bloco-${id} accent-[var(--color-accent-500)]`} aria-label={`Mostrar ${bloco.nome}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-medium ${visivel ? "text-ink-900" : "text-ink-400"}`}>{bloco.nome}</span>
                    <span className="block text-[11px] leading-snug text-ink-400">{bloco.descricao}</span>
                  </span>
                  <span className="flex shrink-0 flex-col">
                    <button type="button" onClick={() => mover(id, -1)} disabled={posicao === 0} aria-label="Subir" className="rounded p-0.5 text-ink-400 hover:bg-surface-muted hover:text-ink-900 disabled:opacity-30">
                      <ChevronUp size={14} />
                    </button>
                    <button type="button" onClick={() => mover(id, 1)} disabled={posicao === config.ordem.length - 1} aria-label="Descer" className="rounded p-0.5 text-ink-400 hover:bg-surface-muted hover:text-ink-900 disabled:opacity-30">
                      <ChevronDown size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </Secao>

        <div className="px-5 pt-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("Voltar o resumo desta empresa para o padrão? O recado e as análises desmarcadas também voltam.")) onChange(configResumo(PADRAO));
            }}
            className="resumo-padrao flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
          >
            <RotateCcw size={13} /> Voltar ao padrão
          </button>
        </div>
      </div>
      {replicando && (
        <ReplicarResumo
          config={config}
          onClose={() => setReplicando(false)}
          onFeito={(n) => {
            setReplicando(false);
            setAviso(`Configuração aplicada em ${n} ${n === 1 ? "empresa/grupo" : "empresas/grupos"}.`);
          }}
        />
      )}
    </aside>
  );
}
