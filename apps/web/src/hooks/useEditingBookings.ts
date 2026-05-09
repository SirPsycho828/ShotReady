import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot, getCountFromServer,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Booking } from "@shotready/shared";

export interface BookingWithId extends Booking {
  id: string;
  photoCount: number;
}

export function useEditingBookings(uid: string | undefined) {
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
      where("status", "==", "editing"),
      orderBy("schedule.confirmedDate", "desc"),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const results: BookingWithId[] = [];
      for (const doc of snapshot.docs) {
        const photosRef = collection(db, "bookings", doc.id, "photos");
        const countSnap = await getCountFromServer(photosRef);
        results.push({
          id: doc.id,
          ...(doc.data() as Booking),
          photoCount: countSnap.data().count,
        });
      }
      setBookings(results);
      setLoading(false);
    });

    return unsubscribe;
  }, [uid]);

  return { bookings, loading };
}
