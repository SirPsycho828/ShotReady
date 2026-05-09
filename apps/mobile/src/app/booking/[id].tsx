import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState, useEffect } from "react";
import { useBookings } from "@/hooks/useBookings";
import { useConnectivity } from "@/hooks/useConnectivity";
import { StatusPill } from "@/components/ui";
import { PropertyInfo } from "@/components/booking/PropertyInfo";
import { AgentInfo } from "@/components/booking/AgentInfo";
import { ScheduleInfo } from "@/components/booking/ScheduleInfo";
import { BookingActions } from "@/components/booking/BookingActions";
import { darkColors } from "@/theme/colors";
import { ArrowLeft } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bookings, isLoading } = useBookings();
  const { isOnline } = useConnectivity();
  const booking = bookings.find((b) => b.id === id);

  const [notes, setNotes] = useState(booking?.photographerNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);
  const [savedWhileOffline, setSavedWhileOffline] = useState(false);

  useEffect(() => {
    if (isOnline) setSavedWhileOffline(false);
  }, [isOnline]);

  async function saveNotes() {
    if (!id || notesSaved) return;
    await firestore().collection("bookings").doc(id).update({
      photographerNotes: notes.trim() || null,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    setNotesSaved(true);
    setSavedWhileOffline(!isOnline);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-body text-text-secondary">Loading...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-lg">
        <Text className="text-h2 text-text-primary">Booking not found</Text>
        <Text className="text-body text-text-secondary mt-sm">
          This booking may have been archived.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-lg">
          <Text className="text-body text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerClassName="pb-2xl" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="px-lg pt-xl pb-md">
          <Pressable onPress={() => router.back()} className="flex-row items-center mb-md">
            <ArrowLeft size={20} color={darkColors.textPrimary} />
            <Text className="text-body text-text-primary ml-xs">Back</Text>
          </Pressable>

          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-sm">
              <Text className="text-h1 text-text-primary">
                {getStreetAddress(booking.property.address)}
              </Text>
              <Text className="text-body text-text-secondary mt-xs">
                {booking.agent.name}
              </Text>
            </View>
            <StatusPill status={booking.status} />
          </View>
        </View>

        {/* Info sections */}
        <View className="px-lg">
          <View className="mb-md">
            <ScheduleInfo
              requestedDate={booking.schedule.requestedDate}
              confirmedDate={booking.schedule.confirmedDate}
              startTime={booking.schedule.startTime}
              estimatedDuration={booking.schedule.estimatedDuration}
              packageName={booking.package.name}
              packagePrice={booking.package.price}
              deliverables={booking.package.deliverables}
            />
          </View>

          <View className="mb-md">
            <PropertyInfo
              address={booking.property.address}
              city={booking.property.city}
              state={booking.property.state}
              zip={booking.property.zip}
              accessCode={booking.property.accessCode}
              accessNotes={booking.property.accessNotes}
              orientation={booking.property.orientation}
            />
          </View>

          <View className="mb-md">
            <AgentInfo
              name={booking.agent.name}
              email={booking.agent.email}
              phone={booking.agent.phone}
              company={booking.agent.company}
            />
          </View>

          {/* Agent notes (from booking form) */}
          {booking.agentNotes && (
            <View className="mb-md bg-surface border border-border rounded-card p-md">
              <Text className="text-caption text-text-muted mb-xs">Agent Notes</Text>
              <Text className="text-body text-text-secondary">{booking.agentNotes}</Text>
            </View>
          )}

          {/* Photographer notes (editable) */}
          <View className="mb-lg bg-surface border border-border rounded-card p-md">
            <Text className="text-caption text-text-muted mb-xs">Your Notes</Text>
            <TextInput
              className="text-body text-text-primary min-h-[60px]"
              value={notes}
              onChangeText={(t) => { setNotes(t); setNotesSaved(false); setSavedWhileOffline(false); }}
              onBlur={saveNotes}
              placeholder="Add private notes about this booking..."
              placeholderTextColor={darkColors.textMuted}
              multiline
              textAlignVertical="top"
            />
            {!notesSaved && (
              <Text className="text-small text-text-muted mt-xs">Unsaved changes</Text>
            )}
            {notesSaved && savedWhileOffline && (
              <Text className="text-small text-warning mt-xs">Saved offline — will sync when connected</Text>
            )}
          </View>

          {/* Actions */}
          <BookingActions booking={booking} />
        </View>
      </ScrollView>
    </View>
  );
}
