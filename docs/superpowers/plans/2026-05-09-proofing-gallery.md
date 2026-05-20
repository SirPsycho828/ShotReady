# Proofing Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the agent-facing proofing gallery where agents view watermarked photos, select favorites, and submit choices — plus the backing Cloud Functions for token-based data access and selection management.

**Architecture:** Three callable Cloud Functions mediate all agent data access (no direct Firestore from browser): `bookingGetByToken` returns booking metadata + photos with signed URLs, `bookingToggleSelection` saves selection changes with debounce batching, `bookingSubmitSelections` finalizes choices. The React SPA renders at `/b/{token}` with a responsive photo grid, selection states, lightbox viewer, and sticky approve button.

**Tech Stack:** Firebase Cloud Functions v2 (onCall), Firebase client SDK (httpsCallable), React, Tailwind CSS, Lucide icons

---

## File Structure

**Create:**
- `functions/src/booking.ts` — `bookingGetByToken`, `bookingToggleSelection`, `bookingSubmitSelections` callable functions
- `apps/web/src/hooks/useProofingGallery.ts` — Data fetching, selection state, debounced auto-save, submission
- `apps/web/src/components/proofing/PhotoCell.tsx` — Photo thumbnail with selection checkbox and expand icon
- `apps/web/src/components/proofing/Lightbox.tsx` — Full-screen photo viewer with navigation and selection toggle
- `apps/web/src/components/proofing/ProofingGallery.tsx` — Main gallery page with grid, bulk actions, instruction banner, sticky approve button

**Modify:**
- `functions/src/index.ts` — Export booking functions
- `apps/web/src/lib/firebase.ts` — Add Functions client export
- `apps/web/src/pages/BookingView.tsx` — Rewrite placeholder to fetch data and render ProofingGallery

---

## Context

### Existing routing

`apps/web/src/App.tsx` already has `<Route path="/b/:token" element={<BookingView />} />`. The `BookingView` page is a placeholder that extracts `token` from URL params.

### Cloud Functions pattern

`functions/src/routing.ts` uses `onCall` from `firebase-functions/v2/https`. Uses `getFirestore()` directly (Admin SDK auto-initializes). Config from `functions/src/config.ts`: `REGION = "us-central1"`, `FUNCTIONS_CONFIG.booking = { memory: "256MiB", timeoutSeconds: 60 }`.

### Shared types

- `Photographer.businessName`, `Photographer.branding.logoUrl`, `Photographer.branding.accentColor` (default `"#2563EB"`)
- `Booking.agentToken`, `Booking.agent.email`, `Booking.property.address`, `Booking.proofing.*`
- `Photo.isSelected`, `Photo.thumbnailPath`, `Photo.watermarkedPath`, `Photo.processingStatus`, `Photo.sortOrder`

### Firebase client

`apps/web/src/lib/firebase.ts` exports `auth`, `db`, `storage`, `app`. Needs `getFunctions` added.

### Theming

Agent pages use light mode (no `companion-theme` class). Standard Tailwind colors (gray-*, blue-*, green-*) with photographer's accent color for interactive elements.

---

### Task 1: Create booking Cloud Functions

**Files:**
- Create: `functions/src/booking.ts`
- Modify: `functions/src/index.ts:14`

