import { View, Text, ScrollView } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Button, Input, Card } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import firestore from "@react-native-firebase/firestore";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Step4BookingLink() {
  const router = useRouter();
  const { user } = useAuth();
  const { photographer } = usePhotographer();
  const [slug, setSlug] = useState(
    photographer?.bookingSlug || generateSlug(photographer?.businessName ?? ""),
  );
  const synced = useRef(false);
  useEffect(() => {
    if (photographer && !synced.current) {
      synced.current = true;
      setSlug(photographer.bookingSlug || generateSlug(photographer.businessName ?? ""));
    }
  }, [photographer]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleSlugChange(text: string) {
    setSlug(text.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleContinue() {
    if (!slug.trim()) {
      setError("Booking link is required");
      return;
    }
    if (slug.length < 3) {
      setError("Must be at least 3 characters");
      return;
    }
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      // Check uniqueness (always passes for single-photographer v1, but ready for multi-tenant)
      const existing = await firestore()
        .collection("photographers")
        .where("bookingSlug", "==", slug)
        .get();

      const isOwn = existing.docs.length === 1 && existing.docs[0].id === user.uid;
      if (!existing.empty && !isOwn) {
        setError("This link is already taken. Try a different one.");
        setSaving(false);
        return;
      }

      await firestore().collection("photographers").doc(user.uid).update({
        bookingSlug: slug,
        onboardingComplete: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      router.replace("/(onboarding)/complete");
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
      <Text className="text-h1 text-text-primary">Your booking link</Text>
      <Text className="text-body text-text-secondary mt-sm mb-lg">
        Share this link with agents. They'll use it to book shoots with you.
      </Text>

      <Input
        label="Booking Slug"
        value={slug}
        onChangeText={handleSlugChange}
        autoCapitalize="none"
        autoCorrect={false}
        error={error || undefined}
      />

      <Card className="mt-md">
        <Text className="text-caption text-text-muted">Your booking URL</Text>
        <Text className="text-body-medium text-accent mt-xs" selectable>
          shotready.app/book/{slug || "..."}
        </Text>
      </Card>

      <View className="mt-lg">
        <Button title="Finish Setup" onPress={handleContinue} loading={saving} />
      </View>
    </ScrollView>
  );
}
