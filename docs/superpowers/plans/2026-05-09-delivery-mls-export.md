# Delivery & MLS Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the delivery pipeline that processes selected photos into MLS-compliant exports, packages them into a ZIP, and gives agents a download page — plus the photographer-side "Deliver Finals" button.

**Architecture:** Photographer triggers delivery via a `deliverPhotos` callable Cloud Function. The function processes each selected photo through Sharp (resize to MLS config, strip metadata, quality-iterate to fit file size), creates a ZIP with JSZip, uploads it, and transitions the booking to `delivered`. The agent's evolving URL (`/b/{token}`) then shows a download page with the ZIP link and thumbnail previews. `bookingGetByToken` is updated to handle `delivered` status by generating signed URLs on demand.

**Tech Stack:** Firebase Cloud Functions v2, Sharp, JSZip, Firebase Admin SDK (Storage, Firestore), React, Tailwind CSS

---

## File Structure

**Create:**
- `functions/src/delivery.ts` — `deliverPhotos` callable Cloud Function
- `apps/web/src/components/delivery/DownloadPage.tsx` — Agent download page

**Modify:**
- `functions/package.json` — Add `jszip` dependency
- `functions/src/index.ts` — Export delivery function
- `functions/src/booking.ts` — Update `bookingGetByToken` to handle `delivered` status
- `apps/web/src/hooks/useProofingGallery.ts` — Add delivery types
- `apps/web/src/pages/BookingView.tsx` — Render DownloadPage for `delivered` status
- `apps/mobile/src/components/booking/BookingActions.tsx` — Add "Deliver Finals" button

---

## Context

### MLS Config (from Photographer type)

```typescript
interface MlsConfig {
  name: string;
  maxWidth: number;   // pixels, default 2048
  maxHeight: number;  // pixels, default 1536
  maxFileSize: number; // bytes, default 5MB
}
```

Stored at `photographers/{uid}.mlsConfig` (nullable — use defaults if null).

### Storage paths

```
processed/{bookingId}/mls_{filename}    ← MLS export per photo
processed/{bookingId}/{slug}_photos.zip ← Download ZIP
```

### Functions config

`FUNCTIONS_CONFIG.mediaZip = { memory: "1GiB", timeoutSeconds: 540 }` — used for delivery processing.

---

### Task 1: Add jszip dependency + create delivery Cloud Function

**Files:**
- Modify: `functions/package.json`
- Create: `functions/src/delivery.ts`

- [ ] **Step 1: Install jszip**

```bash
cd functions && pnpm add jszip
```

