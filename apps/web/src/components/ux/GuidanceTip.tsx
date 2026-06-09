import { useState } from "react";
import { Lightbulb, X } from "lucide-react";

interface GuidanceTipProps {
  id: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function GuidanceTip({ id, children, icon }: GuidanceTipProps) {
  const storageKey = `ux-tip-${id}`;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === "true",
  );

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/50 px-3.5 py-3 text-sm animate-slide-in">
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {icon ?? <Lightbulb size={16} />}
      </span>
      <p className="flex-1 text-muted-foreground leading-relaxed">{children}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
        aria-label="Dismiss tip"
      >
        <X size={14} />
      </button>
    </div>
  );
}
