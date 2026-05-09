import { useState, useCallback } from "react";
import firestore from "@react-native-firebase/firestore";
import { isValidTransition } from "@shotready/shared/src/constants/transitions";
import type { BookingStatus } from "@shotready/shared/src/constants/booking-status";

interface TransitionResult {
  transitioning: boolean;
  error: string | null;
  transition: (
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    extraFields?: Record<string, unknown>,
  ) => Promise<boolean>;
  clearError: () => void;
}

export function useBookingTransition(): TransitionResult {
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transition = useCallback(
    async (
      bookingId: string,
      from: BookingStatus,
      to: BookingStatus,
      extraFields?: Record<string, unknown>,
    ): Promise<boolean> => {
      if (!isValidTransition(from, to)) {
        setError(`Cannot move from ${from} to ${to}`);
        return false;
      }

      setError(null);
      setTransitioning(true);
      try {
        await firestore()
          .collection("bookings")
          .doc(bookingId)
          .update({
            status: to,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            ...extraFields,
          });
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to update booking");
        return false;
      } finally {
        setTransitioning(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { transitioning, error, transition, clearError };
}
