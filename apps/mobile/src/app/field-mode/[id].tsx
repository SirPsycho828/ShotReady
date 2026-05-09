import { useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ArrowLeft, Plus, ChevronRight, Check } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";
import { darkColors, statusColors } from "@/theme/colors";
import { useBookings } from "@/hooks/useBookings";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useConnectivity } from "@/hooks/useConnectivity";
import { ShotListItem } from "@/components/field-mode/ShotListItem";

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

export default function FieldModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bookings } = useBookings();
  const { transitioning, transition } = useBookingTransition();
  const { isOnline } = useConnectivity();
  const booking = bookings.find((b) => b.id === id);

  const [addingShot, setAddingShot] = useState(false);
  const [newShotLabel, setNewShotLabel] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const toggleShot = useCallback(
    async (index: number) => {
      if (!booking || !id) return;
      const item = booking.shotList[index];
      const updatedList = [...booking.shotList];
      updatedList[index] = {
        ...item,
        isCompleted: !item.isCompleted,
        completedAt: !item.isCompleted
          ? firestore.Timestamp.now()
          : null,
      };
      await firestore().collection("bookings").doc(id).update({
        shotList: updatedList,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [booking, id],
  );

  const addShot = useCallback(async () => {
    if (!id || !newShotLabel.trim()) return;
    const newItem = {
      label: newShotLabel.trim(),
      isCompleted: false,
      completedAt: null,
    };
    await firestore()
      .collection("bookings")
      .doc(id)
      .update({
        shotList: firestore.FieldValue.arrayUnion(newItem),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    setNewShotLabel("");
    setAddingShot(false);
  }, [id, newShotLabel]);

  const handleComplete = useCallback(() => {
    if (!booking || !id) return;
    const unchecked = booking.shotList.filter((s) => !s.isCompleted).length;

    if (!isOnline) {
      Alert.alert("Offline", "Go online to complete this shoot.");
      return;
    }

    const doComplete = async () => {
      const success = await transition(booking.id, booking.status, "editing", {
        "shooting.completedAt": firestore.FieldValue.serverTimestamp(),
      });
      if (success) router.back();
    };

    if (unchecked > 0) {
      Alert.alert(
        "Unchecked Shots",
        `You have ${unchecked} unchecked shot${unchecked !== 1 ? "s" : ""}. Complete anyway?`,
        [
          { text: "Go Back", style: "cancel" },
          { text: "Yes, Complete", onPress: doComplete },
        ],
      );
    } else {
      doComplete();
    }
  }, [booking, id, isOnline, transition, router]);

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-body text-text-secondary">Booking not found</Text>
        <Pressable onPress={() => router.back()} className="mt-md">
          <Text className="text-body text-accent">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completed = booking.shotList.filter((s) => s.isCompleted).length;
  const total = booking.shotList.length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        className="flex-row items-center px-lg pt-sm pb-xs"
        hitSlop={8}
      >
        <ArrowLeft size={20} color={darkColors.textPrimary} />
        <Text className="text-body text-text-primary ml-xs">Back</Text>
      </Pressable>

      <View className="px-lg pb-md">
        <Text className="text-h2 text-text-primary">
          {getStreetAddress(booking.property.address)}
        </Text>
        <Text className="text-body text-text-secondary mt-xxs">
          Agent: {booking.agent.name}
        </Text>

        {booking.property.accessCode && (
          <Text className="text-h2 text-accent font-bold mt-md">
            ACCESS: {booking.property.accessCode}
          </Text>
        )}

        {booking.property.accessNotes && (
          <Text className="text-body text-text-primary mt-xs">
            {booking.property.accessNotes}
          </Text>
        )}

        {booking.agentNotes && (
          <View className="mt-sm bg-surface rounded-lg p-md">
            <Text className="text-caption text-text-muted mb-xxs">Agent Notes</Text>
            <Text className="text-body text-text-primary">{booking.agentNotes}</Text>
          </View>
        )}
      </View>

      <View className="h-px bg-border mx-lg" />

      <View className="flex-1 px-lg pt-md">
        <View className="flex-row items-center justify-between mb-sm">
          <Text className="text-body-medium text-text-primary font-semibold tracking-wide">
            SHOT LIST
          </Text>
          <Text className="text-body-medium text-text-secondary">
            {completed} / {total}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {total > 0 ? (
            booking.shotList.map((item, index) => (
              <ShotListItem
                key={`${item.label}-${index}`}
                label={item.label}
                isCompleted={item.isCompleted}
                onToggle={() => toggleShot(index)}
              />
            ))
          ) : !addingShot ? (
            <View className="flex-1 items-center justify-center py-xl">
              <Text className="text-body text-text-muted text-center">
                No shot list for this booking.{"\n"}Tap + to add shots.
              </Text>
            </View>
          ) : null}

          {addingShot && (
            <View className="flex-row items-center py-sm px-md">
              <TextInput
                className="flex-1 text-body text-text-primary border-b border-border py-xs mr-sm"
                value={newShotLabel}
                onChangeText={setNewShotLabel}
                placeholder="Shot description..."
                placeholderTextColor={darkColors.textMuted}
                autoFocus
                onSubmitEditing={addShot}
                returnKeyType="done"
              />
              <Pressable onPress={addShot} hitSlop={8}>
                <Check size={24} color={statusColors.success} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      <View className="flex-row items-center justify-between px-lg py-md border-t border-border">
        <Pressable
          onPress={() => setAddingShot(true)}
          className="flex-row items-center py-sm px-md"
          hitSlop={8}
        >
          <Plus size={20} color={darkColors.accent} />
          <Text className="text-body text-accent ml-xs">Add Shot</Text>
        </Pressable>

        <Pressable
          onPress={handleComplete}
          disabled={transitioning}
          className={`flex-row items-center py-sm px-lg rounded-lg ${
            transitioning ? "opacity-40" : ""
          } bg-accent`}
        >
          {transitioning ? (
            <ActivityIndicator size={18} color="#fff" />
          ) : (
            <>
              <Text className="text-body-medium text-white font-semibold">Complete</Text>
              <ChevronRight size={18} color="#fff" className="ml-xs" />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
