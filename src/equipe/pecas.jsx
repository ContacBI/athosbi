import { Building2, Network } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import { COR_DO_STATUS, ROTULO_DO_STATUS } from "./useSaude.js";

// Peças de tela do console (src/equipe), no visual do hub (hub.css).

export function Cabecalho({ rotulo, titulo, italico, depois = ".", texto, acoes }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {rotulo && <p className="hub-rotulo">{rotulo}</p>}
        <h1 className="hub-display mt-3 text-[32px] font-extrabold leading-[1.05] sm:text-[40px]">
          {titulo} {italico && <span className="hub-italico">{italico}</span>}
          {depois && <span className={italico ? "hub-pontuacao" : ""}>{depois}</span>}
        </h1>
        {texto && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--hub-texto-2)]">{texto}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2.5">{acoes}</div>}
    </div>
  );
}

export function Cartao({ className = "", children, ...resto }) {
  return (
    <div className={`hub-cartao ${className}`} {...resto}>
      {children}
    </div>
  );
}

export function PontoDeStatus({ status, className = "" }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] ${className}`} style={{ background: status ? COR_DO_STATUS[status] : "var(--hub-borda-forte)" }} aria-hidden="true" />;
}

export function SeloDeStatus({ status }) {
  if (!status) return <span className="text-[12px] text-[var(--hub-texto-3)]">calculando…</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] px-2.5 py-1 text-[12px] font-semibold text-[var(--hub-texto)]">
      <PontoDeStatus status={status} />
      {ROTULO_DO_STATUS[status]}
    </span>
  );
}

// A barra empilhada (em dia · atenção · crítica) da carteira ou de um grupo.
export function BarraDeStatus({ ok = 0, atencao = 0, critico = 0, fina = false }) {
  const total = ok + atencao + critico;
  return (
    <div className={`flex w-full gap-[3px] overflow-hidden rounded-full ${fina ? "h-1.5" : "h-2.5"}`} role="img" aria-label={`${ok} em dia, ${atencao} em atenção, ${critico} críticas`}>
      {total === 0 && <span className="h-full w-full bg-[var(--hub-borda)]" />}
      {[
        [critico, COR_DO_STATUS.critico],
        [atencao, COR_DO_STATUS.atencao],
        [ok, COR_DO_STATUS.ok],
      ].map(([valor, cor]) => (valor ? <span key={cor} className="h-full" style={{ width: `${(valor / total) * 100}%`, background: cor }} /> : null))}
    </div>
  );
}

export function IconeDaUnidade({ tipo, nome, tamanho = 44 }) {
  if (tipo === "grupo") {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white shadow-[0_8px_20px_-10px_rgba(232,105,31,0.8)]" style={{ width: tamanho, height: tamanho }}>
        <Network size={Math.round(tamanho * 0.42)} />
      </span>
    );
  }
  return nome ? <Avatar name={nome} size={tamanho} className="rounded-2xl" /> : <Building2 size={tamanho * 0.5} />;
}

export function Numero({ valor, rotulo, cor }) {
  return (
    <div className="flex items-start gap-3">
      {cor && <span className="mt-2.5 h-3 w-3 shrink-0 rounded-[4px]" style={{ background: cor }} />}
      <div>
        <p className="hub-display text-[34px] font-bold leading-none">{valor}</p>
        <p className="mt-1.5 text-[13px] text-[var(--hub-texto-3)]">{rotulo}</p>
      </div>
    </div>
  );
}
