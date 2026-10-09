import { useEffect, useState } from "react";
import { lerNumero } from "../../lib/reforma/formato.js";

// Peças de formulário/indicador da Reforma Tributária — mesmo visual dos
// demais formulários do portal (borda line-strong, foco accent).

const mostrar = (valor, casas) => (Number(valor) ? Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: casas }) : "");

// Campo numérico que aceita vírgula e ponto de milhar; guarda número no pai
// a cada tecla válida (o autosave da tela pega). Mostra o texto como foi
// digitado enquanto está em foco, formatado quando sai.
export function NumeroInput({ valor, onChange, casas = 2, prefixo, sufixo, className = "", placeholder = "0", min = 0, max, ariaLabel }) {
  const [texto, setTexto] = useState(mostrar(valor, casas));
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    if (!foco) setTexto(mostrar(valor, casas));
  }, [valor, casas, foco]);
  const invalido = Number.isNaN(lerNumero(texto));
  return (
    <span className={`flex items-center rounded-md border bg-surface-card focus-within:border-accent-500 ${invalido ? "border-danger-500" : "border-line-strong"} ${className}`}>
      {prefixo && <span className="pl-2 text-[11.5px] text-ink-400">{prefixo}</span>}
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={texto}
        placeholder={placeholder}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onChange={(event) => {
          setTexto(event.target.value);
          const numero = lerNumero(event.target.value);
          if (!Number.isNaN(numero)) onChange(Math.min(max ?? Infinity, Math.max(min, numero)));
        }}
        className="w-full min-w-0 bg-transparent px-2 py-1.5 text-right font-mono text-[12.5px] tabular-nums text-ink-900 outline-none"
      />
      {sufixo && <span className="pr-2 text-[11.5px] text-ink-400">{sufixo}</span>}
    </span>
  );
}

export function Selecao({ valor, onChange, opcoes, className = "", ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={valor}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-md border border-line-strong bg-surface-card px-2 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-accent-500 ${className}`}
    >
      {opcoes.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </select>
  );
}

export function TextoInput({ valor, onChange, placeholder, className = "", ariaLabel }) {
  return (
    <input
      aria-label={ariaLabel}
      value={valor}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-md border border-line-strong bg-surface-card px-2 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-accent-500 ${className}`}
    />
  );
}

export function Cartao({ titulo, subtitulo, acoes, children, className = "" }) {
  return (
    <section className={`rounded-xl bg-surface-card p-4 shadow-sm ${className}`}>
      {(titulo || acoes) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {titulo && <h2 className="text-[14px] font-semibold text-ink-900">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-[12px] text-ink-400">{subtitulo}</p>}
          </div>
          {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Indicador grande: valor principal + linha de apoio. `tom`: positivo
// (bom pra empresa), negativo, neutro — cor só na palavra de apoio, sempre
// com o texto dizendo o que é (nunca só a cor).
export function Indicador({ rotulo, valor, apoio, tom = "neutro" }) {
  const corApoio = tom === "positivo" ? "text-success-600" : tom === "negativo" ? "text-danger-600" : "text-ink-500";
  return (
    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-400">{rotulo}</p>
      <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums leading-tight text-ink-900">{valor}</p>
      {apoio && <p className={`mt-1 text-[12px] ${corApoio}`}>{apoio}</p>}
    </div>
  );
}

export const botaoPrimario =
  "flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
export const botaoSecundario =
  "flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-700 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";
