import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import type { BookingWithId } from "@/hooks/useBookings";
import firestore from "@react-native-firebase/firestore";

interface BookingActionsProps {
  booking: BookingWithId;
}

export function BookingActions({ booking }: BookingActionsProps) {
  const { transitioning, error, transition, clearError } = useBookingTransition();
  const router = useRouter();

  async function handleApprove() {
    const success = await transition(booking.id, booking.status, "confirmed", {
      "schedule.confirmedDate": booking.schedule.requestedDate,
    });
    if (success) router.back();
  }

  function handleDecline() {
    Alert.alert("Decline Booking", `Decline this booking from ${booking.agent.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          const success = await transition(booking.id, booking.status, "declined");
          if (success) router.back();
        },
      },
    ]);
  }

  function handleCancel() {
    Alert.alert("Cancel Booking", `Cancel this booking at ${booking.property.address.split(",")[0]}?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Booking",
        style: "destructive",
        onPress: async () => {
          const success = await transition(booking.id, booking.status, "cancelled");
          if (success) router.back();
        },
      },
    ]);
  }

  async function handleStartShoot() {
    await transition(booking.id, booking.status, "shooting", {
      "shooting.startedAt": firestore.FieldValue.serverTimestamp(),
    });
  }

  async function handleCompleteShoot() {
    await transition(booking.id, booking.status, "editing", {
      "shooting.completedAt": firestore.FieldValue.serverTimestamp(),
    });
  }

  async function handleCloseJob() {
    const success = await transition(booking.id, booking.status, "closed");
    if (success) router.back();
  }

  return (
    <View>
      {error && (
        <Text className="text-small text-error mb-sm text-center">{error}</Text>
      )}

      {booking.status === "pending" && (
        <View>
          <Button title="Approve Booking" onPress={handleApprove} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Decline" variant="destructive" onPress={handleDecline} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "confirmed" && (
        <View>
          <Button title="Start Shoot" onPress={handleStartShoot} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Cancel Booking" variant="ghost" onPress={handleCancel} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "shooting" && (
        <Button title="Complete Shoot" onPress={handleCompleteShoot} loading={transitioning} />
      )}

      {booking.status === "editing" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Upload photos via the web companion, then send to proofing.
          </Text>
        </View>
      )}

      {booking.status === "proofing" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Waiting for agent to review and select photos.
          </Text>
        </View>
      )}

      {booking.status === "delivered" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Photos delivered. Invoice management coming soon.
          </Text>
        </View>
      )}

      {(booking.status === "invoiced" || booking.status === "overdue") && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Awaiting payment from agent.
          </Text>
        </View>
      )}

      {booking.status === "paid" && (
        <Button title="Close Job" variant="secondary" onPress={handleCloseJob} loading={transitioning} />
      )}
    </View>
  );
}
