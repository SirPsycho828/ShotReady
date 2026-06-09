import { useState, useRef } from "react";
import { Check, AlertTriangle, X } from "lucide-react";
import type { ProofingData } from "../../hooks/useProofingGallery";
import { PhotoCell } from "./PhotoCell";
import { Lightbox } from "./Lightbox";
import { GuidanceTip } from "../ux/GuidanceTip";

interface ProofingGalleryProps {
  data: ProofingData;
  selections: Map<string, boolean>;
  selectedCount: number;
  totalCount: number;
  isSubmitted: boolean;
  submitting: boolean;
  toggleSelection: (photoId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  submitSelections: () => void;
}

export function ProofingGallery({
  data,
  selections,
  selectedCount,
  totalCount,
  isSubmitted,
  submitting,
  toggleSelection,
  selectAll,
  deselectAll,
  submitSelections,
}: ProofingGalleryProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const hasInteracted = useRef(false);

  const address = data.booking.address.split(",")[0];
  const accentColor = data.booking.accentColor;

  function handleToggle(photoId: string) {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      setShowBanner(false);
    }
    toggleSelection(photoId);
  }

  function handleBulkAction(action: () => void) {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      setShowBanner(false);
    }
    action();
  }

  function handleApprove() {
    if (selectedCount === 0) return;
    setShowConfirm(true);
  }

  const photosWithSelection = data.photos.map((p) => ({
    ...p,
    isSelected: selections.get(p.id) ?? p.isSelected,
  }));

  return (
    <div>
      <div className="pb-24">
        {/* Post-submit success banner */}
        {isSubmitted && (
          <div className="mb-6 bg-success/10 border border-success/30 rounded-md px-4 py-3 text-success text-sm animate-slide-in">
            Your selections have been submitted! Your photographer will prepare
            your final photos and send them to you at{" "}
            {data.booking.agentEmail}.
          </div>
        )}

        {/* Instruction banner (before first interaction) */}
        {!isSubmitted && showBanner && (
          <div className="mb-6 bg-accent/8 border border-accent/20 rounded-md px-4 py-3 text-accent-foreground text-sm animate-slide-in">
            Tap photos to select your favorites. Or approve all to keep
            everything.
          </div>
        )}

        {/* Bulk actions + counter */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-2">
            {!isSubmitted && (
              <>
                <button
                  onClick={() => handleBulkAction(selectAll)}
                  className="px-3 py-1.5 text-xs font-500 tracking-[0.04em] uppercase border border-border rounded-md hover:bg-secondary transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleBulkAction(deselectAll)}
                  className="px-3 py-1.5 text-xs font-500 tracking-[0.04em] uppercase border border-border rounded-md hover:bg-secondary transition-colors"
                >
                  Deselect All
                </button>
              </>
            )}
          </div>
          <span className="text-sm text-muted-foreground font-500">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {photosWithSelection.map((photo, index) => (
            <PhotoCell
              key={photo.id}
              thumbnailUrl={photo.thumbnailUrl}
              isSelected={photo.isSelected}
              accentColor={accentColor}
              isReadOnly={isSubmitted}
              onToggle={() => handleToggle(photo.id)}
              onExpand={() => setLightboxPhotoId(photo.id)}
              index={index}
              total={totalCount}
              address={address}
            />
          ))}
        </div>
      </div>

      {/* Sticky approve button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-4">
        <div className="max-w-6xl mx-auto">
          {isSubmitted ? (
            <button
              disabled
              className="w-full py-3.5 rounded-md bg-success text-white font-body text-sm font-600 tracking-[0.05em] uppercase flex items-center justify-center gap-2"
            >
              <Check size={18} /> Selections Submitted
            </button>
          ) : (
            <button
              onClick={handleApprove}
              disabled={selectedCount === 0 || submitting}
              className="w-full py-3.5 rounded-md text-white font-body text-sm font-600 tracking-[0.05em] uppercase disabled:opacity-50 transition-opacity"
              style={{
                backgroundColor:
                  selectedCount > 0 ? accentColor : "hsl(var(--muted-foreground))",
              }}
            >
              {submitting
                ? "Submitting..."
                : selectedCount > 0
                  ? `Approve ${selectedCount} Selected Photos`
                  : "Select at least one photo"}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation modal — UX-006 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-card border border-border rounded-lg p-6 max-w-sm w-full shadow-xl animate-develop">
            <button
              onClick={() => setShowConfirm(false)}
              className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-warning" />
              </div>
              <h3 className="font-heading text-lg font-500 text-foreground">Confirm Selection</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              You've selected <span className="text-foreground font-500">{selectedCount} of {totalCount}</span> photos.
              Your photographer will prepare these for delivery. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-md border border-border text-sm font-500 text-foreground hover:bg-secondary transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => { setShowConfirm(false); submitSelections(); }}
                className="flex-1 py-2.5 rounded-md text-white text-sm font-600 tracking-[0.03em] uppercase transition-opacity hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                Approve Photos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhotoId && (
        <Lightbox
          photos={photosWithSelection}
          initialId={lightboxPhotoId}
          accentColor={accentColor}
          isReadOnly={isSubmitted}
          onToggle={handleToggle}
          onClose={() => setLightboxPhotoId(null)}
          address={address}
        />
      )}
    </div>
  );
}
