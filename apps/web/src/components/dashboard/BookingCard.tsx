import { StatusPill } from "./StatusPill";
import type { BookingWithId } from "../../hooks/useBookings";

function formatDate(ts: { seconds: number }): string {
  const d = new Date(ts.seconds * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

export function BookingCard({ booking }: { booking: BookingWithId }) {
  const date = booking.schedule.confirmedDate ?? booking.schedule.requestedDate;
  const street = getStreetAddress(booking.property.address);

  return (
    <div className="bg-card rounded-lg px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-card-foreground truncate flex-1">
          {street}
        </h4>
        <StatusPill status={booking.status} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-muted-foreground truncate">
          {booking.agent.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(date)}
        </span>
      </div>
    </div>
  );
}
