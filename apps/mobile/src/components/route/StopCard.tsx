import { View, Text, Pressable } from "react-native";
import { Navigation, Sun, Car } from "lucide-react-native";
import { darkColors, statusColors } from "@/theme/colors";
import type { RouteStop } from "@shotready/shared";

interface StopCardProps {
  stop: RouteStop;
  index: number;
  agentName: string;
  onNavigate: () => void;
}

function formatArrival(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")}${suffix}`;
}

function getLightingColor(lightingWindow: RouteStop["lightingWindow"]): string {
  if (!lightingWindow.ideal) return darkColors.textMuted;
  return statusColors.success;
}

function getLightingLabel(lw: RouteStop["lightingWindow"]): string {
  if (!lw.ideal) return lw.reason;
  return `Best light: ${lw.ideal}`;
}

export function StopCard({ stop, index, agentName, onNavigate }: StopCardProps) {
  return (
    <View>
      {stop.driveFromPrevious > 0 && (
        <View className="flex-row items-center px-lg py-xs ml-[40px]">
          <Car size={14} color={darkColors.textMuted} />
          <Text className="text-caption text-text-muted ml-xs">
            {stop.driveFromPrevious} min drive
          </Text>
        </View>
      )}

      <View className="flex-row items-start px-lg py-md bg-surface mx-lg rounded-lg">
        <View className="w-[40px] items-center pt-xs">
          <Text className="text-body text-text-secondary font-semibold">{index + 1}.</Text>
        </View>

        <View className="flex-1">
          <Text className="text-body text-text-primary" numberOfLines={1}>
            {stop.address}
          </Text>
          <Text className="text-caption text-text-secondary mt-xxs">
            {agentName} · {stop.estimatedDuration}min shoot
          </Text>
          <View className="flex-row items-center mt-xxs">
            <Sun size={12} color={getLightingColor(stop.lightingWindow)} />
            <Text
              className="text-caption ml-xxs"
              style={{ color: getLightingColor(stop.lightingWindow) }}
            >
              {getLightingLabel(stop.lightingWindow)}
            </Text>
          </View>
        </View>

        <View className="items-end gap-sm">
          <Text className="text-h3 text-accent">{formatArrival(stop.estimatedArrival)}</Text>
          <Pressable onPress={onNavigate} hitSlop={8}>
            <Navigation size={20} color={darkColors.accent} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
