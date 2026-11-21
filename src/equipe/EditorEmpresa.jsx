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

const campo = "mt-1.5 h-11 w-full rounded-xl border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] px-3.5 text-[14px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)] focus:border-[var(--hub-acento)]";
const rotulo = "text-[12px] font-semibold text-[var(--hub-texto-2)]";

function Secao({ titulo, texto, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)] p-5 ${className}`}>
      <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--hub-texto-3)]">{titulo}</h3>
      {texto && <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--hub-texto-2)]">{texto}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Aviso({ tom = "info", children }) {
  const cores = {
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
    alerta: "border-amber-500/50 bg-amber-500/10 text-amber-700",
    info: "border-[var(--hub-borda)] bg-[var(--hub-cartao)] text-[var(--hub-texto-2)]",
  };
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-snug ${cores[tom]}`}>
      {tom === "ok" ? <Check size={15} className="mt-0.5 shrink-0" /> : tom === "alerta" ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : null}
      <span>{children}</span>
    </div>
  );
}

function Pessoas({ emails, pessoas, onRemover }) {
  if (!emails.length) return null;
  return (
    <div className="mb-2.5 flex flex-wrap gap-2">
      {emails.map((email) => {
        const nome = pessoas.find((pessoa) => pessoa.email === email)?.nome || email;
        return (
          <span key={email} className="inline-flex items-center gap-2 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] py-1 pl-1 pr-2.5 text-[12.5px] font-medium text-[var(--hub-texto)]">
            <Avatar name={nome} size={22} />
            {nome}
            <button type="button" onClick={() => onRemover(email)} aria-label={`Tirar ${nome}`} className="text-[var(--hub-texto-3)] hover:text-[var(--hub-texto)]"><X size={13} /></button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[3px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={c.handleSubmit(onSubmit)} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--hub-borda)] px-7 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={name || "Nova empresa"} size={52} />
            <div className="min-w-0">
              <p className="hub-rotulo">{isEditing ? "Editar cadastro" : "Nova empresa"}</p>
              <h2 className="mt-1 truncate text-[22px] font-extrabold leading-tight text-[var(--hub-texto)]">{name || "Cadastrar empresa"}</h2>
              {subtitulo && <p className="mt-0.5 truncate text-[13px] text-[var(--hub-texto-3)]">{subtitulo}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--hub-borda)] text-[var(--hub-texto-2)] hover:text-[var(--hub-texto)]"><X size={18} /></button>
        </div>

        <div className="flex gap-2 border-b border-[var(--hub-borda)] px-7 py-3">
          {abas.map((aba) => (
            <button key={aba.id} type="button" onClick={() => setTab(aba.id)} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${tab === aba.id ? "bg-[var(--hub-acento)] text-white shadow-md" : "text-[var(--hub-texto-2)] hover:bg-[var(--hub-cartao)]"}`}>
              <aba.icone size={15} strokeWidth={2} />
              {aba.rotulo}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {tab === "dados" && (
            <div className="flex flex-col gap-5">
              <Secao titulo="Buscar na Domínio" texto="Digite o código, o nome ou o CNPJ da empresa na Domínio, escolha na lista, e o cadastro se preenche sozinho.">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--hub-texto-3)]" />
                  <input value={buscaDominio} onChange={(event) => c.setBuscaDominio(event.target.value)} placeholder={listaDominio === null ? "Carregando a lista da Domínio…" : "Ex.: 120, Anjos Catuaí ou 31.923.481/0001-30"} disabled={!listaDominio?.length} className={`${campo} mt-0 pl-11 disabled:opacity-60`} />
                  {buscaDominio.trim() && (
                    <ul className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)] p-1.5 shadow-xl" role="listbox">
                      {sugestoes.length === 0 && <li className="px-3 py-2.5 text-[13px] text-[var(--hub-texto-3)]">Nada encontrado na Domínio.</li>}
                      {sugestoes.map((empresa) => (
                        <li key={empresa.codigo}>
                          <button type="button" onClick={() => c.escolherDaDominio(empresa)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--hub-cartao)]">
                            <span className="w-14 shrink-0 text-[13px] font-bold tabular-nums text-[var(--hub-acento)]">{empresa.codigo}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold text-[var(--hub-texto)]">{empresa.nome}</span>
                              <span className="block truncate text-[12px] text-[var(--hub-texto-3)]">{[empresa.cnpj ? formatCnpj(empresa.cnpj) : "sem CNPJ", [empresa.cidade, empresa.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</span>
                            </span>
                            {empresa.situacao === "I" && <span className="shrink-0 rounded-full border border-[var(--hub-borda)] px-2 py-0.5 text-[10.5px] font-semibold uppercase text-[var(--hub-texto-3)]">inativa</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {listaDominio !== null && !listaDominio.length && <Aviso tom="info">{erroDominio || "A lista da Domínio ainda não chegou da Central (ela manda uma vez por dia). Dá para preencher à mão."}</Aviso>}
                {conferencia.tipo === "ok" && <Aviso tom="ok">Confere com a Domínio: {conferencia.empresa.codigo} · {conferencia.empresa.nome}.</Aviso>}
                {conferencia.tipo === "cnpj-diferente" && <Aviso tom="alerta">Na Domínio, o código {conferencia.empresa.codigo} é <b>{conferencia.empresa.nome}</b> (CNPJ {formatCnpj(conferencia.empresa.cnpj)}). O CNPJ digitado é outro — a Central vai recusar o envio dessa empresa até os dois baterem.</Aviso>}
                {conferencia.tipo === "codigo-inexistente" && <Aviso tom="alerta">A Domínio não tem nenhuma empresa com o código {codigo}. A Central só consegue enviar empresas que existem lá.</Aviso>}
                {duplicadas.length > 0 && <Aviso tom="alerta">Já cadastrada no portal: {duplicadas.map((empresa) => `${empresa.name} (código ${empresa.codigo || "—"})`).join("; ")}.</Aviso>}
              </Secao>

              <Secao titulo="Identificação">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <label className={`${rotulo} md:col-span-1`}>
                    Código
                    <input value={codigo} onChange={(event) => c.setCodigo(event.target.value)} placeholder="Ex.: 120" className={campo} />
                  </label>
                  <label className={`${rotulo} md:col-span-2`}>
                    CNPJ
                    <span className="relative block">
                      <input value={cnpj} onChange={c.handleCnpjChange} placeholder="00.000.000/0000-00" inputMode="numeric" className={campo} />
                      {lookupState === "loading" && <Loader2 size={15} className="absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 animate-spin text-[var(--hub-acento)]" />}
                    </span>
                  </label>
                  <label className={`${rotulo} md:col-span-3`}>
                    Nome da empresa *
                    <input value={name} onChange={(event) => c.setName(event.target.value)} placeholder="Preenche pela Domínio ou pelo CNPJ" className={campo} />
                  </label>
                </div>
                {(atividade || municipio || uf) && (
                  <div className="mt-4 rounded-xl bg-[var(--hub-borda)]/40 px-4 py-3 text-[12.5px] text-[var(--hub-texto-2)]">
                    <p className="font-semibold text-[var(--hub-texto)]">{atividade || "Atividade não informada"}</p>
                    {(municipio || uf) && <p className="mt-0.5 text-[var(--hub-texto-3)]">{[municipio, uf].filter(Boolean).join(" / ")}</p>}
                  </div>
                )}
              </Secao>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Secao titulo={`Plano de contas${isEditing ? "" : " *"}`} texto="Empresas no mesmo plano compartilham as contas extras dele e o De/Para se propaga entre elas.">
                  <SelectField placeholder="Selecione o plano de contas" options={c.planoOptions} value={c.planoPadraoId} onChange={c.setPlanoPadraoId} emptyText="Nenhum plano padrão criado ainda." />
                  {c.novoPlanoOpen ? (
                    <div className="mt-2.5 flex items-center gap-2">
                      <input autoFocus value={c.novoPlanoNome} onChange={(event) => c.setNovoPlanoNome(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); c.handleCreatePlano(); } }} placeholder="Nome do plano padrão" className="h-10 flex-1 rounded-xl border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] px-3 text-[13px] text-[var(--hub-texto)] outline-none focus:border-[var(--hub-acento)]" />
                      <button type="button" onClick={c.handleCreatePlano} className="h-10 rounded-xl bg-[var(--hub-acento)] px-3.5 text-[13px] font-semibold text-white">Criar</button>
                      <button type="button" onClick={() => c.setNovoPlanoOpen(false)} className="h-10 rounded-xl px-3 text-[13px] text-[var(--hub-texto-2)]">Cancelar</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => c.setNovoPlanoOpen(true)} className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--hub-acento)]"><Plus size={14} strokeWidth={2.4} /> Criar plano padrão</button>
                  )}
                </Secao>
                <Secao titulo="Responsáveis *" texto="Só quem estiver marcado aqui (além de você) edita essa empresa — os demais só visualizam, como um cliente.">
                  <Pessoas emails={c.responsaveis} pessoas={c.pessoas} onRemover={c.toggleResponsavel} />
                  <SelectField placeholder="Adicionar responsável" options={pickablePessoas(c.pessoas, c.responsaveis).map((pessoa) => ({ value: pessoa.email, label: pessoa.nome || pessoa.email }))} values={c.responsaveis} onToggle={c.toggleResponsavel} emptyText="Nenhum colaborador cadastrado ainda. Cadastre em Parâmetros → Colaborar." />
                </Secao>
              </div>

              <Secao titulo="Modelo da DFC">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    { value: "padrao", titulo: "Modelo 1 (recomendado)", texto: "DFC padrão do portal, igual à da maioria das empresas." },
                    { value: "instituto", titulo: "Modelo 2", texto: "Mesma estrutura e mesmas contas cadastradas na Domínio (ex.: sindicatos e institutos). A Central traz o modelo sozinha." },
                  ].map((opcao) => (
                    <label key={opcao.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${c.dfcModelo === opcao.value ? "border-[var(--hub-acento)] bg-[var(--hub-acento-suave)]" : "border-[var(--hub-borda)] hover:bg-[var(--hub-cartao)]"}`}>
                      <input type="radio" name="dfcModelo" value={opcao.value} checked={c.dfcModelo === opcao.value} onChange={() => c.setDfcModelo(opcao.value)} className="mt-1 h-4 w-4 accent-[#e8691f]" />
                      <span>
                        <span className="block text-[14px] font-semibold text-[var(--hub-texto)]">{opcao.titulo}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--hub-texto-2)]">{opcao.texto}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Secao>

              <Secao titulo="Faixas de classificação do De/Para" texto="Prefixos da classificação contábil para cada natureza — separe vários por vírgula.">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {NATURE_ORDER.map((natureza) => (
                    <label key={natureza} className={rotulo}>
                      {NATURE_LABELS[natureza]}
                      <input value={c.natureText[natureza]} onChange={(event) => c.setNatureText((anterior) => ({ ...anterior, [natureza]: event.target.value }))} placeholder={formatPrefixList(DEFAULT_NATURE_RULES[natureza])} className={`${campo} h-10 text-[13px]`} />
                    </label>
                  ))}
                </div>
              </Secao>
            </div>
          )}

          {tab === "assinaturas" && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Secao titulo="Contador" texto="Responsável contábil da empresa.">
                <SelectField placeholder="Selecione o(s) contador(es)" options={c.contadores.map((representante) => ({ value: representante.id, label: representante.nome, hint: representante.email }))} values={c.representanteIds.filter((id) => c.contadores.some((representante) => representante.id === id))} onToggle={c.toggleRepresentante} emptyText="Nenhum contador cadastrado ainda em Parâmetros → Representantes." />
              </Secao>
              <Secao titulo="Representante (sócio)" texto="Sócio(s) da empresa.">
                <SelectField placeholder="Selecione o(s) sócio(s)" options={c.socios.map((representante) => ({ value: representante.id, label: representante.nome, hint: representante.email }))} values={c.representanteIds.filter((id) => c.socios.some((representante) => representante.id === id))} onToggle={c.toggleRepresentante} emptyText="Nenhum sócio cadastrado ainda em Parâmetros → Representantes." />
              </Secao>
            </div>
          )}

          {tab === "metas" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed text-[var(--hub-texto-2)]">A régua desta empresa para os alertas do assistente de slides e o radar de indicadores do B.I. Em branco, vale o padrão (a referência geral, igual para todas as empresas).</p>
              {INDICATOR_GOALS.map((meta) => (
                <label key={meta.id} className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-5 py-4 md:grid-cols-[1fr_200px]">
                  <span>
                    <span className="block text-[14px] font-semibold text-[var(--hub-texto)]">{meta.label}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--hub-texto-2)]">{meta.help}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <input value={c.metas[meta.id]} onChange={(event) => c.setMetas((atual) => ({ ...atual, [meta.id]: event.target.value }))} placeholder={`padrão: ${formatGoal(meta.id, meta.default)}`} inputMode="decimal" className={`empresa-meta-${meta.id} h-10 w-full rounded-xl border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)] px-3 text-right text-[13px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)] focus:border-[var(--hub-acento)]`} />
                    <span className="w-12 shrink-0 text-[12px] text-[var(--hub-texto-3)]">{meta.unit}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--hub-borda)] px-7 py-4">
          <p className="min-h-[1em] text-[13px] font-medium text-rose-600" role="alert">{error}</p>
          <div className="flex shrink-0 gap-2.5">
            <button type="button" onClick={onClose} className="hub-botao hub-botao-fantasma hub-botao-p">Cancelar</button>
            <button type="submit" className="hub-botao hub-botao-primario hub-botao-p">{isEditing ? "Salvar alterações" : "Cadastrar empresa"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