- [ ] **Step 1: Create functions/src/booking.ts**

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { REGION, FUNCTIONS_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// bookingGetByToken — returns booking data + photos with signed URLs
// ---------------------------------------------------------------------------

export const bookingGetByToken = onCall(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.booking.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.booking.timeoutSeconds,
  },
  async (request) => {
    const token = request.data?.token;
    if (typeof token !== "string" || !token) {
      throw new HttpsError("invalid-argument", "Token is required.");
    }

    const db = getFirestore();

    // Find booking by agent token
    const bookingSnap = await db
      .collection("bookings")
      .where("agentToken", "==", token)
      .limit(1)
      .get();

    if (bookingSnap.empty) {
      throw new HttpsError("not-found", "Booking not found.");
    }

    const bookingDoc = bookingSnap.docs[0];
    const booking = bookingDoc.data();
    const bookingId = bookingDoc.id;

    // For non-proofing statuses, return minimal info
    if (booking.status !== "proofing") {
      return {
        booking: {
          id: bookingId,
          status: booking.status,
          address: booking.property.address,
          photographerName: "",
          photographerLogo: null,
          accentColor: "#2563EB",
          agentEmail: booking.agent.email,
        },
        photos: [],
        proofing: {
          isSubmitted: !!booking.proofing?.completedAt,
          selectedCount: booking.proofing?.selectedCount ?? null,
        },
      };
    }

    // Get photographer branding
    const photographerSnap = await db
      .collection("photographers")
      .doc(booking.photographerId)
      .get();
    const photographer = photographerSnap.data();

    // Get ready photos ordered by sortOrder
    const photosSnap = await db
      .collection("bookings")
      .doc(bookingId)
      .collection("photos")
      .where("processingStatus", "==", "ready")
      .orderBy("sortOrder", "asc")
      .get();

    // Generate signed URLs (24-hour expiration)
    const bucket = getStorage().bucket();
    const photos = await Promise.all(
      photosSnap.docs.map(async (doc) => {
        const data = doc.data();
        const [thumbnailUrl] = await bucket
          .file(data.thumbnailPath)
          .getSignedUrl({
            action: "read" as const,
            expires: Date.now() + 24 * 60 * 60 * 1000,
          });
        const [watermarkedUrl] = await bucket
          .file(data.watermarkedPath)
          .getSignedUrl({
            action: "read" as const,
            expires: Date.now() + 24 * 60 * 60 * 1000,
          });
        return {
          id: doc.id,
          thumbnailUrl,
          watermarkedUrl,
          isSelected: data.isSelected as boolean,
          sortOrder: data.sortOrder as number,
        };
      }),
    );

    // Track first view
    if (!booking.proofing?.viewedAt) {
      await bookingDoc.ref.update({
        "proofing.viewedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      booking: {
        id: bookingId,
        status: booking.status,
        address: booking.property.address,
        photographerName: photographer?.businessName ?? "Photographer",
        photographerLogo: photographer?.branding?.logoUrl ?? null,
        accentColor: photographer?.branding?.accentColor ?? "#2563EB",
        agentEmail: booking.agent.email,
      },
      photos,
      proofing: {
        isSubmitted: !!booking.proofing?.completedAt,
        selectedCount: booking.proofing?.selectedCount ?? null,
      },
    };
  },
);

// ---------------------------------------------------------------------------
// bookingToggleSelection — batch-update photo selections (debounced from client)
// ---------------------------------------------------------------------------

export const bookingToggleSelection = onCall(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.booking.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.booking.timeoutSeconds,
  },
  async (request) => {
    const { token, updates } = request.data ?? {};
    if (typeof token !== "string" || !token) {
      throw new HttpsError("invalid-argument", "Token is required.");
    }
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new HttpsError("invalid-argument", "Updates array is required.");
    }

    const db = getFirestore();

    const bookingSnap = await db
      .collection("bookings")
      .where("agentToken", "==", token)
      .limit(1)
      .get();

    if (bookingSnap.empty) {
      throw new HttpsError("not-found", "Booking not found.");
    }

    const bookingDoc = bookingSnap.docs[0];
    const booking = bookingDoc.data();

    if (booking.status !== "proofing" || booking.proofing?.completedAt) {
      throw new HttpsError("failed-precondition", "Selections are locked.");
    }

    const batch = db.batch();
    for (const update of updates) {
      const { photoId, isSelected } = update as {
        photoId: unknown;
        isSelected: unknown;
      };
      if (typeof photoId !== "string" || typeof isSelected !== "boolean")
        continue;
      const photoRef = db
        .collection("bookings")
        .doc(bookingDoc.id)
        .collection("photos")
        .doc(photoId);
      batch.update(photoRef, { isSelected });
    }
    await batch.commit();

    return { success: true };
  },
);

// ---------------------------------------------------------------------------
// bookingSubmitSelections — finalize agent's photo choices
// ---------------------------------------------------------------------------

