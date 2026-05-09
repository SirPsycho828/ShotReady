import { View, Text, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface DateNavigationProps {
  date: Date;
  onPrevious: () => void;
  onNext: () => void;
}

function formatDate(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let label = "";
  if (isSameDay(d, today)) label = "Today, ";
  else if (isSameDay(d, tomorrow)) label = "Tomorrow, ";
  else if (isSameDay(d, yesterday)) label = "Yesterday, ";

  return `${label}${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

export function DateNavigation({ date, onPrevious, onNext }: DateNavigationProps) {
  return (
    <View className="flex-row items-center justify-between px-lg py-md">
      <Pressable onPress={onPrevious} className="p-sm" hitSlop={8}>
        <ChevronLeft size={24} color={darkColors.textPrimary} />
      </Pressable>
      <Text className="text-h3 text-text-primary">{formatDate(date)}</Text>
      <Pressable onPress={onNext} className="p-sm" hitSlop={8}>
        <ChevronRight size={24} color={darkColors.textPrimary} />
      </Pressable>
    </View>
  );
}
