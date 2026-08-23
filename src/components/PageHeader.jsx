// Cabeçalho enxuto de propósito: uma linha só, ícone pequeno, sem parágrafo
// explicando o óbvio embaixo do título — quem já usa o portal não precisa
// de uma frase toda vez que entra em "Representantes". `description` ainda
// é aceito (a maioria das telas passa) mas fica de fora do render de
// propósito, então nenhuma delas precisou ser tocada pra ficar compacta.
export default function PageHeader({ eyebrow, title, icon: Icon }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-500">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      )}
      <div>
        {eyebrow && <p className="text-[10px] font-medium uppercase tracking-wide text-accent-600">{eyebrow}</p>}
        <h1 className="text-[18px] font-medium leading-tight text-ink-900">{title}</h1>
      </div>
    </div>
  );
}
