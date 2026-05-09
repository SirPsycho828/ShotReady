import { View, Text, ScrollView } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import type { AvailabilityWindow } from "@shotready/shared";
import firestore from "@react-native-firebase/firestore";

export default function Step3Availability() {
  const router = useRouter();
  const { user } = useAuth();
  const { photographer } = usePhotographer();
  const [windows, setWindows] = useState<AvailabilityWindow[]>(
    photographer?.availability.windows ?? [],
  );
  const synced = useRef(false);
  useEffect(() => {
    if (photographer && !synced.current) {
      synced.current = true;
      setWindows(photographer.availability.windows ?? []);
    }
  }, [photographer]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (windows.length === 0) {
      setError("Enable at least one day");
      return;
    }
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      await firestore().collection("photographers").doc(user.uid).update({
        "availability.windows": windows,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      router.push("/(onboarding)/step4-booking-link");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-lg pt-xl pb-2xl"
    >
      <Text className="text-h1 text-text-primary">Set your availability</Text>
      <Text className="text-body text-text-secondary mt-sm mb-lg">
        When are you available for shoots?
      </Text>

      <AvailabilityEditor initialWindows={windows} onChange={setWindows} />

      {error !== "" && (
        <Text className="text-small text-error mt-md">{error}</Text>
      )}

      <View className="mt-lg">
        <Button title="Continue" onPress={handleContinue} loading={saving} />
      </View>
    </ScrollView>
  );
}