export const bookingSubmitSelections = onCall(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.booking.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.booking.timeoutSeconds,
  },
  async (request) => {
    const token = request.data?.token;
    if (typeof token !== "string" || !token) {
      throw new HttpsError("invalid-argument", "Token is required.");
    }

    const db = getFirestore();

    const bookingSnap = await db
      .collection("bookings")
      .where("agentToken", "==", token)
      .limit(1)
      .get();

    if (bookingSnap.empty) {
      throw new HttpsError("not-found", "Booking not found.");
    }

    const bookingDoc = bookingSnap.docs[0];
    const booking = bookingDoc.data();

    if (booking.status !== "proofing") {
      throw new HttpsError(
        "failed-precondition",
        "Booking is not in proofing status.",
      );
    }
    if (booking.proofing?.completedAt) {
      throw new HttpsError(
        "failed-precondition",
        "Selections already submitted.",
      );
    }

    // Count selections
    const photosSnap = await db
      .collection("bookings")
      .doc(bookingDoc.id)
      .collection("photos")
      .where("processingStatus", "==", "ready")
      .get();

    const totalPhotos = photosSnap.size;
    const selectedCount = photosSnap.docs.filter(
      (d) => d.data().isSelected,
    ).length;

    if (selectedCount === 0) {
      throw new HttpsError(
        "failed-precondition",
        "At least one photo must be selected.",
      );
    }

    await bookingDoc.ref.update({
      "proofing.completedAt": FieldValue.serverTimestamp(),
      "proofing.selectedCount": selectedCount,
      "proofing.approvedAll": selectedCount === totalPhotos,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, selectedCount, totalPhotos };
  },
);
```

- [ ] **Step 2: Update functions/src/index.ts to export booking functions**

Replace the commented booking line:
```typescript
// export { bookingCreate, bookingUpdateStatus, bookingGetByToken } from "./booking";
```
With:
```typescript
export { bookingGetByToken, bookingToggleSelection, bookingSubmitSelections } from "./booking";
```

- [ ] **Step 3: Verify it compiles**

```bash
cd functions && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add functions/src/booking.ts functions/src/index.ts
git commit -m "feat: add booking Cloud Functions for proofing gallery"
```

---

### Task 2: Add Functions client and create useProofingGallery hook

**Files:**
- Modify: `apps/web/src/lib/firebase.ts`
- Create: `apps/web/src/hooks/useProofingGallery.ts`

**Context:** The web app already has Firebase initialized. We need to add `getFunctions` to the exports. The hook calls Cloud Functions via `httpsCallable`, manages local selection state, debounces saves at 500ms, and handles submission.

- [ ] **Step 1: Add Functions export to firebase.ts**

Add to the end of `apps/web/src/lib/firebase.ts`:

```typescript
import { getFunctions } from "firebase/functions";
```

And add to the exports:

```typescript
export const functions = getFunctions(app, "us-central1");
```

The full file after changes:

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
export { app };
```

- [ ] **Step 2: Create useProofingGallery hook**

Create `apps/web/src/hooks/useProofingGallery.ts`:

```typescript
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
```

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: PASS

---

### Task 3: Create PhotoCell and Lightbox components

**Files:**
- Create: `apps/web/src/components/proofing/PhotoCell.tsx`
- Create: `apps/web/src/components/proofing/Lightbox.tsx`

**Context:** These components are used inside the ProofingGallery (Task 4). PhotoCell renders one thumbnail in the grid with selection states. Lightbox is a full-screen overlay for viewing watermarked images. Both use the photographer's accent color for selection indicators.

- [ ] **Step 1: Create PhotoCell component**

Create `apps/web/src/components/proofing/PhotoCell.tsx`:

```tsx
import { Check, Maximize2 } from "lucide-react";

interface PhotoCellProps {
  thumbnailUrl: string;
  isSelected: boolean;
  accentColor: string;
  isReadOnly: boolean;
  onToggle: () => void;
  onExpand: () => void;
  index: number;
  total: number;
  address: string;
}

export function PhotoCell({
  thumbnailUrl,
  isSelected,
  accentColor,
  isReadOnly,
  onToggle,
  onExpand,
  index,
  total,
  address,
}: PhotoCellProps) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden group transition-opacity ${
        isSelected ? "opacity-100" : "opacity-60"
      }`}
      style={{
        border: isSelected
          ? `3px solid ${accentColor}`
          : "3px solid transparent",
      }}
    >
      <button
        type="button"
        className="w-full cursor-pointer"
        onClick={() => !isReadOnly && onToggle()}
        disabled={isReadOnly}
        aria-label={`Photo ${index + 1} of ${total} — ${isSelected ? "selected" : "not selected"}`}
      >
        <img
          src={thumbnailUrl}
          alt={`Photo ${index + 1} of ${total} for ${address}`}
          className="w-full aspect-[4/3] object-cover"
          loading="lazy"
        />
      </button>

      {/* Selection checkbox */}
      <div className="absolute top-2 right-2 pointer-events-none">
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center ${
            isSelected ? "text-white" : "bg-black/30 border-2 border-white"
          }`}
          style={isSelected ? { backgroundColor: accentColor } : undefined}
        >
          {isSelected && <Check size={18} />}
        </div>
      </div>

      {/* Expand icon */}
      <button
        type="button"
        className="absolute bottom-2 right-2 p-1.5 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-white"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        aria-label={`View photo ${index + 1} full size`}
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create Lightbox component**

Create `apps/web/src/components/proofing/Lightbox.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface LightboxPhoto {
  id: string;
  watermarkedUrl: string;
  isSelected: boolean;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  initialId: string;
  accentColor: string;
  isReadOnly: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  address: string;
}

