import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { darkColors, statusColors } from "@/theme/colors";

interface ShotListItemProps {
  label: string;
  isCompleted: boolean;
  onToggle: () => void;
}

export function ShotListItem({ label, isCompleted, onToggle }: ShotListItemProps) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center py-sm px-md min-h-[56px]"
      hitSlop={{ top: 4, bottom: 4 }}
    >
      <View
        className={`w-[32px] h-[32px] rounded-md items-center justify-center mr-md ${
          isCompleted ? "bg-success" : "border-2 border-border"
        }`}
        style={isCompleted ? { backgroundColor: statusColors.success } : undefined}
      >
        {isCompleted && <Check size={20} color="#fff" strokeWidth={3} />}
      </View>

      <Text
        className={`text-body flex-1 ${
          isCompleted ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
