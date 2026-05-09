import { View, Text } from "react-native";
import { Card } from "@/components/ui";
import { MapPin, Key, Compass } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface PropertyInfoProps {
  address: string;
  city: string;
  state: string;
  zip: string;
  accessCode: string | null;
  accessNotes: string | null;
  orientation: string | null;
}

export function PropertyInfo({
  address,
  city,
  state,
  zip,
  accessCode,
  accessNotes,
  orientation,
}: PropertyInfoProps) {
  return (
    <Card>
      <View className="flex-row items-start">
        <MapPin size={18} color={darkColors.accent} style={{ marginTop: 2 }} />
        <View className="ml-sm flex-1">
          <Text className="text-body-medium text-text-primary">{address}</Text>
          <Text className="text-caption text-text-secondary">
            {city}, {state} {zip}
          </Text>
        </View>
      </View>

      {accessCode && (
        <View className="flex-row items-center mt-md">
          <Key size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-text-secondary ml-sm">
            Access: {accessCode}
          </Text>
        </View>
      )}

      {accessNotes && (
        <Text className="text-caption text-text-muted mt-xs ml-[26px]">
          {accessNotes}
        </Text>
      )}

      {orientation && (
        <View className="flex-row items-center mt-md">
          <Compass size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-text-secondary ml-sm">
            Facing {orientation}
          </Text>
        </View>
      )}
    </Card>
  );
}
