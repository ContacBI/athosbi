import { useEffect } from "react";
import { AlertTriangle, Check, IdCard, Loader2, Plus, Search, Target, PenTool, X } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import SelectField from "../components/SelectField.jsx";
import { DEFAULT_NATURE_RULES, NATURE_LABELS, NATURE_ORDER, formatPrefixList } from "../lib/accountNature.js";
import { pickablePessoas } from "../lib/colaboradores.js";
import { formatCnpj } from "../lib/cnpj.js";
import { INDICATOR_GOALS, formatGoal } from "../lib/metas.js";
import { useCadastroDaEmpresa } from "../lib/useCadastroDaEmpresa.js";

// Cadastro/edição de empresa NO CONSOLE da equipe, no visual do hub (hub.css). Mesma lógica do modal do portal (lib/useCadastroDaEmpresa.js); a diferença é o visual e o
// campo "Buscar na Domínio": digita o código, o nome ou o CNPJ, escolhe, e já vêm código, nome, CNPJ e cidade (o CNPJ completa a atividade). Também avisa de código/CNPJ
// que não batem com a Domínio (a Central recusaria o envio) e de empresa já cadastrada no portal.
//
// Tamanho FIXO: a janela tem sempre a mesma altura, em qualquer aba, e a aba "Dados gerais" cabe inteira sem barra de rolagem (a rolagem só aparece em tela muito baixa).
// Clicar fora não fecha (para não perder o que foi digitado): só no X, no Cancelar ou no Esc.

const campo = "mt-1 h-9 w-full rounded-lg border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] px-3 text-[13px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)] focus:border-[var(--hub-acento)]";
const rotulo = "text-[11.5px] font-semibold text-[var(--hub-texto-2)]";

function Secao({ titulo, texto, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-4 py-3 ${className}`}>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hub-texto-3)]">{titulo}</h3>
      {texto && <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--hub-texto-2)]">{texto}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Aviso({ tom = "info", children }) {
  const cores = {
    ok: "text-emerald-600",
    alerta: "text-amber-600",
    info: "text-[var(--hub-texto-3)]",
  };
  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug ${cores[tom]}`}>
      {tom === "ok" ? <Check size={13} className="mt-px shrink-0" /> : tom === "alerta" ? <AlertTriangle size={13} className="mt-px shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}

function Pessoas({ emails, pessoas, onRemover }) {
  if (!emails.length) return null;
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {emails.map((email) => {
        const nome = pessoas.find((pessoa) => pessoa.email === email)?.nome || email;
        return (
          <span key={email} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] py-0.5 pl-0.5 pr-2 text-[12px] font-medium text-[var(--hub-texto)]">
            <Avatar name={nome} size={20} />
            {nome}
            <button type="button" onClick={() => onRemover(email)} aria-label={`Tirar ${nome}`} className="text-[var(--hub-texto-3)] hover:text-[var(--hub-texto)]"><X size={12} /></button>
          </span>
        );
      })}
    </div>
  );
}

