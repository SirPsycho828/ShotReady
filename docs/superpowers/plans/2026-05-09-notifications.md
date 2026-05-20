# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build notification dispatch infrastructure — FCM push + in-app notifications for photographers, SendGrid transactional emails for agents — triggered by booking lifecycle events.

**Architecture:** A Firestore `onDocumentCreated` trigger handles new bookings. A Firestore `onDocumentUpdated` trigger detects status/field changes on bookings and dispatches the appropriate combination of push notification (FCM), in-app notification (Firestore write), and agent email (SendGrid). Each channel is independent — one failing doesn't block others. Photographer notification preferences are respected for push.

**Tech Stack:** Firebase Cloud Functions v2 (Firestore triggers), Firebase Admin SDK (FCM, Firestore), SendGrid Mail (`@sendgrid/mail`)

**Deferred:** Email digest, notification list UI, preferences UI, approval reminder timer, notification cleanup, FCM token registration, badge count UI

---

## File Structure

**Create:**
- `functions/src/email.ts` — SendGrid email helper with branded HTML template builder
- `functions/src/notifications.ts` — Firestore triggers, FCM push helper, in-app notification writer

**Modify:**
- `functions/package.json` — Add `@sendgrid/mail`
- `functions/src/index.ts` — Export notification triggers

---

## Context

### Shared Types (already defined)

```typescript
// packages/shared/src/types/notification.ts
type NotificationType = "booking_new" | "booking_confirmed" | "booking_declined" | ... ;
interface AppNotification { type; title; body; bookingId; isRead; createdAt; }

// packages/shared/src/types/photographer.ts
interface PhotographerNotificationPrefs {
  pushEnabled; pushBookingNew; pushPaymentReceived; pushProofingComplete; pushOverdue;
  emailDigest; emailDigestHour;
}
```

### Config (already defined in `functions/src/config.ts`)

- `sendgridApiKey` — `defineString("SENDGRID_API_KEY")`
- `FUNCTIONS_CONFIG.notifications` — `{ memory: "256MiB", timeoutSeconds: 60 }`

### Photographer fields used

- `fcmToken: string | null` — FCM device token for push
- `notifications: PhotographerNotificationPrefs` — push preferences
- `businessName`, `email`, `branding.logoUrl`, `branding.accentColor` — for email templates

---

### Task 1: Install SendGrid + create email helper

**Files:**
- Modify: `functions/package.json`
- Create: `functions/src/email.ts`

- [ ] **Step 1: Install @sendgrid/mail**

```bash
cd functions && pnpm add @sendgrid/mail
```

- [ ] **Step 2: Create functions/src/email.ts**

```typescript
import sgMail from "@sendgrid/mail";
import { sendgridApiKey } from "./config";

interface EmailParams {
  to: string;
  subject: string;
  photographerName: string;
  photographerEmail: string;
  logoUrl: string | null;
  accentColor: string;
  heading: string;
  body: string;
  ctaText: string | null;
  ctaUrl: string | null;
}

function buildHtml(params: EmailParams): string {
  const logo = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="${params.photographerName}" style="max-height:40px;margin-bottom:12px;" /><br/>`
    : "";

  const cta = params.ctaText && params.ctaUrl
    ? `<p style="margin:24px 0;"><a href="${params.ctaUrl}" style="background-color:${params.accentColor};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">${params.ctaText}</a></p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:100%;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e5e5e5;">
${logo}<span style="font-size:16px;font-weight:600;color:#111;">${params.photographerName}</span>
</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;color:#111;">${params.heading}</h1>
<p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.6;">${params.body}</p>
${cta}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e5e5;text-align:center;">
<span style="font-size:12px;color:#999;">${params.photographerName}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendAgentEmail(params: EmailParams): Promise<void> {
  sgMail.setApiKey(sendgridApiKey.value());
  try {
    await sgMail.send({
      to: params.to,
      from: { name: params.photographerName, email: "noreply@shotready.com" },
      replyTo: params.photographerEmail,
      subject: params.subject,
      html: buildHtml(params),
    });
    console.log(`Email sent to ${params.to}: ${params.subject}`);
  } catch (err) {
    console.error(`Failed to send email to ${params.to}:`, err);
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 2: Create notification triggers

**Files:**
- Create: `functions/src/notifications.ts`

This file implements:
- `writeNotification()` — writes to `photographers/{uid}/notifications`
- `sendPush()` — sends FCM push respecting preferences
- `notificationsOnBookingCreated` — new booking trigger
- `notificationsOnBookingUpdated` — booking update trigger (handles all status transitions)

- [ ] **Step 1: Create functions/src/notifications.ts**

```typescript
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
      // Stale token — clear it
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

    // In-app notification
    await writeNotification(
      booking.photographerId,
      "booking_new",
      title,
      body,
      bookingId,
    );

    // Push (if enabled)
    if (
      photographer.notifications.pushEnabled &&
      photographer.notifications.pushBookingNew
    ) {
      await sendPush(photographer.fcmToken, title, body, bookingId);
    }

    // Agent confirmation email
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

    // --- Status transitions ---

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
      // Get invoice total
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
      // Photographer push
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

      // Agent reminder email
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
      // Photographer push + in-app
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

      // Agent receipt email
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

    // --- Field-level changes (non-status) ---

    // Agent completed proofing selections
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

    // Agent viewed proofing gallery (in-app only)
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
```

- [ ] **Step 2: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 3: Wire exports, typecheck, and commit

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Export notification triggers from index.ts**

Replace the commented-out notifications line:
```typescript
// export { notificationsOnBookingChange } from "./notifications";
```

With:
```typescript
export { notificationsOnBookingCreated, notificationsOnBookingUpdated } from "./notifications";
```

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: PASS across all packages

- [ ] **Step 3: Commit**

```bash
git add functions/src/email.ts functions/src/notifications.ts functions/src/index.ts functions/package.json pnpm-lock.yaml
git commit -m "feat: add notification dispatch with FCM push, in-app notifications, and SendGrid agent emails"
```
