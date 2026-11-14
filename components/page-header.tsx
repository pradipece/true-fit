import { Badge } from "@/components/ui/badge";

export function PageHeader({
  step,
  eyebrow,
  title,
  description,
  children,
}: {
  step?: number;
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-2">
        <div className="flex items-center gap-2">
          {step !== undefined && <Badge variant="secondary">Step {step}</Badge>}
          <span className="text-sm font-medium text-primary">{eyebrow}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <p className="text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
