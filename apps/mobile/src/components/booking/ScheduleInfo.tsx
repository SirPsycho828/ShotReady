import { View, Text } from "react-native";
import { Card } from "@/components/ui";
import { Calendar, Clock, Package } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import type { Timestamp } from "@shotready/shared";

interface ScheduleInfoProps {
  requestedDate: Timestamp;
  confirmedDate: Timestamp | null;
  startTime: string | null;
  estimatedDuration: number;
  packageName: string;
  packagePrice: number;
  deliverables: string[];
}

function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
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
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ScheduleInfo({
  requestedDate,
  confirmedDate,
  startTime,
  estimatedDuration,
  packageName,
  packagePrice,
  deliverables,
}: ScheduleInfoProps) {
  const displayDate = confirmedDate ?? requestedDate;

  return (
    <Card>
      <View className="flex-row items-center">
        <Calendar size={18} color={darkColors.accent} />
        <Text className="text-body-medium text-text-primary ml-sm">
          {formatDate(displayDate)}
        </Text>
        {!confirmedDate && (
          <Text className="text-small text-warning ml-sm">(Requested)</Text>
        )}
      </View>

      <View className="flex-row items-center mt-sm">
        <Clock size={16} color={darkColors.textMuted} />
        <Text className="text-caption text-text-secondary ml-sm">
          {startTime ? formatTime12(startTime) : "Time TBD"} · {formatDuration(estimatedDuration)}
        </Text>
      </View>

      <View className="mt-md pt-md border-t border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Package size={16} color={darkColors.textMuted} />
            <Text className="text-body-medium text-text-primary ml-sm">{packageName}</Text>
          </View>
          <Text className="text-body-medium text-text-primary">{formatPrice(packagePrice)}</Text>
        </View>
        {deliverables.length > 0 && (
          <View className="mt-xs ml-[26px]">
            {deliverables.map((d, i) => (
              <Text key={i} className="text-caption text-text-muted">
                · {d}
              </Text>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}
