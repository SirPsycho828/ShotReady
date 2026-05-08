import { View, Text } from "react-native";

export default function LoginScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">ShotReady</Text>
      <Text className="text-body text-text-secondary mt-sm">Sign in to continue</Text>
    </View>
  );
}
