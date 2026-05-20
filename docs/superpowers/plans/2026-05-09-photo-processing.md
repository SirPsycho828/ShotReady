# Photo Processing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cloud Functions that process uploaded photos into watermarked copies and thumbnails, with automated cleanup on deletion and 90-day retention.

**Architecture:** Storage trigger (`onObjectFinalized`) processes each uploaded JPEG through Sharp: validate JPEG magic bytes → extract metadata → generate 400px thumbnail → generate 1600px watermarked copy with tiled SVG text overlay → update Firestore photo document. Firestore `onDocumentDeleted` trigger cleans up associated Storage files when a photo is removed. Daily scheduled function handles 90-day photo retention after delivery.

**Tech Stack:** Firebase Cloud Functions v2, Sharp (image processing), Firebase Admin SDK (Storage, Firestore)

---

## File Structure

**Create:**
- `functions/src/media.ts` — `mediaOnUpload` Storage trigger + watermark SVG generation + processing helpers
- `functions/src/media-cleanup.ts` — `mediaOnPhotoDeleted` Firestore trigger + `mediaRetentionCleanup` scheduled function

**Modify:**
- `functions/package.json` — Add `sharp` dependency
- `functions/src/index.ts` — Export new functions

## Context

### Existing patterns

- `functions/src/routing.ts` — Example Cloud Function using `onCall` from `firebase-functions/v2/https`. Uses `getFirestore()` directly (Admin SDK auto-initializes in Cloud Functions).
- `functions/src/config.ts` — Centralized config. `REGION = "us-central1"`. `FUNCTIONS_CONFIG.media` = `{ memory: "1GiB", timeoutSeconds: 120 }`.
- `functions/package.json` — Uses `firebase-admin: ^13.0.0`, `firebase-functions: ^6.0.0`.

### Upload flow (already implemented)

The web companion (`apps/web/src/hooks/usePhotoUpload.ts`) uploads files to `uploads/{photographerId}/{bookingId}/{filename}` in Cloud Storage, then creates a photo document in `bookings/{bookingId}/photos` with:
```typescript
{
  filename: item.file.name,
  storagePath,
  watermarkedPath: null,
  thumbnailPath: null,
  width: 0, height: 0,
  fileSize: item.file.size,
  sortOrder: 0,
  isSelected: false,
  processingStatus: "processing",
  uploadedAt: serverTimestamp(),
  processedAt: null,
}
```

The Cloud Function fires on the Storage upload, processes the image, and updates this document with actual dimensions, generated paths, `isSelected: true`, computed `sortOrder`, and `processingStatus: "ready"`.

### Shared types

- `packages/shared/src/types/photo.ts` — `Photo` interface with `processingStatus: ProcessingStatus`
- `packages/shared/src/constants/booking-status.ts` — `PROCESSING_STATUSES = ["uploading", "processing", "ready", "error"]`
- `packages/shared/src/types/photographer.ts` — `Photographer` interface with `businessName: string`

### Storage paths

```
uploads/{photographerId}/{bookingId}/{filename}      ← Original
processed/{bookingId}/thumb_{filename}                ← Thumbnail
processed/{bookingId}/wm_{filename}                   ← Watermarked
processed/{bookingId}/mls_{filename}                  ← MLS export (spec 17, not this plan)
```

---

### Task 1: Add sharp dependency

**Files:**
- Modify: `functions/package.json`

- [ ] **Step 1: Install sharp in functions**

```bash
cd functions && pnpm add sharp
```

Sharp 0.33+ includes TypeScript declarations, so no `@types/sharp` needed.

- [ ] **Step 2: Verify installation compiles**

```bash
cd functions && pnpm typecheck
```

