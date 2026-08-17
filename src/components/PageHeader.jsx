export default function PageHeader({ eyebrow, title, description, icon: Icon }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      {Icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
          <Icon size={22} strokeWidth={1.7} />
        </span>
      )}
      <div>
        <span className="text-[12px] font-medium uppercase tracking-wide text-accent-600">{eyebrow}</span>
        <h1 className="mt-1 text-[26px] font-medium leading-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-[14px] text-ink-400">{description}</p>}
      </div>
    </div>
  );
}
