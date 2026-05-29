import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Photographer } from "@shotready/shared";

export function usePhotographer(uid: string | undefined) {
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPhotographer(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "photographers", uid),
      (snap) => {
        setPhotographer(snap.exists() ? (snap.data() as Photographer) : null);
        setLoading(false);
      },
      () => {
        setPhotographer(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  async function updatePhotographer(uid: string, updates: Partial<Photographer>) {
    await setDoc(doc(db, "photographers", uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return { photographer, loading, updatePhotographer };
}
