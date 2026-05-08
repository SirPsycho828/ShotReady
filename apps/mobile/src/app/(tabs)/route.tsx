import { View, Text } from "react-native";

export default function RouteScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Route</Text>
      <Text className="text-body text-text-secondary mt-sm">Your daily route will appear here</Text>
    </View>
  );
}