export function Lightbox({
  photos,
  initialId,
  accentColor,
  isReadOnly,
  onToggle,
  onClose,
  address,
}: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, photos.findIndex((p) => p.id === initialId)),
  );
  const current = photos[currentIndex];

  const goNext = useCallback(
    () => setCurrentIndex((i) => Math.min(photos.length - 1, i + 1)),
    [photos.length],
  );
  const goPrev = useCallback(
    () => setCurrentIndex((i) => Math.max(0, i - 1)),
    [],
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isReadOnly && current) onToggle(current.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext, isReadOnly, current, onToggle]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
          aria-label="Close lightbox"
        >
          <X size={24} />
        </button>
        <span className="text-white text-sm font-medium">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) onToggle(current.id);
          }}
          disabled={isReadOnly}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            current.isSelected
              ? "text-white"
              : "bg-white/20 border-2 border-white"
          }`}
          style={
            current.isSelected ? { backgroundColor: accentColor } : undefined
          }
          aria-label={`${current.isSelected ? "Deselect" : "Select"} photo`}
        >
          {current.isSelected && <Check size={18} />}
        </button>
      </div>

      {/* Image */}
      <div
        className="flex items-center justify-center max-h-[85vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.watermarkedUrl}
          alt={`Photo ${currentIndex + 1} of ${photos.length} for ${address}`}
          className="max-h-[85vh] max-w-[90vw] object-contain"
        />
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={36} />
        </button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next photo"
        >
          <ChevronRight size={36} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify both compile**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: PASS

---

### Task 4: Create ProofingGallery page and rewrite BookingView

**Files:**
- Create: `apps/web/src/components/proofing/ProofingGallery.tsx`
- Modify: `apps/web/src/pages/BookingView.tsx`

**Context:** ProofingGallery is the main gallery page component. It receives all state from the `useProofingGallery` hook (passed via BookingView). It renders the instruction banner, bulk actions, photo grid, sticky approve button, and lightbox. BookingView calls the hook and passes everything to ProofingGallery.

**Imports available:** `PhotoCell` from `./PhotoCell`, `Lightbox` from `./Lightbox`, Lucide icons from `lucide-react`.

- [ ] **Step 1: Create ProofingGallery component**

Create `apps/web/src/components/proofing/ProofingGallery.tsx`:

```tsx
import { useState, useRef } from "react";
import { Check } from "lucide-react";
import type { ProofingData } from "../../hooks/useProofingGallery";
import { PhotoCell } from "./PhotoCell";
import { Lightbox } from "./Lightbox";

interface ProofingGalleryProps {
  data: ProofingData;
  selections: Map<string, boolean>;
  selectedCount: number;
  totalCount: number;
  isSubmitted: boolean;
  submitting: boolean;
  toggleSelection: (photoId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  submitSelections: () => void;
}

export function ProofingGallery({
  data,
  selections,
  selectedCount,
  totalCount,
  isSubmitted,
  submitting,
  toggleSelection,
  selectAll,
  deselectAll,
  submitSelections,
}: ProofingGalleryProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const hasInteracted = useRef(false);

  const address = data.booking.address.split(",")[0];
  const accentColor = data.booking.accentColor;

  function handleToggle(photoId: string) {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      setShowBanner(false);
    }
    toggleSelection(photoId);
  }

