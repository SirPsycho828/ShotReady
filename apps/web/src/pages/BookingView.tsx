import { useParams } from "react-router-dom";
import { useProofingGallery } from "../hooks/useProofingGallery";
import { ProofingGallery } from "../components/proofing/ProofingGallery";
import { DownloadPage } from "../components/delivery/DownloadPage";

export default function BookingView() {
  const { token } = useParams<{ token: string }>();
  const gallery = useProofingGallery(token);

  if (gallery.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (gallery.error || !gallery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Unable to load booking
          </h1>
          <p className="text-gray-500 mt-2">
            {gallery.error || "Booking not found"}
          </p>
        </div>
      </div>
    );
  }

  if (gallery.data.booking.status === "proofing") {
    return (
      <ProofingGallery
        data={gallery.data}
        selections={gallery.selections}
        selectedCount={gallery.selectedCount}
        totalCount={gallery.totalCount}
        isSubmitted={gallery.isSubmitted}
        submitting={gallery.submitting}
        toggleSelection={gallery.toggleSelection}
        selectAll={gallery.selectAll}
        deselectAll={gallery.deselectAll}
        submitSelections={gallery.submitSelections}
      />
    );
  }

  if (gallery.data.booking.status === "delivered") {
    return <DownloadPage data={gallery.data} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Your Booking</h1>
        <p className="text-gray-500 mt-2">
          Booking status: {gallery.data.booking.status}
        </p>
      </div>
    </div>
  );
}
