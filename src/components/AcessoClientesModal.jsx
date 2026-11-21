import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Trash2, UserPlus, Users, Wrench, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import PreviaCliente from "./PreviaCliente.jsx";
import { grantAccess, inviteUser, listAccessGrants, listAccessPeople, revokeAccess } from "../lib/access.js";
import { saveVisibilidadeEmpresa } from "../lib/companies.js";
import { saveVisibilidadeGrupo } from "../lib/groups.js";
import { WIDGET_CATALOG } from "../lib/dashboardWidgets.js";
import { MODULOS_COMPLEMENTARES, modulosAplicaveisAoAlvo } from "../lib/modulos.js";
import { BLOCOS_ENTRADAS_SAIDAS, abasDoAlvo, kAba, kItem, kSubaba, todasAsChaves } from "../lib/visibilidade.js";

// "Acesso dos clientes" de uma empresa ou grupo (pedido do Izaias, 28/10/2026): numa tela só, QUEM tem acesso e O QUE cada módulo mostra pra eles.
// Tudo começa DESMARCADO (29/10/2026): a equipe marca o que o cliente deve ver (aba inteira, subaba ou item), com "Marcar todos" pra agilizar. A configuração vale pra todas as pessoas daquela empresa/grupo
// (lib/visibilidade.js). Ocultar é só da tela — a segurança de verdade continua sendo a lista de quem tem acesso.
//
// As seções espelham o menu do site (30/11/2026 — pedido do Izaias): "Meu B.I." (as abas e subabas do B.I da empresa) e "Ferramentas" (os módulos; os que são só de
// algumas empresas, como o DRE Gerencial do Gestão Click, só aparecem pra elas). À direita, "Como o cliente vê" mostra o menu como o cliente vai enxergar, ao vivo.
// A equipe sempre vê tudo — pra conferir como o cliente, use o olhinho (visão do cliente) do topo.
const SECOES = [
  { id: "pessoas", nome: "Quem tem acesso", icone: Users },
  { id: "inicio", nome: "Início", fixa: "A página inicial do site. Aparece sempre para o cliente, com os atalhos para o que ele tem liberado." },
  { id: "bi", nome: "Meu B.I." },
  { id: "reforma", nome: "Reforma Tributária", fixa: "Informativo sobre a Reforma Tributária. Tem acesso próprio (Reforma Tributária, no console), independente do que está marcado aqui." },
  { id: "servicos", nome: "Serviços", fixa: "Área ainda sem conteúdo no site. Aparece no menu do cliente, mas não há nada para marcar aqui por enquanto." },
  { id: "conteudos", nome: "Conteúdos", fixa: "Guias da DRE, do balanço, do fluxo de caixa e dos indicadores. Aparece sempre para o cliente; por enquanto não dá para esconder por empresa." },
  { id: "ferramentas", nome: "Ferramentas", icone: Wrench },
];

