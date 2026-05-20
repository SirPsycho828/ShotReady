import { Check, Maximize2 } from "lucide-react";

interface PhotoCellProps {
  thumbnailUrl: string;
  isSelected: boolean;
  accentColor: string;
  isReadOnly: boolean;
  onToggle: () => void;
  onExpand: () => void;
  index: number;
  total: number;
  address: string;
}

export function PhotoCell({
  thumbnailUrl,
  isSelected,
  accentColor,
  isReadOnly,
  onToggle,
  onExpand,
  index,
  total,
  address,
}: PhotoCellProps) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden group img-zoom transition-all duration-[var(--duration-fast)] ${
        isSelected ? "opacity-100 shadow-glow-sm" : "opacity-70 hover:opacity-90"
      }`}
      style={{
        border: isSelected
          ? `3px solid ${accentColor}`
          : "3px solid transparent",
      }}
    >
      <button
        type="button"
        className="w-full cursor-pointer"
        onClick={() => !isReadOnly && onToggle()}
        disabled={isReadOnly}
        aria-label={`Photo ${index + 1} of ${total} — ${isSelected ? "selected" : "not selected"}`}
      >
        <img
          src={thumbnailUrl}
          alt={`Photo ${index + 1} of ${total} for ${address}`}
          className="w-full aspect-[4/3] object-cover"
          loading="lazy"
        />
      </button>

      {/* Selection checkbox */}
      <div className="absolute top-2 right-2 pointer-events-none">
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-[var(--duration-fast)] ${
            isSelected ? "text-white" : "bg-black/30 border-2 border-white/80"
          }`}
          style={isSelected ? { backgroundColor: accentColor } : undefined}
        >
          {isSelected && <Check size={16} strokeWidth={2.5} />}
        </div>
      </div>

      {/* Expand icon */}
      <button
        type="button"
        className="absolute bottom-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-white"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        aria-label={`View photo ${index + 1} full size`}
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
