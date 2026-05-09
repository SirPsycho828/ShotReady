import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { REGION, FUNCTIONS_CONFIG } from "./config";
import { sendAgentEmail } from "./email";
import type { NotificationType } from "@shotready/shared";

const BASE_URL = "https://app.shotready.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PhotographerInfo {
  businessName: string;
  email: string;
  logoUrl: string | null;
  accentColor: string;
  fcmToken: string | null;
  notifications: {
    pushEnabled: boolean;
    pushBookingNew: boolean;
    pushPaymentReceived: boolean;
    pushProofingComplete: boolean;
    pushOverdue: boolean;
  };
}

async function getPhotographer(
  photographerId: string,
): Promise<PhotographerInfo | null> {
  const snap = await getFirestore()
    .collection("photographers")
    .doc(photographerId)
    .get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    businessName: d.businessName ?? "Photographer",
    email: d.email ?? "",
    logoUrl: d.branding?.logoUrl ?? null,
    accentColor: d.branding?.accentColor ?? "#2563EB",
    fcmToken: d.fcmToken ?? null,
    notifications: {
      pushEnabled: d.notifications?.pushEnabled ?? true,
      pushBookingNew: d.notifications?.pushBookingNew ?? true,
      pushPaymentReceived: d.notifications?.pushPaymentReceived ?? true,
      pushProofingComplete: d.notifications?.pushProofingComplete ?? true,
      pushOverdue: d.notifications?.pushOverdue ?? true,
    },
  };
}

