import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import { usePackages } from "@/hooks/usePackages";
import { darkColors } from "@/theme/colors";
import { Plus, ChevronRight } from "lucide-react-native";
import { useState } from "react";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { photographer } = usePhotographer();
  const { packages } = usePackages();
  const [showDeactivated, setShowDeactivated] = useState(false);

  const activePackages = packages.filter((p) => p.isActive);
  const deactivatedPackages = packages.filter((p) => !p.isActive);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-2xl">
      {/* Profile section */}
      <View className="px-lg pt-lg">
        <Text className="text-h2 text-text-primary">
          {photographer?.businessName ?? "Settings"}
        </Text>
        <Text className="text-caption text-text-secondary mt-xs">
          {photographer?.email}
        </Text>
      </View>

      {/* Packages section */}
      <View className="px-lg mt-xl">
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-h3 text-text-primary">Service Packages</Text>
          <Pressable
            className="flex-row items-center"
            onPress={() => router.push("/package-form")}
          >
            <Plus size={18} color={darkColors.accent} />
            <Text className="text-body text-accent ml-xs">Add</Text>
          </Pressable>
        </View>

        {activePackages.map((pkg) => (
          <Pressable
            key={pkg.id}
            onPress={() => router.push(`/package-form?id=${pkg.id}`)}
          >
            <Card className="mb-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-body-medium text-text-primary">{pkg.name}</Text>
                  <Text className="text-caption text-text-muted mt-xs">
                    {pkg.deliverables.length} deliverable{pkg.deliverables.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Text className="text-body-medium text-text-primary mr-sm">
                  {formatPrice(pkg.price)}
                </Text>
                <ChevronRight size={20} color={darkColors.textMuted} />
              </View>
            </Card>
          </Pressable>
        ))}

        {activePackages.length === 0 && (
          <Text className="text-body text-text-muted text-center py-lg">
            No active packages
          </Text>
        )}

        {/* Deactivated packages */}
        {deactivatedPackages.length > 0 && (
          <View className="mt-md">
            <Pressable
              className="flex-row items-center"
              onPress={() => setShowDeactivated(!showDeactivated)}
            >
              <Text className="text-caption text-text-muted">
                Deactivated ({deactivatedPackages.length})
              </Text>
              <ChevronRight
                size={14}
                color={darkColors.textMuted}
                style={{ transform: [{ rotate: showDeactivated ? "90deg" : "0deg" }] }}
              />
            </Pressable>

            {showDeactivated &&
              deactivatedPackages.map((pkg) => (
                <Pressable
                  key={pkg.id}
                  onPress={() => router.push(`/package-form?id=${pkg.id}`)}
                >
                  <Card className="mb-sm mt-sm opacity-60">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-body text-text-secondary">{pkg.name}</Text>
                      </View>
                      <Text className="text-body text-text-secondary mr-sm">
                        {formatPrice(pkg.price)}
                      </Text>
                      <ChevronRight size={20} color={darkColors.textMuted} />
                    </View>
                  </Card>
                </Pressable>
              ))}
          </View>
        )}
      </View>

      {/* Logout */}
      <View className="px-lg mt-xl">
        <Button title="Sign Out" variant="ghost" onPress={logout} />
      </View>
    </ScrollView>
  );
}
