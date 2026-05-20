import type { LucideIcon } from "lucide-react";

interface StatusMessageCardProps {
  icon: LucideIcon;
  iconColor?: string;
  heading: string;
  body: string;
  imageUrl?: string;
  imageAlt?: string;
}

export function StatusMessageCard({
  icon: Icon,
  iconColor,
  heading,
  body,
  imageUrl,
  imageAlt,
}: StatusMessageCardProps) {
  return (
    <div className="text-center py-14 animate-slide-in">
      <div
        className="w-14 h-14 rounded-lg mx-auto mb-5 flex items-center justify-center"
        style={{
          backgroundColor: iconColor
            ? `${iconColor}12`
            : "hsl(var(--muted))",
        }}
      >
        <Icon
          size={28}
          color={iconColor ?? "hsl(var(--muted-foreground))"}
          strokeWidth={1.5}
        />
      </div>
      <h2 className="font-heading text-2xl font-500 text-foreground mb-2 tracking-tight">
        {heading}
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
        {body}
      </p>
      {imageUrl && (
        <div className="mt-10 max-w-lg mx-auto rounded-lg overflow-hidden photo-glow">
          <img
            src={imageUrl}
            alt={imageAlt ?? ""}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
