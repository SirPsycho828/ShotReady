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
