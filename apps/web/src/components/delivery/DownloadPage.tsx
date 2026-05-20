import { Download } from "lucide-react";
import type { ProofingData } from "../../hooks/useProofingGallery";

interface DownloadPageProps {
  data: ProofingData;
}

export function DownloadPage({ data }: DownloadPageProps) {
  const delivery = data.delivery;
  const address = data.booking.address.split(",")[0];
  const accentColor = data.booking.accentColor;

  if (!delivery) return null;

  const sizeMB = (delivery.zipSize / (1024 * 1024)).toFixed(1);
  const retentionDate = delivery.retentionExpires
    ? new Date(delivery.retentionExpires).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="animate-slide-in">
      <p className="text-muted-foreground text-sm mb-6">
        {address} &middot; {delivery.photoCount} photos
      </p>

      {delivery.downloadUrl ? (
        <a
          href={delivery.downloadUrl}
          download
          className="flex items-center justify-center gap-3 w-full py-4 rounded-md text-white font-body text-sm font-600 tracking-[0.05em] uppercase transition-opacity hover:opacity-90 shadow-md"
          style={{ backgroundColor: accentColor }}
        >
          <Download size={20} />
          Download All Photos ({sizeMB} MB)
        </a>
      ) : (
        <div className="w-full py-4 rounded-md bg-muted text-muted-foreground font-body text-sm font-600 tracking-[0.05em] uppercase text-center">
          Download unavailable
        </div>
      )}

      {retentionDate && (
        <p className="text-muted-foreground text-xs text-center mt-3">
          Photos available for 90 days (until {retentionDate})
        </p>
      )}

      {data.photos.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-body font-500 tracking-[0.1em] uppercase text-muted-foreground mb-4">
            Preview
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {data.photos.map((photo, i) => (
              <img
                key={photo.id}
                src={photo.thumbnailUrl}
                alt={`Photo ${i + 1}`}
                className="w-full aspect-[4/3] object-cover rounded-md"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
