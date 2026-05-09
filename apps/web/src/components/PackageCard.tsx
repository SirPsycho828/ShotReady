import { Check, Clock } from "lucide-react";

interface PackageCardProps {
  name: string;
  description: string;
  price: number;
  deliverables: string[];
  estimatedDuration: number;
  isSelected: boolean;
  onSelect: () => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

export function PackageCard({
  name,
  description,
  price,
  deliverables,
  estimatedDuration,
  isSelected,
  onSelect,
}: PackageCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
        isSelected
          ? "border-accent bg-accent/5"
          : "border-border bg-surface hover:border-text-muted"
      }`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{name}</h3>
        <span className="text-lg font-bold text-accent">{formatPrice(price)}</span>
      </div>
      {description && (
        <p className="text-sm text-text-secondary mt-1 line-clamp-2">{description}</p>
      )}
      <ul className="mt-3 space-y-1">
        {deliverables.map((d) => (
          <li key={d} className="flex items-center text-sm text-text-secondary">
            <Check size={14} className="text-success mr-2 shrink-0" />
            {d}
          </li>
        ))}
      </ul>
      <div className="flex items-center mt-3 text-xs text-text-muted">
        <Clock size={12} className="mr-1" />
        Approx. {formatDuration(estimatedDuration)}
      </div>
    </button>
  );
}
