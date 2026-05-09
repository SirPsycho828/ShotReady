import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { usePhotographer } from "@/hooks/usePhotographer";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";

export default function OnboardingComplete() {
  const router = useRouter();
  const { photographer } = usePhotographer();
  const [copied, setCopied] = useState(false);
  const bookingUrl = `shotready.app/book/${photographer?.bookingSlug ?? ""}`;

  async function handleCopy() {
    await Clipboard.setStringAsync(`https://${bookingUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View className="flex-1 bg-background justify-center px-lg">
      <Text className="text-h1 text-text-primary text-center">You're ready to go</Text>
      <Text className="text-body text-text-secondary text-center mt-sm">
        Share this link with your agents to start receiving bookings
      </Text>

      <Card className="mt-xl">
        <Text className="text-caption text-text-muted">Your booking link</Text>
        <Text className="text-body-medium text-accent mt-xs" selectable>
          https://{bookingUrl}
        </Text>
        <View className="mt-md">
          <Button
            title={copied ? "Copied!" : "Copy Link"}
            variant={copied ? "secondary" : "primary"}
            onPress={handleCopy}
          />
        </View>
      </Card>

      <View className="mt-xl">
        <Button
          title="Go to Dashboard"
          onPress={() => router.replace("/(tabs)")}
        />
      </View>
    </View>
  );
}