Expected: PASS (sharp isn't imported yet, just installed)

- [ ] **Step 3: Commit**

```bash
git add functions/package.json functions/pnpm-lock.yaml
git commit -m "chore: add sharp dependency for image processing"
```

---

### Task 2: Create media.ts — Photo processing pipeline

**Files:**
- Create: `functions/src/media.ts`

**Context for implementer:**
- This is the `media-onUpload` Storage trigger from `docs/planning/15_Photo_Processing.md`
- It fires on `onObjectFinalized` for every file written to Cloud Storage
- Must filter to only process files in `uploads/` path (ignore `processed/` to avoid infinite loops)
- The web companion already creates the photo doc with `processingStatus: "processing"` — this function updates it
- Uses the `FUNCTIONS_CONFIG.media` config from `functions/src/config.ts` (1GiB memory, 120s timeout)

- [ ] **Step 1: Create functions/src/media.ts**

```typescript
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
import { REGION, FUNCTIONS_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 80;
const WM_MAX_DIMENSION = 1600;
const WM_QUALITY = 85;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === JPEG_MAGIC[0] &&
    buffer[1] === JPEG_MAGIC[1] &&
    buffer[2] === JPEG_MAGIC[2]
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate a tiled watermark SVG overlay.
 *
 * Creates repeating diagonal text (business name) across the full image.
 * - Font size: ~3% of image height (min 16px)
 * - Color: white at 40% opacity
 * - Rotation: -30 degrees
 * - Spacing: ~200px between tiles
 */
function generateWatermarkSvg(
  width: number,
  height: number,
  businessName: string,
): Buffer {
  const fontSize = Math.max(16, Math.round(height * 0.03));
  const charWidth = fontSize * 0.6;
  const textWidth = Math.round(businessName.length * charWidth);
  const spacingX = textWidth + 200;
  const spacingY = fontSize + 200;
  const escaped = escapeXml(businessName);

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="wm" width="${spacingX}" height="${spacingY}"
             patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <text x="${Math.round(spacingX / 2)}" y="${Math.round(spacingY / 2)}"
            text-anchor="middle" dominant-baseline="middle"
            font-family="sans-serif" font-size="${fontSize}"
            fill="rgba(255,255,255,0.4)">${escaped}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)" />
</svg>`;

  return Buffer.from(svg);
}

/** Retry an async operation with exponential backoff (for Storage writes). */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error("Unreachable");
}

// ---------------------------------------------------------------------------
// Cloud Function: onObjectFinalized trigger
// ---------------------------------------------------------------------------

