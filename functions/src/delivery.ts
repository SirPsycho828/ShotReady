import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
import JSZip from "jszip";
import { REGION, FUNCTIONS_CONFIG } from "./config";
import { createInvoiceDraft } from "./payments";

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

    // --- Auto-create invoice draft ---
    try {
      const invoiceId = await createInvoiceDraft(
        bookingId,
        photographerId,
        { email: booking.agent.email, name: booking.agent.name },
        { name: booking.package.name, price: booking.package.price },
      );
      await bookingRef.update({ invoiceId });
    } catch (err) {
      console.error("Failed to create invoice draft:", err);
      // Delivery succeeded — don't fail the entire operation
    }

    console.log(
      `Delivered ${photosSnap.size} photos for booking ${bookingId}`,
    );

    return { success: true, photoCount: photosSnap.size };
  },
);
