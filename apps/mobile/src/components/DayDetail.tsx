import { View, Text } from "react-native";
import { useMemo } from "react";
import { BookingCard } from "@/components/BookingCard";
import type { BookingWithId } from "@/hooks/useBookings";
import type { AvailabilityWindow } from "@shotready/shared";

const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DayDetailProps {
  dateStr: string;
  bookings: BookingWithId[];
  availabilityWindows: AvailabilityWindow[];
  blockedDates: string[];
}

function parseTime(time: string | null): number {
  if (!time) return 9999;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}hr`;
  return `${hrs}hr ${mins}m`;
}

export function DayDetail({ dateStr, bookings, availabilityWindows, blockedDates }: DayDetailProps) {
  const date = new Date(dateStr + "T12:00:00");
  const dayName = FULL_DAYS[date.getDay()];
  const monthName = MONTHS[date.getMonth()];
  const dayNum = date.getDate();

  const { pending, confirmed } = useMemo(() => {
    const p: BookingWithId[] = [];
    const c: BookingWithId[] = [];
    for (const b of bookings) {
      if (b.status === "pending") p.push(b);
      else c.push(b);
    }
    c.sort((a, b) => parseTime(a.schedule.startTime) - parseTime(b.schedule.startTime));
    return { pending: p, confirmed: c };
  }, [bookings]);

  const isBlocked = blockedDates.includes(dateStr);
  const dayOfWeek = date.getDay();
  const isAvailable = availabilityWindows.some((w) => w.dayOfWeek === dayOfWeek);

  return (
    <View className="px-lg pt-md">
      {/* Day header */}
      <Text className="text-h3 text-text-primary">
        {dayName}, {monthName} {dayNum}
      </Text>
      <Text className="text-caption text-text-secondary mt-xs">
        {bookings.length} shoot{bookings.length !== 1 ? "s" : ""}
      </Text>

      {/* Pending requests */}
      {pending.length > 0 && (
        <View className="mt-md">
          <Text className="text-caption text-warning mb-sm">
            Pending Requests ({pending.length})
          </Text>
          {pending.map((b) => (
            <View key={b.id} className="mb-sm border-l-[3px] border-warning pl-sm">
              <BookingCard booking={b} compact />
            </View>
          ))}
        </View>
      )}

      {/* Confirmed shoots */}
      {confirmed.length > 0 && (
        <View className="mt-md">
          {confirmed.map((b) => (
            <View key={b.id} className="mb-sm border-l-[3px] border-accent pl-sm">
              <View className="flex-row items-center mb-xs">
                {b.schedule.startTime && (
                  <Text className="text-caption text-accent mr-sm">
                    {formatTime12(b.schedule.startTime)}
                  </Text>
                )}
                <Text className="text-caption text-text-muted">
                  {formatDuration(b.schedule.estimatedDuration)}
                </Text>
              </View>
              <BookingCard booking={b} compact />
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {bookings.length === 0 && (
        <View className="mt-lg items-center">
          <Text className="text-body text-text-secondary">No shoots scheduled</Text>
          <Text className="text-caption text-text-muted mt-xs">
            {isBlocked
              ? "This date is blocked"
              : isAvailable
                ? "Available for bookings"
                : "Not available"}
          </Text>
        </View>
      )}
    </View>
  );
}
