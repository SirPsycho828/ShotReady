import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Booking } from "@shotready/shared";

export interface BookingWithId extends Booking {
  id: string;
}

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("bookings")
      .where("photographerId", "==", user.uid)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          setBookings(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingWithId),
          );
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user]);

  return { bookings, isLoading };
}
