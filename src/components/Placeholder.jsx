export default function Placeholder({ title, description, icon: Icon }) {
  return (
    <div className="mx-auto flex max-w-[900px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-card px-6 py-20 text-center">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
          <Icon size={26} strokeWidth={1.6} />
        </span>
      )}
      <p className="text-[15px] font-medium text-ink-900">{title}</p>
      <p className="max-w-md text-[13px] text-ink-400">{description}</p>
    </div>
  );
}
