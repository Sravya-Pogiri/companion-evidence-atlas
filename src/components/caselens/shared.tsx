export function PageHeader({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
        )}
        <h1 className="font-serif text-3xl font-semibold text-navy">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
