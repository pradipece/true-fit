export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-2">
        <span className="text-sm font-medium text-primary">{eyebrow}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <p className="text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
