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
);

// ---------------------------------------------------------------------------
// bookingToggleSelection — batch-update photo selections
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
