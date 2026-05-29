import type { BookingWithId } from "../hooks/useEditingBookings";
import { ImageIcon, Upload, ArrowRight } from "lucide-react";

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

export function BookingSelector({
  bookings,
  loading,
  onSelect,
}: BookingSelectorProps) {
  if (loading) {
    return (
      <div className="space-y-3 py-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-md animate-shimmer" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="animate-slide-in">
        <h2 className="font-heading text-2xl font-semibold text-foreground mb-1">Upload Photos</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Upload edited photos from Lightroom or your camera to deliver to agents.
        </p>

        <div className="border border-dashed border-border rounded-xl py-12 px-6">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5 mx-auto">
              <Upload size={28} className="text-muted-foreground" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
              No bookings ready for upload
            </h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Photos are uploaded to specific bookings. When a shoot is complete and the booking moves to "editing" status, it will appear here for you to upload your edited photos.
            </p>

            <div className="text-left bg-card border border-border rounded-lg p-5 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Upload Workflow
              </h4>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span className="text-muted-foreground">Agent books a shoot</span>
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">Booking appears on Dashboard</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span className="text-muted-foreground">You shoot the property</span>
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">Status changes to "editing"</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span className="text-muted-foreground">Edit in Lightroom</span>
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">Upload here, send for proofing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-slide-in">
      {/* Hero banner */}
      <div className="rounded-lg overflow-hidden mb-4 relative">
        <img
          src="/images/feature-exterior.jpg"
          alt="Modern home exterior"
          className="w-full h-32 object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="absolute bottom-3 left-4 text-white text-sm font-500">
          Select a booking to upload photos
        </p>
      </div>
      {bookings.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className="w-full text-left bg-card hover:bg-secondary border border-border rounded-md p-4 transition-all duration-[var(--duration-fast)] hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-foreground font-500">
              {b.property.address.split(",")[0]}
            </span>
            <span className="text-muted-foreground text-sm">
              {formatDate(b.schedule.confirmedDate)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-muted-foreground text-sm">
              {b.agent.name} &middot; {b.package.name}
            </span>
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              <ImageIcon size={14} />
              {b.photoCount} uploaded
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
