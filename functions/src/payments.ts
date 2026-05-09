import Stripe from "stripe";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  REGION,
  FUNCTIONS_CONFIG,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./config";

// ---------------------------------------------------------------------------
// Stripe client (lazy — secret not available at import time)
// ---------------------------------------------------------------------------

function getStripe() {
  return new Stripe(stripeSecretKey.value());
}

// ---------------------------------------------------------------------------
// createInvoiceDraft — called internally from deliverPhotos
// ---------------------------------------------------------------------------

export async function createInvoiceDraft(
  bookingId: string,
  photographerId: string,
  agent: { email: string; name: string },
  pkg: { name: string; price: number },
): Promise<string> {
  const db = getFirestore();
  const invoiceRef = db.collection("invoices").doc();

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  await invoiceRef.set({
    bookingId,
    photographerId,
    agentEmail: agent.email,
    agentName: agent.name,
    lineItems: [{ description: pkg.name, amount: pkg.price }],
    subtotal: pkg.price,
    total: pkg.price,
    status: "draft",
    stripe: { paymentIntentId: null, paymentUrl: null },
    dueDate: Timestamp.fromDate(dueDate),
    sentAt: null,
    paidAt: null,
    lastReminderAt: null,
    reminderCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return invoiceRef.id;
}

// ---------------------------------------------------------------------------
// paymentsSendInvoice — photographer sends the invoice
// ---------------------------------------------------------------------------

export const paymentsSendInvoice = onCall(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.payments.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.payments.timeoutSeconds,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const photographerId = request.auth.uid;
    const invoiceId = request.data?.invoiceId;
    if (typeof invoiceId !== "string") {
      throw new HttpsError("invalid-argument", "invoiceId is required.");
    }

    const db = getFirestore();

    // Get invoice
    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }
    const invoice = invoiceSnap.data()!;

    if (invoice.photographerId !== photographerId) {
      throw new HttpsError("permission-denied", "Not your invoice.");
    }
    if (invoice.status !== "draft") {
      throw new HttpsError(
        "failed-precondition",
        "Invoice has already been sent.",
      );
    }
    if (invoice.total <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Invoice total must be greater than zero.",
      );
    }

    // Verify Stripe is connected
    const photographerSnap = await db
      .collection("photographers")
      .doc(photographerId)
      .get();
    const photographer = photographerSnap.data();
    if (!photographer?.stripe?.isConnected) {
      throw new HttpsError(
        "failed-precondition",
        "Connect your Stripe account in Settings to send invoices.",
      );
    }

    // Get booking for agent token + address
    const bookingRef = db.collection("bookings").doc(invoice.bookingId);
    const bookingSnap = await bookingRef.get();
    const booking = bookingSnap.data()!;
    const address = booking.property.address.split(",")[0];

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: invoice.total,
            product_data: {
              name: `Photography - ${address}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: { invoiceId, bookingId: invoice.bookingId },
      },
      success_url: `https://app.shotready.com/b/${booking.agentToken}?payment=success`,
      cancel_url: `https://app.shotready.com/b/${booking.agentToken}`,
    });

    // Update invoice
    await invoiceRef.update({
      status: "sent",
      "stripe.paymentUrl": session.url,
      sentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Transition booking to invoiced
    await bookingRef.update({
      status: "invoiced",
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Invoice ${invoiceId} sent for booking ${invoice.bookingId}`);
    return { success: true };
  },
);

// ---------------------------------------------------------------------------
// paymentsStripeWebhook — handles Stripe events
// ---------------------------------------------------------------------------

export const paymentsStripeWebhook = onRequest(
  { region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string") {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: { type: string; data: { object: Record<string, unknown> } };
    try {
      event = getStripe().webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value(),
      ) as unknown as typeof event;
    } catch {
      res.status(400).send("Invalid signature");
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const metadata = pi.metadata as Record<string, string> | undefined;
      const invoiceId = metadata?.invoiceId;
      const bookingId = metadata?.bookingId;

      if (!invoiceId || !bookingId) {
        console.warn(
          "payment_intent.succeeded missing metadata",
          pi.id,
        );
        res.json({ received: true });
        return;
      }

      const db = getFirestore();
      const invoiceRef = db.collection("invoices").doc(invoiceId);
      const invoiceSnap = await invoiceRef.get();

      // Idempotency: skip if already paid
      if (invoiceSnap.exists && invoiceSnap.data()?.status === "paid") {
        res.json({ received: true });
        return;
      }

      await invoiceRef.update({
        status: "paid",
        "stripe.paymentIntentId": pi.id as string,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection("bookings").doc(bookingId).update({
        status: "paid",
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Payment received for invoice ${invoiceId}`);
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const metadata = pi.metadata as Record<string, string> | undefined;
      const lastError = pi.last_payment_error as
        | { message?: string }
        | undefined;
      console.warn(
        `Payment failed for ${metadata?.invoiceId}:`,
        lastError?.message,
      );
    }

    res.json({ received: true });
  },
);

// ---------------------------------------------------------------------------
// paymentsOverdueCheck — daily at 09:00 UTC
// ---------------------------------------------------------------------------

export const paymentsOverdueCheck = onSchedule(
  {
    schedule: "every day 09:00",
    region: REGION,
    memory: FUNCTIONS_CONFIG.payments.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.payments.timeoutSeconds,
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    // Find sent invoices past due date
    const overdueSnap = await db
      .collection("invoices")
      .where("status", "==", "sent")
      .where("dueDate", "<", now)
      .get();

    for (const doc of overdueSnap.docs) {
      const invoice = doc.data();
      await doc.ref.update({
        status: "overdue",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection("bookings").doc(invoice.bookingId).update({
        status: "overdue",
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Invoice ${doc.id} marked overdue`);
      // Email notifications deferred to Spec 19
    }
  },
);
