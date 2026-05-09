import type { LucideIcon } from "lucide-react";

interface StatusMessageCardProps {
  icon: LucideIcon;
  iconColor?: string;
  heading: string;
  body: string;
}

export function StatusMessageCard({
  icon: Icon,
  iconColor = "#6B7280",
  heading,
  body,
}: StatusMessageCardProps) {
  return (
    <div className="text-center py-12">
      <Icon size={48} color={iconColor} className="mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">{heading}</h2>
      <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}
