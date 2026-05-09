import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useConnectivity } from "@/hooks/useConnectivity";
import type { BookingWithId } from "@/hooks/useBookings";
import { CloudOff } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import firestore from "@react-native-firebase/firestore";

interface BookingActionsProps {
  booking: BookingWithId;
}

export function BookingActions({ booking }: BookingActionsProps) {
  const { transitioning, error, transition, clearError } = useBookingTransition();
  const { isOnline } = useConnectivity();
  const router = useRouter();
  const isDisabled = !isOnline || transitioning;

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
    const success = await transition(booking.id, booking.status, "shooting", {
      "shooting.startedAt": firestore.FieldValue.serverTimestamp(),
    });
    if (success) router.push(`/field-mode/${booking.id}`);
  }

  function handleCompleteShoot() {
    router.push(`/field-mode/${booking.id}`);
  }

  async function handleCloseJob() {
    const success = await transition(booking.id, booking.status, "closed");
    if (success) router.back();
  }

  const hasActionButton =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "shooting" ||
    booking.status === "paid";

  return (
    <View>
      {error && (
        <Text className="text-small text-error mb-sm text-center">{error}</Text>
      )}

      {booking.status === "pending" && (
        <View>
          <Button title="Approve Booking" onPress={handleApprove} disabled={isDisabled} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Decline" variant="destructive" onPress={handleDecline} disabled={isDisabled} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "confirmed" && (
        <View>
          <Button title="Start Shoot" onPress={handleStartShoot} disabled={isDisabled} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Cancel Booking" variant="ghost" onPress={handleCancel} disabled={isDisabled} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "shooting" && (
        <Button title="Complete Shoot" onPress={handleCompleteShoot} disabled={isDisabled} loading={transitioning} />
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
        <Button title="Close Job" variant="secondary" onPress={handleCloseJob} disabled={isDisabled} loading={transitioning} />
      )}

      {!isOnline && hasActionButton && (
        <View className="flex-row items-center justify-center mt-sm">
          <CloudOff size={14} color={darkColors.textMuted} />
          <Text className="text-small text-text-muted ml-xs">
            Actions unavailable offline
          </Text>
        </View>
      )}
    </View>
  );
}
