import { View, Text } from "react-native";

export default function RegisterScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Create Account</Text>
      <Text className="text-body text-text-secondary mt-sm">Set up your photography business</Text>
    </View>
  );
}
