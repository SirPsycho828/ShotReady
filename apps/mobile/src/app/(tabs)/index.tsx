import { View, Text } from "react-native";

export default function JobsScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Jobs</Text>
      <Text className="text-body text-text-secondary mt-sm">Your bookings will appear here</Text>
    </View>
  );
}
