import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { lerNumero } from "../../lib/reforma/formato.js";

// Peças de formulário/indicador da Reforma Tributária — mesmo visual dos
// demais formulários do portal (borda line-strong, foco accent).

const mostrar = (valor, casas) => (Number(valor) ? Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: casas }) : "");
const campoBase =
  "h-8 rounded-md border border-line-strong bg-surface-card text-[12.5px] text-ink-900 outline-none transition-colors focus:border-accent-500 disabled:cursor-default disabled:bg-surface-muted disabled:text-ink-500";

// Explicação ao passar o mouse (ou focar com o teclado). Vai num portal com
// posição fixa — assim não é cortada por tabela com rolagem nem por cartão.
export function Dica({ texto, titulo, children, className = "", largura = 320 }) {
  const ref = useRef(null);
  const id = useId();
  const [posicao, setPosicao] = useState(null);

  useEffect(() => {
    if (!posicao) return undefined;
    const fechar = () => setPosicao(null);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [posicao]);

  if (!texto) return children;

  function abrir() {
    const caixa = ref.current?.getBoundingClientRect();
    if (!caixa) return;
    const tamanho = typeof texto === "string" ? texto.length + (titulo ? titulo.length : 0) : 400;
    const w = Math.min(largura, Math.max(190, tamanho * 6.2), window.innerWidth - 16);
    const left = Math.max(8, Math.min(caixa.left + caixa.width / 2 - w / 2, window.innerWidth - w - 8));
    const acima = caixa.top > 190;
    setPosicao({ left, w, acima, top: acima ? caixa.top - 8 : caixa.bottom + 8 });
  }

  return (
    <span
      ref={ref}
      onMouseEnter={abrir}
      onMouseLeave={() => setPosicao(null)}
      onFocus={abrir}
      onBlur={() => setPosicao(null)}
      aria-describedby={posicao ? id : undefined}
      className={`inline-flex max-w-full ${className}`}
    >
      {children}
      {posicao &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{ position: "fixed", left: posicao.left, top: posicao.top, width: posicao.w, transform: posicao.acima ? "translateY(-100%)" : undefined }}
            className="pointer-events-none z-[200] animate-surgir rounded-lg bg-navy-950 px-3 py-2 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-white/85 shadow-xl ring-1 ring-white/10"
          >
            {titulo && <p className="mb-0.5 font-semibold text-white">{titulo}</p>}
            {texto}
          </div>,
          document.body
        )}
    </span>
  );
}

// Rótulo com explicação: sublinhado pontilhado = "passe o mouse".
export function RotuloDica({ texto, titulo, children, className = "" }) {
  if (!texto) return children;
  return (
    <Dica texto={texto} titulo={titulo}>
      <span tabIndex={0} className={`cursor-help underline decoration-ink-300 decoration-dotted underline-offset-[3px] outline-none focus-visible:text-accent-600 ${className}`}>
        {children}
      </span>
    </Dica>
  );
}

// Ícone (i) com explicação, pra pôr ao lado de um título ou valor.
export function InfoDica({ texto, titulo, tamanho = 13, claro = false }) {
  return (
    <Dica texto={texto} titulo={titulo}>
      <span
        tabIndex={0}
        aria-label={titulo ? `Sobre: ${titulo}` : "Explicação"}
        className={`inline-flex cursor-help outline-none ${claro ? "text-white/40 hover:text-white focus-visible:text-white" : "text-ink-300 hover:text-accent-500 focus-visible:text-accent-500"}`}
      >
        <Info size={tamanho} strokeWidth={2} />
      </span>
    </Dica>
  );
}

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
    <span
      className={`flex h-8 items-center rounded-md border bg-surface-card transition-colors focus-within:border-accent-500 has-[:disabled]:bg-surface-muted ${invalido ? "border-danger-500" : "border-line-strong"} ${className}`}
    >
      {prefixo && <span className="shrink-0 whitespace-nowrap pl-2 text-[11px] text-ink-400">{prefixo}</span>}
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        value={texto}
        placeholder={placeholder}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onChange={(event) => {
          setTexto(event.target.value);
          const numero = lerNumero(event.target.value);
          if (!Number.isNaN(numero)) onChange(Math.min(max ?? Infinity, Math.max(min, numero)));
        }}
        className="h-full w-full min-w-0 bg-transparent px-2 text-right font-mono text-[12.5px] tabular-nums text-ink-900 outline-none disabled:text-ink-500"
      />
      {sufixo && <span className="shrink-0 whitespace-nowrap pr-2 text-[11px] text-ink-400">{sufixo}</span>}
    </span>
  );
}

