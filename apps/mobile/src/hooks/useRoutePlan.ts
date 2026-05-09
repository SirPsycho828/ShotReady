import { useState, useEffect, useCallback } from "react";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import type { RoutePlan } from "@shotready/shared";

export function useRoutePlan(date: string) {
  const { user } = useAuth();
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !date) {
      setRoutePlan(null);
      setIsLoading(false);
      return;
    }

    const docId = `${user.uid}_${date}`;
    const unsubscribe = firestore()
      .collection("routePlans")
      .doc(docId)
      .onSnapshot(
        (doc) => {
          setRoutePlan(doc.exists() ? (doc.data() as RoutePlan) : null);
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user, date]);

  const optimizeRoute = useCallback(async () => {
    if (!user || !date) return;
    setIsOptimizing(true);
    setError(null);
    try {
      await functions().httpsCallable("routingOptimize")({ date });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to optimize route");
    } finally {
      setIsOptimizing(false);
    }
  }, [user, date]);

  return { routePlan, isLoading, isOptimizing, error, optimizeRoute };
}
