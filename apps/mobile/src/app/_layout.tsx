import "../../global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import { OfflineBar } from "@/components/ui";
import { darkColors } from "@/theme/colors";

function AuthGate() {
  const { user, isLoading: authLoading } = useAuth();
  const { photographer, isLoading: profileLoading } = usePhotographer();
  const segments = useSegments();
  const router = useRouter();

  const isLoading = authLoading || (!!user && profileLoading);

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

    if (!user) {
      if (!inAuth) router.replace("/(auth)/login");
    } else if (!photographer?.onboardingComplete) {
      if (!inOnboarding) router.replace("/(onboarding)/step1-business");
    } else {
      if (inAuth || inOnboarding) router.replace("/(tabs)");
    }
  }, [user, isLoading, photographer?.onboardingComplete, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={darkColors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="package-form" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <View className="flex-1 bg-background">
        <StatusBar style="light" />
        <OfflineBar />
        <AuthGate />
      </View>
    </AuthProvider>
  );
}
