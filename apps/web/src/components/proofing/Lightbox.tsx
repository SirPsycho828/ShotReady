import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface LightboxPhoto {
  id: string;
  watermarkedUrl: string;
  isSelected: boolean;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  initialId: string;
  accentColor: string;
  isReadOnly: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  address: string;
}

export function Lightbox({
  photos,
  initialId,
  accentColor,
  isReadOnly,
  onToggle,
  onClose,
  address,
}: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, photos.findIndex((p) => p.id === initialId)),
  );
  const current = photos[currentIndex];

  const goNext = useCallback(
    () => setCurrentIndex((i) => Math.min(photos.length - 1, i + 1)),
    [photos.length],
  );
  const goPrev = useCallback(
    () => setCurrentIndex((i) => Math.max(0, i - 1)),
    [],
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isReadOnly && current) onToggle(current.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext, isReadOnly, current, onToggle]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
          aria-label="Close lightbox"
        >
          <X size={24} />
        </button>
        <span className="text-white text-sm font-medium">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) onToggle(current.id);
          }}
          disabled={isReadOnly}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            current.isSelected
              ? "text-white"
              : "bg-white/20 border-2 border-white"
          }`}
          style={
            current.isSelected ? { backgroundColor: accentColor } : undefined
          }
          aria-label={`${current.isSelected ? "Deselect" : "Select"} photo`}
        >
          {current.isSelected && <Check size={18} />}
        </button>
      </div>

      {/* Image */}
      <div
        className="flex items-center justify-center max-h-[85vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.watermarkedUrl}
          alt={`Photo ${currentIndex + 1} of ${photos.length} for ${address}`}
          className="max-h-[85vh] max-w-[90vw] object-contain"
        />
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={36} />
        </button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next photo"
        >
          <ChevronRight size={36} />
        </button>
      )}
    </div>
  );
}