export const mediaOnUpload = onObjectFinalized(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.media.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.media.timeoutSeconds,
    maxInstances: 30,
  },
  async (event) => {
    const object = event.data;
    const filePath = object.name;
    if (!filePath) return;

    // Only process files in uploads/ (ignore processed/ to avoid infinite loops)
    const parts = filePath.split("/");
    if (parts.length !== 4 || parts[0] !== "uploads") return;
    const [, photographerId, bookingId, filename] = parts;

    const db = getFirestore();
    const bucket = getStorage().bucket();
    const photosRef = db
      .collection("bookings")
      .doc(bookingId)
      .collection("photos");

    // --- Idempotency: skip if already processed ---
    const existingSnap = await photosRef
      .where("filename", "==", filename)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      if (existingSnap.docs[0].data().processingStatus === "ready") {
        console.log(`Photo ${filename} already processed, skipping`);
        return;
      }
    }

    const photoDocRef = existingSnap.empty ? null : existingSnap.docs[0].ref;

    async function markError(): Promise<void> {
      if (photoDocRef) {
        await photoDocRef.update({ processingStatus: "error" });
      }
    }

    // --- Validate booking exists and is in "editing" status ---
    const bookingSnap = await db.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists || bookingSnap.data()!.status !== "editing") {
      console.error(
        `Booking ${bookingId} not found or not in editing status. Deleting upload.`,
      );
      await bucket.file(filePath).delete().catch(() => {});
      return;
    }

    // --- Download and validate file ---
    const [fileBuffer] = await bucket.file(filePath).download();

    if (!isJpeg(fileBuffer)) {
      console.error(`File ${filename} is not a valid JPEG`);
      await markError();
      await bucket.file(filePath).delete().catch(() => {});
      return;
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      console.error(`File ${filename} exceeds 30MB limit`);
      await markError();
      await bucket.file(filePath).delete().catch(() => {});
      return;
    }

    try {
      // --- Read metadata ---
      const metadata = await sharp(fileBuffer).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      // --- Generate thumbnail (400px wide, 80% quality) ---
      const thumbBuffer = await sharp(fileBuffer)
        .rotate() // auto-rotate based on EXIF
        .resize(THUMB_WIDTH)
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer();

      const thumbPath = `processed/${bookingId}/thumb_${filename}`;
      await withRetry(() =>
        bucket
          .file(thumbPath)
          .save(thumbBuffer, { contentType: "image/jpeg" }),
      );

      // --- Generate watermarked copy (1600px long edge, 85% quality) ---
      const photographerSnap = await db
        .collection("photographers")
        .doc(photographerId)
        .get();
      const businessName =
        photographerSnap.data()?.businessName ?? "ShotReady";

      const resizedBuffer = await sharp(fileBuffer)
        .rotate()
        .resize({
          width: WM_MAX_DIMENSION,
          height: WM_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: WM_QUALITY })
        .toBuffer();

      // Get actual dimensions after resize for the SVG overlay
      const resizedMeta = await sharp(resizedBuffer).metadata();
      const wmWidth = resizedMeta.width ?? WM_MAX_DIMENSION;
      const wmHeight = resizedMeta.height ?? WM_MAX_DIMENSION;

      const watermarkSvg = generateWatermarkSvg(
        wmWidth,
        wmHeight,
        businessName,
      );

      const wmBuffer = await sharp(resizedBuffer)
        .composite([{ input: watermarkSvg, top: 0, left: 0 }])
        .jpeg({ quality: WM_QUALITY })
        .toBuffer();

      const wmPath = `processed/${bookingId}/wm_${filename}`;
      await withRetry(() =>
        bucket.file(wmPath).save(wmBuffer, { contentType: "image/jpeg" }),
      );

      // --- Compute sortOrder from existing ready photos ---
      const countSnap = await photosRef
        .where("processingStatus", "==", "ready")
        .count()
        .get();
      const sortOrder = countSnap.data().count;

      // --- Update or create photo document ---
      const photoData = {
        filename,
        storagePath: filePath,
        watermarkedPath: wmPath,
        thumbnailPath: thumbPath,
        width,
        height,
        fileSize: fileBuffer.length,
        sortOrder,
        isSelected: true,
        processingStatus: "ready",
        processedAt: FieldValue.serverTimestamp(),
      };

      if (photoDocRef) {
        // Existing doc (created by web companion) — merge preserves uploadedAt
        await photoDocRef.set(photoData, { merge: true });
      } else {
        // No doc yet (race condition or alternative upload method)
        await photosRef.add({
          ...photoData,
          uploadedAt: FieldValue.serverTimestamp(),
        });
      }

      console.log(`Processed ${filename} for booking ${bookingId}`);
    } catch (err) {
      console.error(`Error processing ${filename}:`, err);
      await markError();
    }
  },
);
```

- [ ] **Step 2: Verify it compiles**

```bash
cd functions && pnpm typecheck
```

Expected: PASS

---

### Task 3: Create media-cleanup.ts — Photo deletion and retention

**Files:**
- Create: `functions/src/media-cleanup.ts`

**Context for implementer:**
- `mediaOnPhotoDeleted`: Firestore `onDocumentDeleted` trigger on `bookings/{bookingId}/photos/{photoId}`. When a photo document is deleted (by the web companion's delete button or by the retention function), delete all associated files from Cloud Storage: original, thumbnail, watermarked, and MLS export (if exists).
- `mediaRetentionCleanup`: Daily scheduled function (03:00 UTC). Queries closed bookings where `delivery.deliveredAt` is older than 90 days. Deletes all photo documents (which triggers `mediaOnPhotoDeleted` for Storage cleanup). Marks booking with `photosExpired: true`.
- Both functions use the default config (256MiB is fine, no image processing).

- [ ] **Step 1: Create functions/src/media-cleanup.ts**

```typescript
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { REGION } from "./config";

