import { useState, useEffect, useCallback, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

export interface ProofingPhoto {
  id: string;
  thumbnailUrl: string;
  watermarkedUrl: string;
  isSelected: boolean;
  sortOrder: number;
}

export interface ProofingBookingInfo {
  id: string;
  status: string;
  address: string;
  photographerName: string;
  photographerLogo: string | null;
  accentColor: string;
  agentEmail: string;
}

export interface ProofingData {
  booking: ProofingBookingInfo;
  photos: ProofingPhoto[];
  proofing: {
    isSubmitted: boolean;
    selectedCount: number | null;
  };
  delivery?: {
    downloadUrl: string | null;
    zipSize: number;
    photoCount: number;
    retentionExpires: string | null;
  };
  invoice?: {
    lineItems: { description: string; amount: number }[];
    total: number;
    status: string;
    dueDate: string | null;
    sentAt: string | null;
    paidAt: string | null;
    paymentUrl: string | null;
  };
}

const DEBOUNCE_MS = 500;

export function useProofingGallery(token: string | undefined) {
  const [data, setData] = useState<ProofingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Map<string, boolean>>(new Map());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingUpdates = useRef<Map<string, boolean>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch gallery data
  useEffect(() => {
    if (!token) return;
    async function fetchData() {
      try {
        const getByToken = httpsCallable<
          { token: string },
          ProofingData
        >(functions, "bookingGetByToken");
        const result = await getByToken({ token: token! });
        setData(result.data);
        setIsSubmitted(result.data.proofing.isSubmitted);
        const selMap = new Map<string, boolean>();
        result.data.photos.forEach((p) => selMap.set(p.id, p.isSelected));
        setSelections(selMap);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load gallery",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  // Flush pending selection updates to server
  const flushUpdates = useCallback(async () => {
    if (pendingUpdates.current.size === 0 || !token) return;
    const updates = Array.from(pendingUpdates.current.entries()).map(
      ([photoId, isSelected]) => ({ photoId, isSelected }),
    );
    pendingUpdates.current.clear();
    try {
      const toggle = httpsCallable(functions, "bookingToggleSelection");
      await toggle({ token, updates });
    } catch (err) {
      console.error("Failed to save selection:", err);
    }
  }, [token]);

  // Toggle a single photo's selection (debounced save)
  const toggleSelection = useCallback(
    (photoId: string) => {
      if (isSubmitted) return;
      setSelections((prev) => {
        const next = new Map(prev);
        const current = next.get(photoId) ?? false;
        next.set(photoId, !current);
        pendingUpdates.current.set(photoId, !current);
        return next;
      });
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushUpdates, DEBOUNCE_MS);
    },
    [isSubmitted, flushUpdates],
  );

  // Select all photos
  const selectAll = useCallback(() => {
    if (isSubmitted || !data) return;
    setSelections((prev) => {
      const next = new Map(prev);
      data.photos.forEach((p) => {
        next.set(p.id, true);
        pendingUpdates.current.set(p.id, true);
      });
      return next;
    });
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushUpdates, DEBOUNCE_MS);
  }, [isSubmitted, data, flushUpdates]);

  // Deselect all photos
  const deselectAll = useCallback(() => {
    if (isSubmitted || !data) return;
    setSelections((prev) => {
      const next = new Map(prev);
      data.photos.forEach((p) => {
        next.set(p.id, false);
        pendingUpdates.current.set(p.id, false);
      });
      return next;
    });
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushUpdates, DEBOUNCE_MS);
  }, [isSubmitted, data, flushUpdates]);

  // Submit final selections
  const submitSelections = useCallback(async () => {
    if (!token || isSubmitted) return;
    await flushUpdates();
    setSubmitting(true);
    try {
      const submit = httpsCallable(functions, "bookingSubmitSelections");
      await submit({ token });
      setIsSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit selections",
      );
    } finally {
      setSubmitting(false);
    }
  }, [token, isSubmitted, flushUpdates]);

  const selectedCount = Array.from(selections.values()).filter(Boolean).length;
  const totalCount = data?.photos.length ?? 0;

  return {
    data,
    loading,
    error,
    selections,
    selectedCount,
    totalCount,
    isSubmitted,
    submitting,
    toggleSelection,
    selectAll,
    deselectAll,
    submitSelections,
  };
}
