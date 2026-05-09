import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Card, StatusPill } from "@/components/ui";
import { ChevronRight } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import type { BookingWithId } from "@/hooks/useBookings";

function formatDate(ts: { seconds: number }): string {
  const d = new Date(ts.seconds * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

interface BookingCardProps {
  booking: BookingWithId;
  compact?: boolean;
}

export function BookingCard({ booking, compact = false }: BookingCardProps) {
  const router = useRouter();

  const date = booking.schedule.confirmedDate ?? booking.schedule.requestedDate;
  const street = getStreetAddress(booking.property.address);

  return (
    <Pressable
      onPress={() => router.push(`/booking/${booking.id}`)}
      className="active:opacity-85"
    >
      <Card className={compact ? "py-sm px-md" : ""}>
        <View className="flex-row items-start justify-between">
          <Text
            className={`${compact ? "text-body" : "text-h3"} text-text-primary flex-1 mr-sm`}
            numberOfLines={1}
          >
            {street}
          </Text>
          <StatusPill status={booking.status} />
        </View>
        <View className="flex-row items-center justify-between mt-xs">
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            {booking.agent.name}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-caption text-text-secondary">
              {formatDate(date)}
            </Text>
            {!compact && (
              <ChevronRight
                size={18}
                color={darkColors.textMuted}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
