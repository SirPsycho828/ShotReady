import { ArrowRight } from "lucide-react";

interface NextStepCardProps {
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
  icon?: React.ReactNode;
}

export function NextStepCard({
  title,
  description,
  href,
  actionLabel,
  icon,
}: NextStepCardProps) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-lg border-l-4 border-l-accent bg-card border border-border p-4 hover:bg-secondary/50 transition-colors animate-slide-in group"
    >
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 group-hover:bg-accent/20 transition-colors">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-accent text-xs font-semibold uppercase tracking-wider">
        <span className="hidden sm:inline">{actionLabel ?? title}</span>
        <ArrowRight size={16} />
      </div>
    </a>
  );
}
