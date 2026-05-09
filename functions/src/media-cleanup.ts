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