function Caixa({ marcado, onChange, disabled, children, recuo = 0, forte = false }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-surface-muted ${disabled ? "opacity-45" : ""}`} style={{ marginLeft: recuo * 20 }}>
      <input type="checkbox" checked={marcado} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#e8681f]" />
      <span className={`min-w-0 truncate text-[13px] ${forte ? "font-semibold text-ink-900" : "text-ink-700"}`}>{children}</span>
      {!marcado && <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-ink-400"><EyeOff size={12} /> oculto</span>}
    </label>
  );
}

export default function AcessoClientesModal({ tipo, item, onClose, secaoInicial = "pessoas" }) {
  const ehGrupo = tipo === "grupo";
  const scopeType = ehGrupo ? "group" : "company";
  const { companies } = useAppState();
  // `secaoInicial` pode vir como o id de um módulo (versão antiga do menu): agora todos moram em "Ferramentas".
  const [secao, setSecao] = useState(SECOES.some((s) => s.id === secaoInicial) ? secaoInicial : MODULOS_COMPLEMENTARES.some((m) => m.id === secaoInicial) ? "ferramentas" : "pessoas");
  const configAnterior = item.visibilidade;
  const naoConfigurado = configAnterior?.modo !== "marcados" && !Array.isArray(configAnterior?.ocultos);
  const [visiveis, setVisiveis] = useState(() => {
    if (configAnterior?.modo === "marcados") return new Set(configAnterior.visiveis || []);
    // configuração antiga (lista de ocultos): converte pro que o cliente vê hoje, pra não mudar nada ao salvar
    if (Array.isArray(configAnterior?.ocultos)) { const oc = new Set(configAnterior.ocultos); return new Set(todasAsChaves(item).filter((k) => !oc.has(k))); }
    return new Set(); // ainda não configurado: tudo desmarcado
  });
  const configurado = Array.isArray(item.visibilidade?.modulos);
  const [modulos, setModulos] = useState(() => new Set(item.visibilidade?.modulos || []));
  // Como tudo abriu — pra só gravar o que a pessoa mexeu de verdade (ver salvar).
  const visiveisIniciais = useRef(visiveis);
  const modulosIniciais = useRef(modulos);
  const [grants, setGrants] = useState(null);
  const [fichas, setFichas] = useState(new Map());
  const [erro, setErro] = useState("");
  const [email, setEmail] = useState("");
  const [convidar, setConvidar] = useState(true);
  const [trabalhando, setTrabalhando] = useState(false);

  async function recarregar() {
    const [g, f] = await Promise.all([listAccessGrants(), listAccessPeople().catch(() => new Map())]);
    setGrants(g);
    setFichas(f);
    return { g, f };
  }
  useEffect(() => {
    recarregar()
      .then(({ g, f }) => {
        // empresa ainda sem módulos configurados: começa pelo que as fichas das pessoas dela já liberam hoje
        if (!configurado) {
          const uniao = new Set();
          g.filter((x) => x.scope_type === scopeType && x.scope_id === item.id).forEach((x) => (f.get(x.email)?.modulos || []).forEach((id) => uniao.add(id)));
          modulosIniciais.current = uniao;
          setModulos(uniao);
        }
      })
      .catch((err) => setErro(`Não consegui carregar os acessos: ${err.message || err}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doAlvo = useMemo(() => (grants || []).filter((x) => x.scope_type === scopeType && x.scope_id === item.id), [grants, scopeType, item.id]);
  const abas = useMemo(() => abasDoAlvo(item), [item]);
  const nomeWidget = (id) => WIDGET_CATALOG.find((d) => d.id === id)?.label || id;

  const marcarVisivel = (chave, visivel) =>
    setVisiveis((atual) => {
      const novo = new Set(atual);
      if (visivel) novo.add(chave);
      else novo.delete(chave);
      return novo;
    });
  const marcarVarias = (chaves, visivel) =>
    setVisiveis((atual) => {
      const novo = new Set(atual);
      chaves.forEach((k) => (visivel ? novo.add(k) : novo.delete(k)));
      return novo;
    });
  const chavesBi = useMemo(() => todasAsChaves(item).filter((k) => k.startsWith("bi:")), [item]);

  async function darAcesso() {
    const limpo = email.trim().toLowerCase();
    if (!limpo || !limpo.includes("@")) { setErro("Digite um e-mail válido."); return; }
    setTrabalhando(true);
    setErro("");
    try {
      await grantAccess({ email: limpo, scopeType, scopeId: item.id });
      if (convidar) await inviteUser(limpo).catch((e) => setErro(`Acesso dado, mas o convite por e-mail falhou: ${e.message || e}`));
      setEmail("");
      await recarregar();
    } catch (err) {
      setErro(`Não consegui dar o acesso: ${err.message || err}`);
    } finally {
      setTrabalhando(false);
    }
  }
  async function tirarAcesso(grant) {
    if (!window.confirm(`Tirar o acesso de ${fichas.get(grant.email)?.nome || grant.email} a ${item.name}?`)) return;
    setTrabalhando(true);
    try {
      await revokeAccess(grant.id);
      await recarregar();
    } catch (err) {
      setErro(`Não consegui tirar o acesso: ${err.message || err}`);
    } finally {
      setTrabalhando(false);
    }
  }

  // Grava só o que mudou: um grupo/empresa ainda sem configuração continua
  // assim (o cliente vê tudo; os módulos seguem a ficha de cada pessoa) se
  // ninguém mexeu naquela parte — antes, "Salvar alterações" depois de só
  // dar acesso a alguém gravava tudo desmarcado e o cliente perdia o B.I.
  function salvar() {
    const mudou = (inicial, atual) => inicial.size !== atual.size || [...atual].some((chave) => !inicial.has(chave));
    const mexeuNoBi = mudou(visiveisIniciais.current, visiveis);
    const mexeuNosModulos = mudou(modulosIniciais.current, modulos);
    const visibilidade = { ...(configAnterior || {}) };
    if (!naoConfigurado || mexeuNoBi) {
      Object.assign(visibilidade, { modo: "marcados", visiveis: [...visiveis] });
      delete visibilidade.ocultos;
    }
    if (configurado || mexeuNosModulos) visibilidade.modulos = [...modulos];
    if (naoConfigurado && !mexeuNoBi && !configurado && !mexeuNosModulos) {
      onClose();
      return;
    }
    if (ehGrupo) saveVisibilidadeGrupo(item.id, visibilidade);
    else saveVisibilidadeEmpresa(item.id, visibilidade);
    onClose();
  }

  const aplicaveis = useMemo(() => modulosAplicaveisAoAlvo(item, ehGrupo, companies), [item, ehGrupo, companies]);
  const abaTotal = abas.length;

  // ---- "Como o cliente vê": o menu do site com o que está marcado agora (mesmas regras de lib/visibilidade.js e lib/modulos.js)
  const mudou = (inicial, atual) => inicial.size !== atual.size || [...atual].some((chave) => !inicial.has(chave));
  const biLivre = naoConfigurado && !mudou(visiveisIniciais.current, visiveis); // ainda sem configuração e sem mexer: o cliente vê tudo
  const veBi = (chave) => biLivre || visiveis.has(chave);
  const modulosLivre = !configurado && !mudou(modulosIniciais.current, modulos); // sem lista da empresa: vale a ficha de cada pessoa
  const veModulo = (id) => modulosLivre || modulos.has(id);
  const abasVistas = abas.filter((aba) => veBi(kAba(aba.id))).map((aba) => ({
    ...aba,
    subs: (aba.subTabs || []).filter((sub) => veBi(kSubaba(aba.id, sub.id))),
  }));
  const ferramentasVistas = aplicaveis.filter((m) => veModulo(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <div className="flex h-[88vh] w-full max-w-[1360px] flex-col overflow-hidden rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Acesso dos clientes</span>
            <h2 className="mt-1 truncate text-[18px] font-semibold text-ink-900">{item.name}</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">Vale para todas as pessoas {ehGrupo ? "que abrem este grupo" : "desta empresa"}. {naoConfigurado ? "Ainda sem configuração: hoje o cliente vê tudo — só muda o que você marcar e salvar." : "Marque o que o cliente vê; o que ficar desmarcado fica oculto."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="w-[210px] shrink-0 overflow-y-auto border-r border-line bg-surface-muted/50 p-3">
            {SECOES.map((s) => (
              <button key={s.id} type="button" onClick={() => setSecao(s.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${secao === s.id ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : "text-ink-600 hover:bg-surface-card/70"}`}>
                {s.icone ? <s.icone size={14} /> : <Eye size={14} className="text-ink-400" />}
                <span className="truncate">{s.nome}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {erro && <p className="mb-3 rounded-lg bg-danger-500/10 px-3 py-2 text-[12.5px] text-danger-700">{erro}</p>}

            {secao === "pessoas" && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Quem tem acesso</h3>
                <p className="mt-1 text-[12.5px] text-ink-400">Pessoas que abrem {item.name}. Elas veem o que for configurado nas outras abas.</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && darAcesso()} placeholder="e-mail da pessoa" className="min-w-[240px] flex-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-[13px] outline-none focus:border-accent-500" />
                  <label className="flex items-center gap-1.5 text-[12.5px] text-ink-600"><input type="checkbox" checked={convidar} onChange={(e) => setConvidar(e.target.checked)} className="accent-[#e8681f]" /> enviar convite por e-mail</label>
                  <button type="button" onClick={darAcesso} disabled={trabalhando} className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50"><UserPlus size={14} /> Dar acesso</button>
                </div>
                <div className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {grants === null && <p className="p-4 text-[12.5px] text-ink-400">Carregando…</p>}
                  {grants && !doAlvo.length && <p className="p-4 text-[12.5px] text-ink-400">Ninguém tem acesso ainda.</p>}
                  {doAlvo.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-900">{fichas.get(g.email)?.nome || "Sem nome"}</p>
                        <p className="truncate text-[12px] text-ink-400">{g.email}</p>
                      </div>
                      <button type="button" onClick={() => tirarAcesso(g)} disabled={trabalhando} title="Tirar o acesso" className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong text-ink-500 hover:bg-surface-muted hover:text-danger-600 disabled:opacity-40"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {secao === "bi" && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Meu B.I.</h3>
                <p className="mt-1 text-[12.5px] text-ink-400">As abas e itens do B.I {ehGrupo ? "deste grupo" : "desta empresa"}. Marque o que o cliente deve ver: uma aba inteira, uma subaba ou só alguns itens (por exemplo, indicadores específicos).</p>
                {naoConfigurado && <p className="mt-3 rounded-lg bg-warning-500/10 px-3 py-2 text-[12px] text-warning-800">Ainda não configurado: hoje o cliente vê tudo. Ao salvar, ele passa a ver só o que estiver marcado aqui.</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => marcarVarias(chavesBi, true)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Marcar todos</button>
                  <button type="button" onClick={() => marcarVarias(chavesBi, false)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Desmarcar todos</button>
                </div>
                {!abaTotal && <p className="mt-4 text-[12.5px] text-ink-400">Esta {ehGrupo ? "grupo" : "empresa"} ainda não tem abas montadas no B.I (Personalizar).</p>}
                <div className="mt-4 flex flex-col gap-3">
                  {abas.map((aba) => {
                    const abaOculta = !visiveis.has(kAba(aba.id));
                    const subs = aba.subTabs || [];
                    return (
                      <div key={aba.id} className="rounded-xl border border-line p-2">
                        <Caixa forte marcado={!abaOculta} onChange={(v) => marcarVisivel(kAba(aba.id), v)}>{aba.name}</Caixa>
                        {!subs.length && (aba.widgets || []).map((w, i) => (
                          <Caixa key={`${w.id}-${i}`} recuo={1} marcado={!abaOculta && visiveis.has(kItem(aba.id, null, w.id))} disabled={abaOculta} onChange={(v) => marcarVisivel(kItem(aba.id, null, w.id), v)}>{nomeWidget(w.id)}</Caixa>
                        ))}
                        {subs.map((sub) => {
                          const subOculta = !visiveis.has(kSubaba(aba.id, sub.id));
                          return (
                            <div key={sub.id}>
                              <Caixa recuo={1} marcado={!abaOculta && !subOculta} disabled={abaOculta} onChange={(v) => marcarVisivel(kSubaba(aba.id, sub.id), v)}>{sub.name}</Caixa>
                              {(sub.widgets || []).map((w, i) => (
                                <Caixa key={`${w.id}-${i}`} recuo={2} marcado={!abaOculta && !subOculta && visiveis.has(kItem(aba.id, sub.id, w.id))} disabled={abaOculta || subOculta} onChange={(v) => marcarVisivel(kItem(aba.id, sub.id, w.id), v)}>{nomeWidget(w.id)}</Caixa>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {SECOES.find((x) => x.id === secao)?.fixa && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">{SECOES.find((x) => x.id === secao).nome}</h3>
                <p className="mt-2 max-w-xl rounded-xl border border-line bg-surface-muted/50 px-4 py-3 text-[12.5px] leading-relaxed text-ink-600">{SECOES.find((x) => x.id === secao).fixa}</p>
              </div>
            )}

            {secao === "ferramentas" && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Ferramentas</h3>
                <p className="mt-1 text-[12.5px] text-ink-400">Os módulos da área Ferramentas do site. Marque os que o cliente {ehGrupo ? "do grupo" : "da empresa"} vê. Os que são só de algumas empresas (como o DRE Gerencial do Gestão Click) só aparecem aqui para elas.</p>
                {!configurado && <p className="mt-3 rounded-lg bg-warning-500/10 px-3 py-2 text-[12px] text-warning-800">Ainda sem lista: hoje valem as fichas de cada pessoa. Ao salvar, esta lista passa a valer para todos {ehGrupo ? "do grupo" : "da empresa"}.</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setModulos(new Set(aplicaveis.map((m) => m.id)))} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Marcar todos</button>
                  <button type="button" onClick={() => setModulos(new Set())} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Desmarcar todos</button>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {aplicaveis.map((modulo) => (
                    <div key={modulo.id} className="rounded-xl border border-line p-2">
                      <Caixa forte marcado={modulos.has(modulo.id)} onChange={(v) => setModulos((atual) => { const novo = new Set(atual); if (v) novo.add(modulo.id); else novo.delete(modulo.id); return novo; })}>{modulo.nome}</Caixa>
                      <p className="ml-[38px] pb-1 text-[11.5px] text-ink-400">{modulo.descricao}</p>
                      {modulo.id === "entradas-saidas" && BLOCOS_ENTRADAS_SAIDAS.map((b) => (
                        <Caixa key={b.id} recuo={1} marcado={visiveis.has(b.id)} disabled={!modulos.has("entradas-saidas")} onChange={(v) => marcarVisivel(b.id, v)}>{b.nome}</Caixa>
                      ))}
                    </div>
                  ))}
                </div>
                {aplicaveis.some((m) => m.id === "entradas-saidas") && <p className="mt-2 text-[11.5px] text-ink-400">Em Entradas x Saídas, a tabela de acumuladores é sempre só da equipe.</p>}
              </div>
            )}
          </div>

          {secao !== "pessoas" && (
            <PreviaCliente secao={secao} nomeAlvo={item.name} abasVistas={abasVistas} ferramentasVistas={ferramentasVistas} ferramentasPelaFicha={modulosLivre} veBi={veBi} nomeWidget={nomeWidget} semConfiguracao={biLivre || modulosLivre} textoFixa={SECOES.find((x) => x.id === secao)?.fixa || null} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">Cancelar</button>
          <button type="button" onClick={salvar} className="rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600">Salvar alterações</button>
        </div>
      </div>
    </div>
  );
}
