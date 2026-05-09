import { useState, useRef } from "react";
import { Check } from "lucide-react";
import type { ProofingData } from "../../hooks/useProofingGallery";
import { PhotoCell } from "./PhotoCell";
import { Lightbox } from "./Lightbox";

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
    const confirmed = window.confirm(
      `You've selected ${selectedCount} of ${totalCount} photos. Your photographer will prepare these for delivery. This cannot be undone.`,
    );
    if (confirmed) submitSelections();
  }

  const photosWithSelection = data.photos.map((p) => ({
    ...p,
    isSelected: selections.get(p.id) ?? p.isSelected,
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        {data.booking.photographerLogo && (
          <img
            src={data.booking.photographerLogo}
            alt={data.booking.photographerName}
            className="h-8 mb-2"
          />
        )}
        <h1 className="text-lg font-bold text-gray-900">
          Photos for {address}
        </h1>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {/* Post-submit success banner */}
        {isSubmitted && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm">
            Your selections have been submitted! Your photographer will prepare
            your final photos and send them to you at{" "}
            {data.booking.agentEmail}.
          </div>
        )}

        {/* Instruction banner (before first interaction) */}
        {!isSubmitted && showBanner && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800 text-sm">
            Tap photos to select your favorites. Or approve all to keep
            everything.
          </div>
        )}

        {/* Bulk actions + counter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {!isSubmitted && (
              <>
                <button
                  onClick={() => handleBulkAction(selectAll)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleBulkAction(deselectAll)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Deselect All
                </button>
              </>
            )}
          </div>
          <span className="text-sm text-gray-600">
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
      </main>

      {/* Sticky approve button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-6xl mx-auto">
          {isSubmitted ? (
            <button
              disabled
              className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold flex items-center justify-center gap-2"
            >
              <Check size={18} /> Selections Submitted
            </button>
          ) : (
            <button
              onClick={handleApprove}
              disabled={selectedCount === 0 || submitting}
              className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50 transition-colors"
              style={{
                backgroundColor:
                  selectedCount > 0 ? accentColor : "#9ca3af",
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
