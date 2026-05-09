import { View, Text, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { PackageForm, type PackageFormData } from "@/components/PackageForm";
import { useAuth } from "@/contexts/AuthContext";
import { usePackages } from "@/hooks/usePackages";
import firestore from "@react-native-firebase/firestore";
import { darkColors } from "@/theme/colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

export default function PackageFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { packages } = usePackages();
  const existingPkg = id ? packages.find((p) => p.id === id) : undefined;
  const isEdit = !!existingPkg;

  async function handleSave(data: PackageFormData) {
    if (!user) return;

    if (isEdit && id) {
      await firestore().collection("packages").doc(id).update({
        name: data.name,
        description: data.description,
        price: data.price,
        deliverables: data.deliverables,
        shotListTemplate: data.shotListTemplate,
        estimatedDuration: data.estimatedDuration,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const maxSort = packages.reduce((max, p) => Math.max(max, p.sortOrder), -1);
      await firestore().collection("packages").add({
        photographerId: user.uid,
        name: data.name,
        description: data.description,
        price: data.price,
        deliverables: data.deliverables,
        shotListTemplate: data.shotListTemplate,
        estimatedDuration: data.estimatedDuration,
        isActive: true,
        sortOrder: maxSort + 1,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
    router.back();
  }

  function handleDeactivate() {
    if (!id || !existingPkg) return;
    const activeCount = packages.filter((p) => p.isActive).length;

    if (existingPkg.isActive && activeCount <= 1) {
      Alert.alert(
        "Cannot Deactivate",
        "You need at least one active package for agents to book.",
      );
      return;
    }

    const action = existingPkg.isActive ? "Deactivate" : "Reactivate";
    Alert.alert(action, `${action} "${existingPkg.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        style: existingPkg.isActive ? "destructive" : "default",
        onPress: async () => {
          await firestore().collection("packages").doc(id).update({
            isActive: !existingPkg.isActive,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-lg pt-sm pb-md border-b border-border">
        <Text className="text-h2 text-text-primary">
          {isEdit ? "Edit Package" : "New Package"}
        </Text>
        <Pressable onPress={() => router.back()} className="p-xs">
          <X size={24} color={darkColors.textPrimary} />
        </Pressable>
      </View>

      <PackageForm
        initialData={
          existingPkg
            ? {
                name: existingPkg.name,
                description: existingPkg.description,
                price: existingPkg.price,
                deliverables: existingPkg.deliverables,
                shotListTemplate: existingPkg.shotListTemplate,
                estimatedDuration: existingPkg.estimatedDuration,
              }
            : undefined
        }
        onSave={handleSave}
        saveLabel={isEdit ? "Save Changes" : "Create Package"}
        showShotList={true}
      />

      {/* Deactivate/Reactivate button for edit mode */}
      {isEdit && (
        <View className="px-lg pb-lg">
          <Button
            title={existingPkg?.isActive ? "Deactivate Package" : "Reactivate Package"}
            variant={existingPkg?.isActive ? "destructive" : "secondary"}
            onPress={handleDeactivate}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
