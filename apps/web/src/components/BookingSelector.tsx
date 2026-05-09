import type { BookingWithId } from "../hooks/useEditingBookings";
import { Camera, ImageIcon } from "lucide-react";

interface BookingSelectorProps {
  bookings: BookingWithId[];
  loading: boolean;
  onSelect: (bookingId: string) => void;
}

function formatDate(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  const date = (ts as { toDate: () => Date }).toDate();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BookingSelector({ bookings, loading, onSelect }: BookingSelectorProps) {
  if (loading) {
    return <div className="text-text-muted text-center py-12">Loading bookings...</div>;
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16">
        <Camera className="mx-auto text-text-muted mb-4" size={48} strokeWidth={1.25} />
        <p className="text-text-secondary">No bookings are ready for uploads.</p>
        <p className="text-text-muted text-sm mt-2">
          Complete a shoot in the mobile app to start editing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-text-secondary text-sm">Select a booking to upload photos:</p>
      {bookings.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className="w-full text-left bg-surface hover:bg-surface-raised border border-border rounded-lg p-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-text-primary font-medium">
              {b.property.address.split(",")[0]}
            </span>
            <span className="text-text-muted text-sm">
              {formatDate(b.schedule.confirmedDate)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-text-secondary text-sm">
              {b.agent.name} · {b.package.name}
            </span>
            <span className="text-text-muted text-sm flex items-center gap-1">
              <ImageIcon size={14} />
              {b.photoCount} uploaded
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