- [ ] **Step 2: Create functions/src/delivery.ts**

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
import JSZip from "jszip";
import { REGION, FUNCTIONS_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MLS_DEFAULTS = {
  maxWidth: 2048,
  maxHeight: 1536,
  maxFileSize: 5 * 1024 * 1024, // 5 MB
};

const START_QUALITY = 92;
const MIN_QUALITY = 70;
const QUALITY_STEP = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugifyAddress(address: string): string {
  return address
    .split(",")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/** Resize and compress a photo to fit MLS requirements. */
async function processForMls(
  fileBuffer: Buffer,
  maxWidth: number,
  maxHeight: number,
  maxFileSize: number,
): Promise<Buffer> {
  let quality = START_QUALITY;
  while (quality >= MIN_QUALITY) {
    const result = await sharp(fileBuffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer();

    if (result.length <= maxFileSize) return result;
    quality -= QUALITY_STEP;
  }
  // Return at minimum quality regardless of size
  return sharp(fileBuffer)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: MIN_QUALITY })
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Cloud Function: deliverPhotos
// ---------------------------------------------------------------------------

export const deliverPhotos = onCall(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.mediaZip.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.mediaZip.timeoutSeconds,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const photographerId = request.auth.uid;
    const bookingId = request.data?.bookingId;
    if (typeof bookingId !== "string") {
      throw new HttpsError("invalid-argument", "bookingId is required.");
    }

    const db = getFirestore();
    const bucket = getStorage().bucket();

    // --- Validate booking ---
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = bookingSnap.data()!;
    if (booking.photographerId !== photographerId) {
      throw new HttpsError("permission-denied", "Not your booking.");
    }
    if (booking.status !== "proofing") {
      throw new HttpsError(
        "failed-precondition",
        "Booking must be in proofing status.",
      );
    }
    if (!booking.proofing?.completedAt) {
      throw new HttpsError(
        "failed-precondition",
        "Agent has not completed selections.",
      );
    }

    // --- Get MLS config ---
    const photographerSnap = await db
      .collection("photographers")
      .doc(photographerId)
      .get();
    const mlsConfig = photographerSnap.data()?.mlsConfig;
    const maxWidth = mlsConfig?.maxWidth ?? MLS_DEFAULTS.maxWidth;
    const maxHeight = mlsConfig?.maxHeight ?? MLS_DEFAULTS.maxHeight;
    const maxFileSize = mlsConfig?.maxFileSize ?? MLS_DEFAULTS.maxFileSize;

    // --- Get selected photos ---
    const photosSnap = await db
      .collection("bookings")
      .doc(bookingId)
      .collection("photos")
      .where("isSelected", "==", true)
      .where("processingStatus", "==", "ready")
      .get();

    if (photosSnap.empty) {
      throw new HttpsError("failed-precondition", "No photos selected.");
    }

    // --- Process each photo and build ZIP ---
    const zip = new JSZip();

    for (const photoDoc of photosSnap.docs) {
      const photo = photoDoc.data();
      const [originalBuffer] = await bucket
        .file(photo.storagePath)
        .download();

      const mlsBuffer = await processForMls(
        originalBuffer,
        maxWidth,
        maxHeight,
        maxFileSize,
      );

      // Upload individual MLS export
      const mlsPath = `processed/${bookingId}/mls_${photo.filename}`;
      await bucket
        .file(mlsPath)
        .save(mlsBuffer, { contentType: "image/jpeg" });

      zip.file(photo.filename, mlsBuffer);
    }

    // --- Generate and upload ZIP ---
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
    });

    const addressSlug = slugifyAddress(booking.property.address);
    const zipPath = `processed/${bookingId}/${addressSlug}_photos.zip`;
    await bucket
      .file(zipPath)
      .save(zipBuffer, { contentType: "application/zip" });

    // --- Update booking to delivered ---
    await bookingRef.update({
      status: "delivered",
      "delivery.deliveredAt": FieldValue.serverTimestamp(),
      "delivery.downloadToken": zipPath,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `Delivered ${photosSnap.size} photos for booking ${bookingId}`,
    );

    return { success: true, photoCount: photosSnap.size };
  },
);
```

- [ ] **Step 3: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 2: Update bookingGetByToken for delivered status

**Files:**
- Modify: `functions/src/booking.ts`

**Context:** The current `bookingGetByToken` function only returns full data for `proofing` status. It needs to also handle `delivered` status — returning photographer branding, photo thumbnails (selected only), a signed download URL for the ZIP, ZIP file size, and retention expiration date.

- [ ] **Step 1: Update bookingGetByToken**

In `functions/src/booking.ts`, restructure the status check. The current code:

```typescript
if (booking.status !== "proofing") {
  return { ... minimal ... };
}
// Get photographer...
// Get photos...
```

Replace the entire function body inside the `onCall` handler with logic that handles both `proofing` and `delivered`:

```typescript
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
    const bookingId = bookingDoc.id;

    // Only proofing and delivered statuses get full data
    if (booking.status !== "proofing" && booking.status !== "delivered") {
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

    // Get photographer branding (for both proofing and delivered)
    const photographerSnap = await db
      .collection("photographers")
      .doc(booking.photographerId)
      .get();
    const photographer = photographerSnap.data();

    const bucket = getStorage().bucket();

    // Build booking info (shared between proofing and delivered)
    const bookingInfo = {
      id: bookingId,
      status: booking.status,
      address: booking.property.address,
      photographerName: photographer?.businessName ?? "Photographer",
      photographerLogo: photographer?.branding?.logoUrl ?? null,
      accentColor: photographer?.branding?.accentColor ?? "#2563EB",
      agentEmail: booking.agent.email,
    };

    // --- PROOFING: return all photos for selection ---
    if (booking.status === "proofing") {
      const photosSnap = await db
        .collection("bookings")
        .doc(bookingId)
        .collection("photos")
        .where("processingStatus", "==", "ready")
        .orderBy("sortOrder", "asc")
        .get();

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

      if (!booking.proofing?.viewedAt) {
        await bookingDoc.ref.update({
          "proofing.viewedAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        booking: bookingInfo,
        photos,
        proofing: {
          isSubmitted: !!booking.proofing?.completedAt,
          selectedCount: booking.proofing?.selectedCount ?? null,
        },
      };
    }

    // --- DELIVERED: return selected photos + download URL ---
    const photosSnap = await db
      .collection("bookings")
      .doc(bookingId)
      .collection("photos")
      .where("isSelected", "==", true)
      .where("processingStatus", "==", "ready")
      .orderBy("sortOrder", "asc")
      .get();

    const photos = await Promise.all(
      photosSnap.docs.map(async (doc) => {
        const data = doc.data();
        const [thumbnailUrl] = await bucket
          .file(data.thumbnailPath)
          .getSignedUrl({
            action: "read" as const,
            expires: Date.now() + 24 * 60 * 60 * 1000,
          });
        return {
          id: doc.id,
          thumbnailUrl,
          watermarkedUrl: "",
          isSelected: true,
          sortOrder: data.sortOrder as number,
        };
      }),
    );

    // Generate signed download URL for the ZIP
    let downloadUrl: string | null = null;
    let zipSize = 0;
    const zipPath = booking.delivery?.downloadToken;
    if (typeof zipPath === "string" && zipPath) {
      try {
        const [url] = await bucket.file(zipPath).getSignedUrl({
          action: "read" as const,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        downloadUrl = url;
        const [metadata] = await bucket.file(zipPath).getMetadata();
        zipSize = parseInt(String(metadata.size ?? "0"), 10);
      } catch {
        console.error("Failed to generate download URL for", zipPath);
      }
    }

    const deliveredAt = booking.delivery?.deliveredAt?.toDate?.();
    const retentionExpires = deliveredAt
      ? new Date(
          deliveredAt.getTime() + 90 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    return {
      booking: bookingInfo,
      photos,
      proofing: {
        isSubmitted: true,
        selectedCount: booking.proofing?.selectedCount ?? null,
      },
      delivery: {
        downloadUrl,
        zipSize,
        photoCount: photosSnap.size,
        retentionExpires,
      },
    };
  },
```

- [ ] **Step 2: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 3: Create DownloadPage and update BookingView

**Files:**
- Modify: `apps/web/src/hooks/useProofingGallery.ts` — Add `delivery` to `ProofingData` type
- Create: `apps/web/src/components/delivery/DownloadPage.tsx`
- Modify: `apps/web/src/pages/BookingView.tsx` — Render DownloadPage for `delivered` status

- [ ] **Step 1: Add delivery type to ProofingData**

In `apps/web/src/hooks/useProofingGallery.ts`, add the `delivery` field to `ProofingData`:

```typescript
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
}
```

- [ ] **Step 2: Create DownloadPage component**

Create `apps/web/src/components/delivery/DownloadPage.tsx`:

```tsx
import { Download } from "lucide-react";
import type { ProofingData } from "../../hooks/useProofingGallery";

interface DownloadPageProps {
  data: ProofingData;
}

export function DownloadPage({ data }: DownloadPageProps) {
  const delivery = data.delivery;
  const address = data.booking.address.split(",")[0];
  const accentColor = data.booking.accentColor;

  if (!delivery) return null;

  const sizeMB = (delivery.zipSize / (1024 * 1024)).toFixed(1);
  const retentionDate = delivery.retentionExpires
    ? new Date(delivery.retentionExpires).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        {data.booking.photographerLogo && (
          <img
            src={data.booking.photographerLogo}
            alt={data.booking.photographerName}
            className="h-8 mb-2"
          />
        )}
        <h1 className="text-lg font-bold text-gray-900">
          Your photos are ready!
        </h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-700 mb-6">
          {address} &middot; {delivery.photoCount} photos
        </p>

        {delivery.downloadUrl ? (
          <a
            href={delivery.downloadUrl}
            download
            className="flex items-center justify-center gap-3 w-full py-4 rounded-lg text-white font-semibold text-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            <Download size={22} />
            Download All Photos ({sizeMB} MB)
          </a>
        ) : (
          <div className="w-full py-4 rounded-lg bg-gray-200 text-gray-500 font-semibold text-lg text-center">
            Download unavailable
          </div>
        )}

        {retentionDate && (
          <p className="text-gray-500 text-sm text-center mt-3">
            Photos available for 90 days (until {retentionDate})
          </p>
        )}

        {data.photos.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Preview
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {data.photos.map((photo, i) => (
                <img
                  key={photo.id}
                  src={photo.thumbnailUrl}
                  alt={`Photo ${i + 1}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update BookingView to render DownloadPage**

In `apps/web/src/pages/BookingView.tsx`, add the delivered status handling. The current file renders `ProofingGallery` for `proofing` status.

Add import:
```typescript
import { DownloadPage } from "../components/delivery/DownloadPage";
```

After the proofing gallery block, add:
```typescript
  if (gallery.data.booking.status === "delivered") {
    return <DownloadPage data={gallery.data} />;
  }
```

Full updated file:

```tsx
import { useParams } from "react-router-dom";
import { useProofingGallery } from "../hooks/useProofingGallery";
import { ProofingGallery } from "../components/proofing/ProofingGallery";
import { DownloadPage } from "../components/delivery/DownloadPage";

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

  if (gallery.data.booking.status === "delivered") {
    return <DownloadPage data={gallery.data} />;
  }

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

- [ ] **Step 4: Verify compilation**

```bash
cd apps/web && npx tsc --noEmit
```

---

### Task 4: Update mobile BookingActions with Deliver Finals button

**Files:**
- Modify: `apps/mobile/src/components/booking/BookingActions.tsx`

**Context:** The current proofing status block shows "Waiting for agent to review and select photos." It needs to show a "Deliver Finals" button when `booking.proofing.completedAt` is set (agent finished selecting). The button calls the `deliverPhotos` Cloud Function.

Current proofing block (lines 114-120):
```tsx
{booking.status === "proofing" && (
  <View className="py-md items-center">
    <Text className="text-body text-text-secondary text-center">
      Waiting for agent to review and select photos.
    </Text>
  </View>
)}
```

- [ ] **Step 1: Add deliver handler and update proofing block**

Add import at top:
```typescript
import functions from "@react-native-firebase/functions";
```

Add state inside the component (after existing `useConnectivity` line):
```typescript
const [delivering, setDelivering] = useState(false);
```

Add `useState` to the React import if not already there.

Add handler function (after `handleCloseJob`):
```typescript
  function handleDeliver() {
    Alert.alert(
      "Deliver Finals",
      `Deliver ${booking.proofing.selectedCount ?? ""} photos to ${booking.agent.name}? This will also generate an invoice draft.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deliver",
          onPress: async () => {
            setDelivering(true);
            try {
              await functions().httpsCallable("deliverPhotos")({
                bookingId: booking.id,
              });
              router.back();
            } catch {
              Alert.alert("Error", "Failed to deliver photos. Please try again.");
            } finally {
              setDelivering(false);
            }
          },
        },
      ],
    );
  }
```

Replace the proofing block with:
```tsx
      {booking.status === "proofing" && (
        <View>
          {booking.proofing.completedAt ? (
            <View>
              <Text className="text-body text-text-secondary text-center mb-md">
                Agent selected {booking.proofing.selectedCount} photos
              </Text>
              <Button
                title="Deliver Finals"
                onPress={handleDeliver}
                disabled={isDisabled || delivering}
                loading={delivering}
              />
            </View>
          ) : (
            <View className="py-md items-center">
              <Text className="text-body text-text-secondary text-center">
                Waiting for agent to review and select photos.
              </Text>
            </View>
          )}
        </View>
      )}
```

Update `hasActionButton` to include proofing (when agent completed):
```typescript
  const hasActionButton =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "shooting" ||
    (booking.status === "proofing" && !!booking.proofing.completedAt) ||
    booking.status === "paid";
```

- [ ] **Step 2: Verify compilation**

```bash
pnpm typecheck
```

---

### Task 5: Wire exports, typecheck, and commit

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Export deliverPhotos from index.ts**

Add this line to the exports in `functions/src/index.ts`:

```typescript
export { deliverPhotos } from "./delivery";
```

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: PASS across all packages

- [ ] **Step 3: Commit**

```bash
git add functions/src/delivery.ts functions/src/booking.ts functions/src/index.ts functions/package.json pnpm-lock.yaml apps/web/src/hooks/useProofingGallery.ts apps/web/src/components/delivery/ apps/web/src/pages/BookingView.tsx apps/mobile/src/components/booking/BookingActions.tsx
git commit -m "feat: add delivery pipeline with MLS export, ZIP download, and agent download page"
```