// ---------------------------------------------------------------------------
// Photo deletion cleanup — triggered when a photo doc is deleted
// ---------------------------------------------------------------------------

export const mediaOnPhotoDeleted = onDocumentDeleted(
  {
    document: "bookings/{bookingId}/photos/{photoId}",
    region: REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const bucket = getStorage().bucket();
    const bookingId = event.params.bookingId;

    // Collect all file paths to delete
    const paths: string[] = [];
    if (data.storagePath) paths.push(data.storagePath);
    if (data.watermarkedPath) paths.push(data.watermarkedPath);
    if (data.thumbnailPath) paths.push(data.thumbnailPath);
    // MLS export path (may exist if delivery was generated — see spec 17)
    if (data.filename) {
      paths.push(`processed/${bookingId}/mls_${data.filename}`);
    }

    await Promise.allSettled(
      paths.map((p) => bucket.file(p).delete().catch(() => {})),
    );

    console.log(
      `Cleaned up ${paths.length} files for photo ${event.params.photoId}`,
    );
  },
);

// ---------------------------------------------------------------------------
// 90-day retention cleanup — runs daily at 03:00 UTC
// ---------------------------------------------------------------------------

const RETENTION_DAYS = 90;

export const mediaRetentionCleanup = onSchedule(
  {
    schedule: "every day 03:00",
    region: REGION,
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromDate(
      new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000),
    );

    // Query closed bookings with delivery older than 90 days
    const expiredSnap = await db
      .collection("bookings")
      .where("status", "==", "closed")
      .where("delivery.deliveredAt", "<=", cutoff)
      .get();

    let cleanedCount = 0;

    for (const bookingDoc of expiredSnap.docs) {
      // Skip already-expired bookings (checked in code, not query,
      // because Firestore can't combine range + inequality on different fields)
      if (bookingDoc.data().photosExpired === true) continue;

      const bookingId = bookingDoc.id;

      // Delete all photo documents in subcollection.
      // The mediaOnPhotoDeleted trigger handles Storage file cleanup.
      const photosSnap = await db
        .collection("bookings")
        .doc(bookingId)
        .collection("photos")
        .get();

      if (photosSnap.empty) {
        await bookingDoc.ref.update({ photosExpired: true });
        continue;
      }

      const batch = db.batch();
      photosSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      await bookingDoc.ref.update({ photosExpired: true });
      cleanedCount++;

      console.log(
        `Expired ${photosSnap.size} photos for booking ${bookingId}`,
      );
    }

    console.log(
      `Retention cleanup complete: ${cleanedCount} bookings processed`,
    );
  },
);
```

- [ ] **Step 2: Verify it compiles**

```bash
cd functions && pnpm typecheck
```

Expected: PASS

---

### Task 4: Wire exports, typecheck, and commit

**Files:**
- Modify: `functions/src/index.ts:15-16`

- [ ] **Step 1: Update index.ts to export media functions**

Replace the commented-out media line in `functions/src/index.ts`:

```typescript
// export { mediaOnUpload, mediaGenerateMlsExport, mediaGenerateDownloadUrl } from "./media";
```

With:

```typescript
export { mediaOnUpload } from "./media";
export { mediaOnPhotoDeleted, mediaRetentionCleanup } from "./media-cleanup";
```

Note: `mediaGenerateMlsExport` and `mediaGenerateDownloadUrl` are not implemented yet (specs 17).

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: PASS across all packages

- [ ] **Step 3: Commit**

```bash
git add functions/src/media.ts functions/src/media-cleanup.ts functions/src/index.ts
git commit -m "feat: add photo processing pipeline with watermark, thumbnail, and retention"
```