  function handleBulkAction(action: () => void) {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      setShowBanner(false);
    }
    action();
  }

  function handleApprove() {
    if (selectedCount === 0) return;
    const confirmed = window.confirm(
      `You've selected ${selectedCount} of ${totalCount} photos. Your photographer will prepare these for delivery. This cannot be undone.`,
    );
    if (confirmed) submitSelections();
  }

  const photosWithSelection = data.photos.map((p) => ({
    ...p,
    isSelected: selections.get(p.id) ?? p.isSelected,
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        {data.booking.photographerLogo && (
          <img
            src={data.booking.photographerLogo}
            alt={data.booking.photographerName}
            className="h-8 mb-2"
          />
        )}
        <h1 className="text-lg font-bold text-gray-900">
          Photos for {address}
        </h1>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {/* Post-submit success banner */}
        {isSubmitted && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm">
            Your selections have been submitted! Your photographer will prepare
            your final photos and send them to you at{" "}
            {data.booking.agentEmail}.
          </div>
        )}

        {/* Instruction banner (before first interaction) */}
        {!isSubmitted && showBanner && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800 text-sm">
            Tap photos to select your favorites. Or approve all to keep
            everything.
          </div>
        )}

        {/* Bulk actions + counter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {!isSubmitted && (
              <>
                <button
                  onClick={() => handleBulkAction(selectAll)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleBulkAction(deselectAll)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Deselect All
                </button>
              </>
            )}
          </div>
          <span className="text-sm text-gray-600">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {photosWithSelection.map((photo, index) => (
            <PhotoCell
              key={photo.id}
              thumbnailUrl={photo.thumbnailUrl}
              isSelected={photo.isSelected}
              accentColor={accentColor}
              isReadOnly={isSubmitted}
              onToggle={() => handleToggle(photo.id)}
              onExpand={() => setLightboxPhotoId(photo.id)}
              index={index}
              total={totalCount}
              address={address}
            />
          ))}
        </div>
      </main>

      {/* Sticky approve button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-6xl mx-auto">
          {isSubmitted ? (
            <button
              disabled
              className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold flex items-center justify-center gap-2"
            >
              <Check size={18} /> Selections Submitted
            </button>
          ) : (
            <button
              onClick={handleApprove}
              disabled={selectedCount === 0 || submitting}
              className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50 transition-colors"
              style={{
                backgroundColor:
                  selectedCount > 0 ? accentColor : "#9ca3af",
              }}
            >
              {submitting
                ? "Submitting..."
                : selectedCount > 0
                  ? `Approve ${selectedCount} Selected Photos`
                  : "Select at least one photo"}
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhotoId && (
        <Lightbox
          photos={photosWithSelection}
          initialId={lightboxPhotoId}
          accentColor={accentColor}
          isReadOnly={isSubmitted}
          onToggle={handleToggle}
          onClose={() => setLightboxPhotoId(null)}
          address={address}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite BookingView to use ProofingGallery**

Replace the contents of `apps/web/src/pages/BookingView.tsx`:

```tsx
import { useParams } from "react-router-dom";
import { useProofingGallery } from "../hooks/useProofingGallery";
import { ProofingGallery } from "../components/proofing/ProofingGallery";

export default function BookingView() {
  const { token } = useParams<{ token: string }>();
  const gallery = useProofingGallery(token);

  if (gallery.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (gallery.error || !gallery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Unable to load booking
          </h1>
          <p className="text-gray-500 mt-2">
            {gallery.error || "Booking not found"}
          </p>
        </div>
      </div>
    );
  }

  if (gallery.data.booking.status === "proofing") {
    return (
      <ProofingGallery
        data={gallery.data}
        selections={gallery.selections}
        selectedCount={gallery.selectedCount}
        totalCount={gallery.totalCount}
        isSubmitted={gallery.isSubmitted}
        submitting={gallery.submitting}
        toggleSelection={gallery.toggleSelection}
        selectAll={gallery.selectAll}
        deselectAll={gallery.deselectAll}
        submitSelections={gallery.submitSelections}
      />
    );
  }

  // Other statuses — placeholder for future specs (delivery, closed, etc.)
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Your Booking</h1>
        <p className="text-gray-500 mt-2">
          Booking status: {gallery.data.booking.status}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify everything compiles**

```bash
pnpm typecheck
```

Expected: PASS across all packages

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/proofing/ apps/web/src/hooks/useProofingGallery.ts apps/web/src/lib/firebase.ts apps/web/src/pages/BookingView.tsx
git commit -m "feat: add proofing gallery with photo selection, lightbox, and auto-save"
```
