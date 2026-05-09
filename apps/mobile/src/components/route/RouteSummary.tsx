import { View, Text } from "react-native";
import { CheckCircle, RefreshCw } from "lucide-react-native";
import { darkColors, statusColors } from "@/theme/colors";

interface RouteSummaryProps {
  stopCount: number;
  totalDurationMinutes: number;
  totalDistanceMeters: number;
  isOptimized: boolean;
}

export function RouteSummary({
  stopCount,
  totalDurationMinutes,
  totalDistanceMeters,
  isOptimized,
}: RouteSummaryProps) {
  const hours = Math.floor(totalDurationMinutes / 60);
  const mins = totalDurationMinutes % 60;
  const miles = Math.round(totalDistanceMeters / 1609.34);
  const timeStr = hours > 0 ? `${hours}hr ${mins}min` : `${mins}min`;

  return (
    <View className="flex-row items-center justify-between px-lg py-sm bg-surface rounded-lg mx-lg">
      <View className="flex-row items-center gap-md">
        <Text className="text-body text-text-primary font-semibold">{stopCount} stops</Text>
        <Text className="text-caption text-text-secondary">{timeStr}</Text>
        <Text className="text-caption text-text-secondary">{miles} mi</Text>
      </View>
      <View className="flex-row items-center gap-xs">
        {isOptimized ? (
          <>
            <CheckCircle size={14} color={statusColors.success} />
            <Text className="text-caption text-success">Optimized</Text>
          </>
        ) : (
          <>
            <RefreshCw size={14} color={darkColors.textMuted} />
            <Text className="text-caption text-text-muted">Not optimized</Text>
          </>
        )}
      </View>
    </View>
  );
}
