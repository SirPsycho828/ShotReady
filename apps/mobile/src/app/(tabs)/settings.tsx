import { View, Text } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Settings</Text>
      <Text className="text-body text-text-secondary mt-sm">App settings will appear here</Text>
    </View>
  );
}