async function writeNotification(
  photographerId: string,
  type: NotificationType,
  title: string,
  body: string,
  bookingId: string,
): Promise<void> {
  await getFirestore()
    .collection("photographers")
    .doc(photographerId)
    .collection("notifications")
    .add({
      type,
      title,
      body,
      bookingId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
}

async function sendPush(
  fcmToken: string | null,
  title: string,
  body: string,
  bookingId: string,
): Promise<void> {
  if (!fcmToken) return;
  try {
    await getMessaging().send({
      token: fcmToken,
      notification: { title, body },
      data: { bookingId },
      apns: { payload: { aps: { sound: "default" } } },
      android: { notification: { sound: "default" } },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      const snap = await getFirestore()
        .collection("photographers")
        .where("fcmToken", "==", fcmToken)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({ fcmToken: null });
      }
      console.warn("Cleared stale FCM token");
    } else {
      console.error("FCM send failed:", err);
    }
  }
}

function formatAddress(address: string): string {
  return address.split(",")[0];
}

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Trigger: New booking created
// ---------------------------------------------------------------------------

export const notificationsOnBookingCreated = onDocumentCreated(
  {
    document: "bookings/{bookingId}",
    region: REGION,
    memory: FUNCTIONS_CONFIG.notifications.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.notifications.timeoutSeconds,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const booking = snap.data();
    const bookingId = snap.id;
    const photographer = await getPhotographer(booking.photographerId);
    if (!photographer) return;

    const address = formatAddress(booking.property.address);
    const title = "New Booking Request";
    const body = `${booking.agent.name} wants to book ${address}`;

    await writeNotification(
      booking.photographerId,
      "booking_new",
      title,
      body,
      bookingId,
    );

    if (
      photographer.notifications.pushEnabled &&
      photographer.notifications.pushBookingNew
    ) {
      await sendPush(photographer.fcmToken, title, body, bookingId);
    }

    const bookingUrl = `${BASE_URL}/b/${booking.agentToken}`;
    await sendAgentEmail({
      to: booking.agent.email,
      subject: `Booking request received — ${address}`,
      photographerName: photographer.businessName,
      photographerEmail: photographer.email,
      logoUrl: photographer.logoUrl,
      accentColor: photographer.accentColor,
      heading: "Booking Request Received",
      body: `Your booking request for ${address} has been submitted. ${photographer.businessName} will review and confirm shortly.`,
      ctaText: "View Booking",
      ctaUrl: bookingUrl,
    });
  },
);

// ---------------------------------------------------------------------------
// Trigger: Booking updated
// ---------------------------------------------------------------------------

export const notificationsOnBookingUpdated = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    region: REGION,
    memory: FUNCTIONS_CONFIG.notifications.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.notifications.timeoutSeconds,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const bookingId = event.data!.after.id;
    const photographer = await getPhotographer(after.photographerId);
    if (!photographer) return;

    const address = formatAddress(after.property.address);
    const bookingUrl = `${BASE_URL}/b/${after.agentToken}`;
    const statusChanged = before.status !== after.status;

    if (statusChanged && after.status === "confirmed") {
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Booking confirmed — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Booking Confirmed",
        body: `Your booking for ${address} has been confirmed by ${photographer.businessName}.`,
        ctaText: "View Booking",
        ctaUrl: bookingUrl,
      });
    }

    if (statusChanged && after.status === "declined") {
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Booking update — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Booking Not Available",
        body: `${photographer.businessName} is not available for this date. Please reach out directly to reschedule.`,
        ctaText: null,
        ctaUrl: null,
      });
    }

    if (statusChanged && after.status === "cancelled") {
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Booking cancelled — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Booking Cancelled",
        body: `The booking for ${address} has been cancelled.`,
        ctaText: null,
        ctaUrl: null,
      });
    }

    if (statusChanged && after.status === "proofing") {
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Your photos are ready for review — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Photos Ready for Review",
        body: `Your photos for ${address} are ready. Tap each photo to select your favorites for final delivery.`,
        ctaText: "Review Photos",
        ctaUrl: bookingUrl,
      });
    }

    if (statusChanged && after.status === "delivered") {
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Your photos are ready — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Photos Delivered",
        body: `Your photos for ${address} are ready to download. Photos are available for 90 days.`,
        ctaText: "Download Photos",
        ctaUrl: bookingUrl,
      });
    }

    if (statusChanged && after.status === "invoiced") {
      let amount = "";
      if (after.invoiceId) {
        const invSnap = await getFirestore()
          .collection("invoices")
          .doc(after.invoiceId)
          .get();
        if (invSnap.exists) {
          amount = " for " + formatCents(invSnap.data()!.total);
        }
      }
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Invoice from ${photographer.businessName} — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Invoice",
        body: `You have a new invoice${amount} for photography services at ${address}.`,
        ctaText: "Pay Invoice",
        ctaUrl: bookingUrl,
      });
    }

    if (statusChanged && after.status === "overdue") {
      const overdueTitle = "Invoice Overdue";
      const overdueBody = `Invoice for ${address} is past due`;
      await writeNotification(
        after.photographerId,
        "invoice_overdue",
        overdueTitle,
        overdueBody,
        bookingId,
      );
      if (
        photographer.notifications.pushEnabled &&
        photographer.notifications.pushOverdue
      ) {
        await sendPush(
          photographer.fcmToken,
          overdueTitle,
          overdueBody,
          bookingId,
        );
      }
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Payment reminder — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Payment Reminder",
        body: `This invoice for ${address} is past due. Please complete payment at your earliest convenience.`,
        ctaText: "Pay Invoice",
        ctaUrl: bookingUrl,
      });
    }

    if (statusChanged && after.status === "paid") {
      let amount = "";
      if (after.invoiceId) {
        const invSnap = await getFirestore()
          .collection("invoices")
          .doc(after.invoiceId)
          .get();
        if (invSnap.exists) {
          amount = formatCents(invSnap.data()!.total) + " ";
        }
      }
      const paidTitle = "Payment Received";
      const paidBody = `${amount}received for ${address}`;
      await writeNotification(
        after.photographerId,
        "payment_received",
        paidTitle,
        paidBody,
        bookingId,
      );
      if (
        photographer.notifications.pushEnabled &&
        photographer.notifications.pushPaymentReceived
      ) {
        await sendPush(
          photographer.fcmToken,
          paidTitle,
          paidBody,
          bookingId,
        );
      }
      await sendAgentEmail({
        to: after.agent.email,
        subject: `Payment received — ${address}`,
        photographerName: photographer.businessName,
        photographerEmail: photographer.email,
        logoUrl: photographer.logoUrl,
        accentColor: photographer.accentColor,
        heading: "Payment Received",
        body: `Thank you! Your payment for ${address} has been received.`,
        ctaText: "View Booking",
        ctaUrl: bookingUrl,
      });
    }

    // Field-level changes (non-status)
    if (!before.proofing?.completedAt && after.proofing?.completedAt) {
      const selectTitle = "Photos Selected";
      const selectBody = `${after.agent.name} selected ${after.proofing.selectedCount ?? ""} photos for ${address}`;
      await writeNotification(
        after.photographerId,
        "proofing_complete",
        selectTitle,
        selectBody,
        bookingId,
      );
      if (
        photographer.notifications.pushEnabled &&
        photographer.notifications.pushProofingComplete
      ) {
        await sendPush(
          photographer.fcmToken,
          selectTitle,
          selectBody,
          bookingId,
        );
      }
    }

    if (!before.proofing?.viewedAt && after.proofing?.viewedAt) {
      await writeNotification(
        after.photographerId,
        "proofing_viewed",
        "Gallery Viewed",
        `${after.agent.name} is reviewing photos for ${address}`,
        bookingId,
      );
    }
  },
);