export function Selecao({ valor, onChange, opcoes, className = "", ariaLabel }) {
  return (
    <select aria-label={ariaLabel} value={valor} onChange={(event) => onChange(event.target.value)} className={`${campoBase} px-2 ${className}`}>
      {opcoes.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </select>
  );
}

export function TextoInput({ valor, onChange, placeholder, className = "", ariaLabel, autoFocus = false }) {
  return (
    <input
      aria-label={ariaLabel}
      value={valor}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      className={`${campoBase} px-2.5 ${className}`}
    />
  );
}

// Abas com sublinhado (barra fixa das telas da Reforma). `itens`: [{ id,
// rotulo, contador?, dica? }].
export function Abas({ itens, ativa, onTrocar, rotulo }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label={rotulo}>
      {itens.map((item) => {
        const ligada = item.id === ativa;
        const botao = (
          <button
            key={item.id}
            type="button"
            onClick={() => onTrocar(item.id)}
            aria-current={ligada ? "page" : undefined}
            className={`relative whitespace-nowrap px-3 py-3 text-[13px] font-medium transition-colors ${ligada ? "text-ink-900" : "text-ink-400 hover:text-ink-700"}`}
          >
            {item.rotulo}
            {item.contador > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-px font-mono text-[10.5px] ${ligada ? "bg-accent-50 text-accent-700" : "bg-surface-muted text-ink-400"}`}>{item.contador}</span>}
            <span className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-all duration-200 ${ligada ? "bg-accent-500 opacity-100" : "bg-transparent opacity-0"}`} />
          </button>
        );
        return item.dica ? (
          <Dica key={item.id} texto={item.dica}>
            {botao}
          </Dica>
        ) : (
          botao
        );
      })}
    </nav>
  );
}

// Bloco cinza pulsando no lugar do conteúdo enquanto carrega.
export function Esqueleto({ className = "" }) {
  return <div className={`animate-brilho rounded-xl bg-surface-card shadow-sm ${className}`} />;
}

export function Cartao({ titulo, subtitulo, acoes, dica, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-line/70 bg-surface-card p-5 shadow-sm ${className}`}>
      {(titulo || acoes) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[900px]">
            {titulo && (
              <h2 className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink-900">
                {titulo}
                {dica && <InfoDica texto={dica} titulo={titulo} />}
              </h2>
            )}
            {subtitulo && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">{subtitulo}</p>}
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
// com o texto dizendo o que é (nunca só a cor). `dica`: explicação no (i).
export function Indicador({ rotulo, valor, apoio, tom = "neutro", dica }) {
  const corApoio = tom === "positivo" ? "text-success-600" : tom === "negativo" ? "text-danger-600" : "text-ink-500";
  return (
    <div className="rounded-xl border border-line/70 bg-surface-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-400">
        {rotulo}
        {dica && <InfoDica texto={dica} titulo={rotulo} tamanho={12} />}
      </p>
      <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums leading-tight text-ink-900">{valor}</p>
      {apoio && <p className={`mt-1 text-[12px] leading-snug ${corApoio}`}>{apoio}</p>}
    </div>
  );
}

export const botaoPrimario =
  "flex h-8 items-center gap-1.5 rounded-md bg-accent-500 px-3 text-[12.5px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
export const botaoSecundario =
  "flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-card px-3 text-[12.5px] text-ink-700 transition-colors hover:border-accent-300 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";
