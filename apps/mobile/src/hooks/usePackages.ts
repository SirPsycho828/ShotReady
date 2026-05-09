import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { ServicePackage } from "@shotready/shared";

export interface PackageWithId extends ServicePackage {
  id: string;
}

export function usePackages() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<PackageWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPackages([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("packages")
      .where("photographerId", "==", user.uid)
      .orderBy("sortOrder", "asc")
      .onSnapshot(
        (snapshot) => {
          setPackages(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PackageWithId),
          );
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user]);

  return { packages, isLoading };
}
