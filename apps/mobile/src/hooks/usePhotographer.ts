import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Photographer } from "@shotready/shared";

export function usePhotographer() {
  const { user } = useAuth();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPhotographer(null);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("photographers")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          setPhotographer(doc.exists() ? (doc.data() as Photographer) : null);
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user]);

  return { photographer, isLoading };
}
