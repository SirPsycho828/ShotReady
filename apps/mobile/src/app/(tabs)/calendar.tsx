import { View, Text } from "react-native";

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Calendar</Text>
      <Text className="text-body text-text-secondary mt-sm">Your schedule will appear here</Text>
    </View>
  );
}
