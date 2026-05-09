import { Stack } from "expo-router";
import { darkColors } from "@/theme/colors";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: darkColors.background },
      }}
    />
  );
}