export default function EditorEmpresa({ company = null, onClose, onSubmit }) {
  const c = useCadastroDaEmpresa(company, { dominio: true });
  const { isEditing, name, codigo, cnpj, municipio, uf, atividade, lookupState, tab, setTab, error, conferencia, duplicadas, listaDominio, erroDominio, sugestoes, buscaDominio } = c;

  useEffect(() => {
    const fecha = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", fecha);
    return () => window.removeEventListener("keydown", fecha);
  }, [onClose]);

  const abas = [
    { id: "dados", rotulo: "Dados gerais", icone: IdCard },
    { id: "assinaturas", rotulo: "Assinaturas", icone: PenTool },
    { id: "metas", rotulo: "Metas", icone: Target },
  ];
  const subtitulo = [codigo && `Código ${codigo}`, cnpj && `CNPJ ${cnpj}`, [municipio, uf].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[3px]">
      <form onSubmit={c.handleSubmit(onSubmit)} className="flex h-[680px] max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)] shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar name={name || "Nova empresa"} size={42} />
            <div className="min-w-0">
              <p className="hub-rotulo">{isEditing ? "Editar cadastro" : "Nova empresa"}</p>
              <h2 className="truncate text-[19px] font-extrabold leading-tight text-[var(--hub-texto)]">{name || "Cadastrar empresa"}</h2>
              <p className="min-h-[1.1em] truncate text-[12px] text-[var(--hub-texto-3)]">{subtitulo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--hub-borda)] text-[var(--hub-texto-2)] hover:text-[var(--hub-texto)]"><X size={16} /></button>
        </div>

        <div className="flex gap-1.5 border-b border-[var(--hub-borda)] px-6 pb-2.5">
          {abas.map((aba) => (
            <button key={aba.id} type="button" onClick={() => setTab(aba.id)} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${tab === aba.id ? "bg-[var(--hub-acento)] text-white shadow-md" : "text-[var(--hub-texto-2)] hover:bg-[var(--hub-cartao)]"}`}>
              <aba.icone size={14} strokeWidth={2} />
              {aba.rotulo}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {tab === "dados" && (
            <div className="grid grid-cols-12 gap-3">
              <Secao titulo="Buscar na Domínio" className="col-span-5">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hub-texto-3)]" />
                  <input value={buscaDominio} onChange={(event) => c.setBuscaDominio(event.target.value)} placeholder={listaDominio === null ? "Carregando a lista da Domínio…" : "Código, nome ou CNPJ — ex.: 120"} disabled={!listaDominio?.length} className={`${campo} mt-0 pl-9 disabled:opacity-60`} />
                  {buscaDominio.trim() && (
                    <ul className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-auto rounded-xl border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)] p-1 shadow-xl" role="listbox">
                      {sugestoes.length === 0 && <li className="px-3 py-2 text-[12.5px] text-[var(--hub-texto-3)]">Nada encontrado na Domínio.</li>}
                      {sugestoes.map((empresa) => (
                        <li key={empresa.codigo}>
                          <button type="button" onClick={() => c.escolherDaDominio(empresa)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--hub-cartao)]">
                            <span className="w-12 shrink-0 text-[12.5px] font-bold tabular-nums text-[var(--hub-acento)]">{empresa.codigo}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-[var(--hub-texto)]">{empresa.nome}</span>
                              <span className="block truncate text-[11.5px] text-[var(--hub-texto-3)]">{[empresa.cnpj ? formatCnpj(empresa.cnpj) : "sem CNPJ", [empresa.cidade, empresa.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</span>
                            </span>
                            {empresa.situacao === "I" && <span className="shrink-0 rounded-full border border-[var(--hub-borda)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--hub-texto-3)]">inativa</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="min-h-[2.6rem]">
                  {listaDominio !== null && !listaDominio.length && <Aviso tom="info">{erroDominio || "A lista da Domínio ainda não chegou da Central. Dá para preencher à mão."}</Aviso>}
                  {conferencia.tipo === "ok" && <Aviso tom="ok">Confere com a Domínio: {conferencia.empresa.codigo} · {conferencia.empresa.nome}.</Aviso>}
                  {conferencia.tipo === "cnpj-diferente" && <Aviso tom="alerta">Na Domínio, o código {conferencia.empresa.codigo} é {conferencia.empresa.nome} (CNPJ {formatCnpj(conferencia.empresa.cnpj)}). A Central vai recusar o envio até os dois baterem.</Aviso>}
                  {conferencia.tipo === "codigo-inexistente" && <Aviso tom="alerta">A Domínio não tem empresa com o código {codigo}; a Central só envia as que existem lá.</Aviso>}
                  {duplicadas.length > 0 && <Aviso tom="alerta">Já cadastrada no portal: {duplicadas.map((empresa) => `${empresa.name} (${empresa.codigo || "—"})`).join("; ")}.</Aviso>}
                </div>
              </Secao>

              <Secao titulo="Identificação" className="col-span-7">
                <div className="grid grid-cols-6 gap-3">
                  <label className={`${rotulo} col-span-1`}>
                    Código
                    <input value={codigo} onChange={(event) => c.setCodigo(event.target.value)} placeholder="120" className={campo} />
                  </label>
                  <label className={`${rotulo} col-span-2`}>
                    CNPJ
                    <span className="relative block">
                      <input value={cnpj} onChange={c.handleCnpjChange} placeholder="00.000.000/0000-00" inputMode="numeric" className={campo} />
                      {lookupState === "loading" && <Loader2 size={14} className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 animate-spin text-[var(--hub-acento)]" />}
                    </span>
                  </label>
                  <label className={`${rotulo} col-span-3`}>
                    Nome da empresa *
                    <input value={name} onChange={(event) => c.setName(event.target.value)} placeholder="Vem da Domínio ou do CNPJ" className={campo} />
                  </label>
                </div>
                <p className="mt-2 min-h-[2.4rem] text-[11.5px] leading-snug text-[var(--hub-texto-2)]">
                  <span className="font-semibold text-[var(--hub-texto)]">{atividade || "Atividade não informada"}</span>
                  {(municipio || uf) && <span className="text-[var(--hub-texto-3)]"> · {[municipio, uf].filter(Boolean).join(" / ")}</span>}
                </p>
              </Secao>

              <Secao titulo={`Plano de contas${isEditing ? "" : " *"}`} className="col-span-4">
                <SelectField placeholder="Selecione o plano de contas" options={c.planoOptions} value={c.planoPadraoId} onChange={c.setPlanoPadraoId} emptyText="Nenhum plano padrão criado ainda." />
                {c.novoPlanoOpen ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input autoFocus value={c.novoPlanoNome} onChange={(event) => c.setNovoPlanoNome(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); c.handleCreatePlano(); } }} placeholder="Nome do plano" className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] px-2.5 text-[12.5px] text-[var(--hub-texto)] outline-none focus:border-[var(--hub-acento)]" />
                    <button type="button" onClick={c.handleCreatePlano} className="h-8 rounded-lg bg-[var(--hub-acento)] px-3 text-[12.5px] font-semibold text-white">Criar</button>
                    <button type="button" onClick={() => c.setNovoPlanoOpen(false)} className="h-8 px-1.5 text-[12.5px] text-[var(--hub-texto-2)]">Cancelar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => c.setNovoPlanoOpen(true)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--hub-acento)]"><Plus size={13} strokeWidth={2.4} /> Criar plano padrão</button>
                )}
                <p className="mt-2 text-[11.5px] leading-snug text-[var(--hub-texto-3)]">Empresas no mesmo plano compartilham as contas extras e o De/Para.</p>
              </Secao>

              <Secao titulo="Responsáveis *" className="col-span-4">
                <Pessoas emails={c.responsaveis} pessoas={c.pessoas} onRemover={c.toggleResponsavel} />
                <SelectField placeholder="Adicionar responsável" options={pickablePessoas(c.pessoas, c.responsaveis).map((pessoa) => ({ value: pessoa.email, label: pessoa.nome || pessoa.email }))} values={c.responsaveis} onToggle={c.toggleResponsavel} emptyText="Nenhum colaborador cadastrado ainda." />
                <p className="mt-2 text-[11.5px] leading-snug text-[var(--hub-texto-3)]">Só eles (e você) editam; os demais só visualizam.</p>
              </Secao>

              <Secao titulo="Modelo da DFC" className="col-span-4">
                <div className="flex flex-col gap-1.5">
                  {[
                    { value: "padrao", titulo: "Modelo 1 (recomendado)", texto: "DFC padrão do portal." },
                    { value: "instituto", titulo: "Modelo 2", texto: "Estrutura e contas da Domínio (sindicatos, institutos)." },
                  ].map((opcao) => (
                    <label key={opcao.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${c.dfcModelo === opcao.value ? "border-[var(--hub-acento)] bg-[var(--hub-acento-suave)]" : "border-[var(--hub-borda)] hover:bg-[var(--hub-cartao)]"}`}>
                      <input type="radio" name="dfcModelo" value={opcao.value} checked={c.dfcModelo === opcao.value} onChange={() => c.setDfcModelo(opcao.value)} className="mt-0.5 h-3.5 w-3.5 accent-[#e8691f]" />
                      <span>
                        <span className="block text-[12.5px] font-semibold leading-tight text-[var(--hub-texto)]">{opcao.titulo}</span>
                        <span className="block text-[11px] leading-snug text-[var(--hub-texto-2)]">{opcao.texto}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Secao>

              <Secao titulo="Faixas de classificação do De/Para" texto="Prefixos da classificação contábil por natureza — vários separados por vírgula." className="col-span-12">
                <div className="grid grid-cols-4 gap-3">
                  {NATURE_ORDER.map((natureza) => (
                    <label key={natureza} className={rotulo}>
                      {NATURE_LABELS[natureza]}
                      <input value={c.natureText[natureza]} onChange={(event) => c.setNatureText((anterior) => ({ ...anterior, [natureza]: event.target.value }))} placeholder={formatPrefixList(DEFAULT_NATURE_RULES[natureza])} className={campo} />
                    </label>
                  ))}
                </div>
              </Secao>
            </div>
          )}

          {tab === "assinaturas" && (
            <div className="grid grid-cols-2 gap-3">
              <Secao titulo="Contador" texto="Responsável contábil da empresa.">
                <SelectField placeholder="Selecione o(s) contador(es)" options={c.contadores.map((representante) => ({ value: representante.id, label: representante.nome, hint: representante.email }))} values={c.representanteIds.filter((id) => c.contadores.some((representante) => representante.id === id))} onToggle={c.toggleRepresentante} emptyText="Nenhum contador cadastrado ainda em Parâmetros → Representantes." />
              </Secao>
              <Secao titulo="Representante (sócio)" texto="Sócio(s) da empresa.">
                <SelectField placeholder="Selecione o(s) sócio(s)" options={c.socios.map((representante) => ({ value: representante.id, label: representante.nome, hint: representante.email }))} values={c.representanteIds.filter((id) => c.socios.some((representante) => representante.id === id))} onToggle={c.toggleRepresentante} emptyText="Nenhum sócio cadastrado ainda em Parâmetros → Representantes." />
              </Secao>
            </div>
          )}

          {tab === "metas" && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12px] leading-snug text-[var(--hub-texto-2)]">A régua desta empresa para os alertas do assistente de slides e o radar de indicadores do B.I. Em branco, vale o padrão geral.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {INDICATOR_GOALS.map((meta) => (
                  <label key={meta.id} className="grid grid-cols-[1fr_150px] items-center gap-3 rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-4 py-2.5">
                    <span>
                      <span className="block text-[12.5px] font-semibold text-[var(--hub-texto)]">{meta.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--hub-texto-2)]">{meta.help}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <input value={c.metas[meta.id]} onChange={(event) => c.setMetas((atual) => ({ ...atual, [meta.id]: event.target.value }))} placeholder={`padrão: ${formatGoal(meta.id, meta.default)}`} inputMode="decimal" className={`empresa-meta-${meta.id} h-8 w-full rounded-lg border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)] px-2.5 text-right text-[12.5px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)] focus:border-[var(--hub-acento)]`} />
                      <span className="w-9 shrink-0 text-[11px] text-[var(--hub-texto-3)]">{meta.unit}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--hub-borda)] px-6 py-3">
          <p className="min-h-[1em] text-[12.5px] font-medium text-rose-600" role="alert">{error}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} className="hub-botao hub-botao-fantasma hub-botao-p">Cancelar</button>
            <button type="submit" className="hub-botao hub-botao-primario hub-botao-p">{isEditing ? "Salvar alterações" : "Cadastrar empresa"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
