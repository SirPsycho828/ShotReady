import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { PackageForm, type PackageFormData } from "@/components/PackageForm";
import firestore from "@react-native-firebase/firestore";

export default function Step2Package() {
  const router = useRouter();
  const { user } = useAuth();

  async function handleSave(data: PackageFormData) {
    if (!user) return;

    await firestore().collection("packages").add({
      photographerId: user.uid,
      name: data.name,
      description: data.description,
      price: data.price,
      deliverables: data.deliverables,
      shotListTemplate: data.shotListTemplate,
      estimatedDuration: data.estimatedDuration,
      isActive: true,
      sortOrder: 0,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    router.push("/(onboarding)/step3-availability");
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-lg pt-xl">
        <Text className="text-h1 text-text-primary">Create your first package</Text>
        <Text className="text-body text-text-secondary mt-sm">
          Agents will choose this when booking a shoot
        </Text>
      </View>
      <PackageForm onSave={handleSave} saveLabel="Continue" showShotList={false} />
    </View>
  );
}
