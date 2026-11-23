import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Eye, Search } from "lucide-react";
import { listAccessGrants, listAccessPeople } from "../lib/access.js";
import { entrarNoModo, sairDaPessoa } from "../lib/modoEquipe.js";
import { comoPessoa, filtrarPessoas, pessoasParaVerComo } from "../lib/verComo.js";
import Avatar from "../components/Avatar.jsx";

// "Ver como": troca a tela entre a visão geral (tudo) e a de UMA pessoa de um cliente — com o tipo de acesso dela (Financeiro, Comercial…). Só leitura.
export default function VerComo({ state }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [dados, setDados] = useState(null);
  const vista = state.pessoaVista;

  useEffect(() => {
    if (!aberto || dados) return;
    Promise.all([listAccessGrants(), listAccessPeople()])
      .then(([grants, fichas]) => setDados({ grants, fichas }))
      .catch(() => setDados({ grants: [], fichas: new Map(), erro: true }));
  }, [aberto, dados]);

  const pessoas = useMemo(() => (dados ? pessoasParaVerComo({ ...dados, companies: state.companies, groups: state.groups }) : []), [dados, state.companies, state.groups]);
  const lista = useMemo(() => filtrarPessoas(pessoas, termo), [pessoas, termo]);

  function escolher(pessoa) {
    setAberto(false);
    if (pessoa) entrarNoModo("portal", { pessoa: comoPessoa(pessoa) });
    else sairDaPessoa();
    navigate("/hub");
  }

  const rotulo = vista ? String(vista.nome || vista.email).split(/[ @]/)[0] : "Visão geral";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Ver o portal exatamente como uma pessoa de um cliente vê"
        className={`flex h-10 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition-colors ${vista ? "border-[var(--hub-acento)] bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]" : "border-[var(--hub-borda)] bg-[var(--hub-cartao)] text-[var(--hub-texto-2)] hover:border-[var(--hub-borda-forte)]"}`}
      >
        <Eye size={15} />
        <span className="hidden max-w-[130px] truncate sm:block">{vista ? `Como ${rotulo}` : "Ver como"}</span>
        <ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] max-w-[92vw] overflow-hidden rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] p-1.5 shadow-[var(--hub-sombra-forte)]">
            <div className="px-3 pb-2 pt-2">
              <p className="text-[13.5px] font-semibold text-[var(--hub-texto)]">Ver como</p>
              <p className="text-[12px] text-[var(--hub-texto-3)]">A tela exata de uma pessoa do cliente, com o tipo de acesso dela. Só leitura.</p>
            </div>
            <button type="button" onClick={() => escolher(null)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[var(--hub-texto-2)] hover:bg-[var(--hub-acento-suave)] hover:text-[var(--hub-texto)]">
              <Eye size={15} /> <span className="flex-1">Visão geral (todas as empresas)</span> {!vista && <Check size={15} className="text-[var(--hub-acento)]" />}
            </button>
            <div className="my-1 h-px bg-[var(--hub-borda)]" />
            <label className="mx-2 mb-1 flex items-center gap-2 rounded-xl border border-[var(--hub-borda)] px-2.5 py-1.5">
              <Search size={14} className="text-[var(--hub-texto-3)]" />
              <input autoFocus value={termo} onChange={(event) => setTermo(event.target.value)} placeholder="Nome, e-mail, empresa ou tipo de acesso" className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--hub-texto-3)]" />
            </label>
            <div className="max-h-[340px] overflow-y-auto">
              {!dados && <p className="px-3 py-4 text-[13px] text-[var(--hub-texto-3)]">Carregando as pessoas…</p>}
              {dados?.erro && <p className="px-3 py-4 text-[13px] text-[var(--hub-texto-3)]">Não consegui ler a lista de pessoas.</p>}
              {dados && !dados.erro && lista.length === 0 && <p className="px-3 py-4 text-[13px] text-[var(--hub-texto-3)]">{pessoas.length ? "Ninguém com esse nome." : "Nenhum cliente com acesso liberado ainda."}</p>}
              {lista.map((pessoa) => (
                <button key={pessoa.email} type="button" onClick={() => escolher(pessoa)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--hub-acento-suave)]">
                  <Avatar name={pessoa.nome || pessoa.email} size={32} className="rounded-full" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--hub-texto)]">{pessoa.nome || pessoa.email}</span>
                    <span className="block truncate text-[11.5px] text-[var(--hub-texto-3)]">
                      {pessoa.onde.join(", ")}
                      {pessoa.maisOnde ? ` +${pessoa.maisOnde}` : ""}
                    </span>
                    {pessoa.tipos.length > 0 && <span className="mt-0.5 block text-[11.5px] font-semibold text-[var(--hub-acento)]">{pessoa.tipos.join(" · ")}</span>}
                  </span>
                  {vista?.email === pessoa.email && <Check size={15} className="shrink-0 text-[var(--hub-acento)]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
