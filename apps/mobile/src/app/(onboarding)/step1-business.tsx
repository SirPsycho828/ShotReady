import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import firestore from "@react-native-firebase/firestore";

export default function Step1Business() {
  const router = useRouter();
  const { user } = useAuth();
  const { photographer } = usePhotographer();
  const [businessName, setBusinessName] = useState(photographer?.businessName ?? "");
  const [phone, setPhone] = useState(photographer?.phone ?? "");
  const synced = useRef(false);
  useEffect(() => {
    if (photographer && !synced.current) {
      synced.current = true;
      setBusinessName(photographer.businessName ?? "");
      setPhone(photographer.phone ?? "");
    }
  }, [photographer]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!businessName.trim()) {
      setError("Business name is required");
      return;
    }
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      await firestore().collection("photographers").doc(user.uid).update({
        businessName: businessName.trim(),
        phone: phone.trim() || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      router.push("/(onboarding)/step2-package");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-lg"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-h1 text-text-primary">Let's set up your business</Text>
        <Text className="text-body text-text-secondary mt-sm mb-xl">
          Tell us about your photography business
        </Text>

        <Input
          label="Business Name"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
          placeholder="Smith Photography"
        />

        <View className="mt-md">
          <Input
            label="Phone Number (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="(555) 123-4567"
          />
        </View>

        {error !== "" && (
          <Text className="text-small text-error mt-sm">{error}</Text>
        )}

        <View className="mt-lg">
          <Button title="Continue" onPress={handleContinue} loading={saving} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
