import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Booking } from "@shotready/shared";

export interface BookingWithId extends Booking {
  id: string;
}

export function useBookings(uid: string | undefined) {
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("photographerId", "==", uid),
      orderBy("updatedAt", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setBookings(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingWithId),
        );
        setLoading(false);
      },
      () => {
        setBookings([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  return { bookings, loading };
}
