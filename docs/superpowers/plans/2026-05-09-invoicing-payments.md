# Invoicing & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the invoicing pipeline that auto-drafts invoices at delivery, lets photographers edit line items and send via Stripe, and gives agents a payment page with Stripe Checkout.

**Architecture:** `deliverPhotos` auto-creates an invoice draft in Firestore from the booking's package snapshot. The photographer reviews/edits line items on mobile, then triggers `paymentsSendInvoice` which creates a Stripe Checkout Session and transitions booking to `invoiced`. The agent's evolving URL shows invoice details + a "Pay Now" link. Stripe `payment_intent.succeeded` webhook updates invoice and booking to `paid`. `paymentsOverdueCheck` runs daily to mark overdue invoices.

**Tech Stack:** Firebase Cloud Functions v2, Stripe (Checkout Sessions), React Native (invoice editor), React + Tailwind CSS (agent payment page)

**Deferred:** Invoice list/management screen, void invoice, resend invoice, Stripe OAuth connect flow (Settings), email sending (Spec 19), reminder follow-ups

---

## File Structure

**Create:**
- `functions/src/payments.ts` — `createInvoiceDraft` helper, `paymentsSendInvoice` callable, `paymentsStripeWebhook` HTTP handler, `paymentsOverdueCheck` scheduled function
- `apps/mobile/src/hooks/useInvoice.ts` — Real-time invoice subscription + mutation functions
- `apps/mobile/src/components/booking/InvoiceEditor.tsx` — Editable line items, total, send button
- `apps/web/src/components/delivery/InvoiceSection.tsx` — Agent-facing invoice display + pay button

**Modify:**
- `functions/package.json` — Add `stripe` dependency
- `functions/src/delivery.ts` — Auto-create invoice draft after delivery
- `functions/src/index.ts` — Export payment functions
- `functions/src/booking.ts` — Handle invoiced/overdue/paid in `bookingGetByToken`
- `apps/mobile/src/components/booking/BookingActions.tsx` — Show InvoiceEditor for delivered, invoice summary for invoiced/overdue
- `apps/web/src/hooks/useProofingGallery.ts` — Add `invoice` to `ProofingData`
- `apps/web/src/components/delivery/DownloadPage.tsx` — Remove `min-h-screen` for composability
- `apps/web/src/pages/BookingView.tsx` — Render invoice section for invoiced/overdue/paid

---

## Context

### Invoice Type (already defined in `packages/shared/src/types/invoice.ts`)

```typescript
interface InvoiceLineItem { description: string; amount: number; /* cents */ }
interface Invoice {
  bookingId: string; photographerId: string;
  agentEmail: string; agentName: string;
  lineItems: InvoiceLineItem[]; subtotal: number; total: number;
  status: InvoiceStatus; // "draft" | "sent" | "paid" | "overdue" | "void"
  stripe: { paymentIntentId: string | null; paymentUrl: string | null; };
  dueDate: Timestamp; sentAt: Timestamp | null; paidAt: Timestamp | null;
  lastReminderAt: Timestamp | null; reminderCount: number;
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

### Stripe Config (already in `functions/src/config.ts`)

```typescript
stripeSecretKey   // defineString("STRIPE_SECRET_KEY")
stripeWebhookSecret // defineString("STRIPE_WEBHOOK_SECRET")
```

### Booking Invoice Field

`booking.invoiceId: string | null` — already on Booking type

---

### Task 1: Install stripe + create payments Cloud Functions

**Files:**
- Modify: `functions/package.json`
- Create: `functions/src/payments.ts`

- [ ] **Step 1: Install stripe**

```bash
cd functions && pnpm add stripe
```

- [ ] **Step 2: Create functions/src/payments.ts**

```typescript
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

function getStripe(): Stripe {
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

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value(),
      );
    } catch {
      res.status(400).send("Invalid signature");
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { invoiceId, bookingId } = paymentIntent.metadata;

      if (!invoiceId || !bookingId) {
        console.warn("payment_intent.succeeded missing metadata", paymentIntent.id);
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
        "stripe.paymentIntentId": paymentIntent.id,
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
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn(
        `Payment failed for ${paymentIntent.metadata.invoiceId}:`,
        paymentIntent.last_payment_error?.message,
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
```

- [ ] **Step 3: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 2: Auto-create invoice draft in deliverPhotos

**Files:**
- Modify: `functions/src/delivery.ts`

- [ ] **Step 1: Add invoice creation after delivery**

At the top of `delivery.ts`, add import:

```typescript
import { createInvoiceDraft } from "./payments";
```

After the existing `bookingRef.update()` call (the one that sets status to "delivered"), add:

```typescript
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
```

- [ ] **Step 2: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 3: Mobile invoice hook + editor + BookingActions update

**Files:**
- Create: `apps/mobile/src/hooks/useInvoice.ts`
- Create: `apps/mobile/src/components/booking/InvoiceEditor.tsx`
- Modify: `apps/mobile/src/components/booking/BookingActions.tsx`

- [ ] **Step 1: Create useInvoice hook**

Create `apps/mobile/src/hooks/useInvoice.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import firestore from "@react-native-firebase/firestore";

export interface InvoiceLineItem {
  description: string;
  amount: number; // cents
}

export interface InvoiceData {
  id: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  status: string;
}

export function useInvoice(invoiceId: string | null) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .collection("invoices")
      .doc(invoiceId)
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            const data = snap.data()!;
            setInvoice({
              id: snap.id,
              lineItems: data.lineItems ?? [],
              subtotal: data.subtotal ?? 0,
              total: data.total ?? 0,
              status: data.status ?? "draft",
            });
          }
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [invoiceId]);

  const updateLineItems = useCallback(
    async (lineItems: InvoiceLineItem[]) => {
      if (!invoiceId) return;
      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      await firestore().collection("invoices").doc(invoiceId).update({
        lineItems,
        subtotal,
        total: subtotal,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [invoiceId],
  );

  return { invoice, loading, updateLineItems };
}
```

- [ ] **Step 2: Create InvoiceEditor component**

Create `apps/mobile/src/components/booking/InvoiceEditor.tsx`:

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { Button } from "@/components/ui";
import { useInvoice } from "@/hooks/useInvoice";
import { darkColors } from "@/theme/colors";
import { Plus, X } from "lucide-react-native";
import functions from "@react-native-firebase/functions";

interface InvoiceEditorProps {
  invoiceId: string;
  isOnline: boolean;
}

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDollars(text: string): number {
  const num = parseFloat(text.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function InvoiceEditor({ invoiceId, isOnline }: InvoiceEditorProps) {
  const { invoice, loading, updateLineItems } = useInvoice(invoiceId);
  const [sending, setSending] = useState(false);

  if (loading || !invoice) {
    return (
      <View className="py-md items-center">
        <Text className="text-body text-text-secondary">Loading invoice...</Text>
      </View>
    );
  }

  function handleDescriptionChange(index: number, description: string) {
    const updated = [...invoice!.lineItems];
    updated[index] = { ...updated[index], description };
    updateLineItems(updated);
  }

  function handleAmountChange(index: number, text: string) {
    const updated = [...invoice!.lineItems];
    updated[index] = { ...updated[index], amount: parseDollars(text) };
    updateLineItems(updated);
  }

  function handleAdd() {
    updateLineItems([...invoice!.lineItems, { description: "", amount: 0 }]);
  }

  function handleRemove(index: number) {
    if (invoice!.lineItems.length <= 1) return;
    updateLineItems(invoice!.lineItems.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (invoice!.total <= 0) {
      Alert.alert("Invalid Invoice", "Invoice total must be greater than zero.");
      return;
    }
    Alert.alert(
      "Send Invoice",
      `Send invoice for $${formatDollars(invoice!.total)} to the agent?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setSending(true);
            try {
              await functions().httpsCallable("paymentsSendInvoice")({
                invoiceId,
              });
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "Failed to send invoice.";
              Alert.alert("Error", message);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View className="bg-surface border border-border rounded-card p-md">
      <Text className="text-caption text-text-muted mb-sm">Invoice Draft</Text>

      {invoice.lineItems.map((item, index) => (
        <View key={index} className="flex-row items-center mb-sm">
          <TextInput
            className="flex-1 text-body text-text-primary bg-background border border-border rounded-sm px-sm py-xs mr-sm"
            value={item.description}
            onChangeText={(t) => handleDescriptionChange(index, t)}
            placeholder="Description"
            placeholderTextColor={darkColors.textMuted}
            maxLength={100}
          />
          <TextInput
            className="w-[90px] text-body text-text-primary bg-background border border-border rounded-sm px-sm py-xs mr-xs text-right"
            defaultValue={formatDollars(item.amount)}
            onEndEditing={(e) => handleAmountChange(index, e.nativeEvent.text)}
            placeholder="0.00"
            placeholderTextColor={darkColors.textMuted}
            keyboardType="decimal-pad"
          />
          {invoice.lineItems.length > 1 && (
            <Pressable onPress={() => handleRemove(index)} hitSlop={8}>
              <X size={18} color={darkColors.textMuted} />
            </Pressable>
          )}
        </View>
      ))}

      <Pressable onPress={handleAdd} className="flex-row items-center mb-md">
        <Plus size={16} color={darkColors.accent} />
        <Text className="text-body text-accent ml-xs">Add Line Item</Text>
      </Pressable>

      <View className="flex-row justify-between items-center mb-md border-t border-border pt-sm">
        <Text className="text-body text-text-secondary font-semibold">Total</Text>
        <Text className="text-h2 text-text-primary">${formatDollars(invoice.total)}</Text>
      </View>

      <Button
        title="Send Invoice"
        onPress={handleSend}
        disabled={!isOnline || sending}
        loading={sending}
      />
    </View>
  );
}
```

- [ ] **Step 3: Update BookingActions**

In `apps/mobile/src/components/booking/BookingActions.tsx`:

Add import at top:
```typescript
import { InvoiceEditor } from "@/components/booking/InvoiceEditor";
```

Replace the delivered block:
```tsx
      {booking.status === "delivered" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Photos delivered. Invoice management coming soon.
          </Text>
        </View>
      )}
```

With:
```tsx
      {booking.status === "delivered" && (
        booking.invoiceId ? (
          <InvoiceEditor invoiceId={booking.invoiceId} isOnline={isOnline} />
        ) : (
          <View className="py-md items-center">
            <Text className="text-body text-text-secondary text-center">
              Creating invoice...
            </Text>
          </View>
        )
      )}
```

Replace the invoiced/overdue block:
```tsx
      {(booking.status === "invoiced" || booking.status === "overdue") && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Awaiting payment from agent.
          </Text>
        </View>
      )}
```

With:
```tsx
      {(booking.status === "invoiced" || booking.status === "overdue") && (
        <View className="bg-surface border border-border rounded-card p-md">
          <Text className="text-caption text-text-muted mb-xs">
            Invoice {booking.status === "overdue" ? "(Overdue)" : "(Sent)"}
          </Text>
          <Text className="text-body text-text-secondary text-center">
            Awaiting payment from agent.
          </Text>
        </View>
      )}
```

Update `hasActionButton` to include `delivered`:
```typescript
  const hasActionButton =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "shooting" ||
    (booking.status === "proofing" && !!booking.proofing?.completedAt) ||
    booking.status === "delivered" ||
    booking.status === "paid";
```

- [ ] **Step 4: Verify compilation**

```bash
cd apps/mobile && npx tsc --noEmit
```

---

### Task 4: Update bookingGetByToken for invoiced/overdue/paid

**Files:**
- Modify: `functions/src/booking.ts`

- [ ] **Step 1: Extend status guard**

In `functions/src/booking.ts`, replace:

```typescript
    if (booking.status !== "proofing" && booking.status !== "delivered") {
```

With:

```typescript
    const FULL_STATUSES = ["proofing", "delivered", "invoiced", "overdue", "paid"];
    if (!FULL_STATUSES.includes(booking.status)) {
```

- [ ] **Step 2: Add invoice data to delivered/invoiced/overdue/paid response**

At the end of the `bookingGetByToken` function (after the delivered section that builds `photos` and `delivery` data), before the final `return`, add invoice lookup:

```typescript
    // Get invoice data for invoiced/overdue/paid statuses
    let invoice = undefined;
    if (
      ["invoiced", "overdue", "paid"].includes(booking.status) &&
      booking.invoiceId
    ) {
      const invoiceSnap = await db
        .collection("invoices")
        .doc(booking.invoiceId)
        .get();
      if (invoiceSnap.exists) {
        const inv = invoiceSnap.data()!;
        invoice = {
          lineItems: inv.lineItems as { description: string; amount: number }[],
          total: inv.total as number,
          status: inv.status as string,
          dueDate: inv.dueDate?.toDate?.()?.toISOString() ?? null,
          sentAt: inv.sentAt?.toDate?.()?.toISOString() ?? null,
          paidAt: inv.paidAt?.toDate?.()?.toISOString() ?? null,
          paymentUrl: inv.stripe?.paymentUrl ?? null,
        };
      }
    }
```

Then update the final return to include `invoice`:

```typescript
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
      invoice,
    };
```

- [ ] **Step 3: Verify compilation**

```bash
cd functions && npx tsc --noEmit
```

---

### Task 5: Web InvoiceSection + DownloadPage composability + BookingView

**Files:**
- Modify: `apps/web/src/hooks/useProofingGallery.ts` — Add `invoice` to `ProofingData`
- Modify: `apps/web/src/components/delivery/DownloadPage.tsx` — Remove `min-h-screen` wrapper
- Create: `apps/web/src/components/delivery/InvoiceSection.tsx`
- Modify: `apps/web/src/pages/BookingView.tsx` — Render for invoiced/overdue/paid

- [ ] **Step 1: Add invoice type to ProofingData**

In `apps/web/src/hooks/useProofingGallery.ts`, update `ProofingData`:

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
  invoice?: {
    lineItems: { description: string; amount: number }[];
    total: number;
    status: string;
    dueDate: string | null;
    sentAt: string | null;
    paidAt: string | null;
    paymentUrl: string | null;
  };
}
```

- [ ] **Step 2: Make DownloadPage composable**

In `apps/web/src/components/delivery/DownloadPage.tsx`, replace the outer wrapper:

```tsx
<div className="min-h-screen bg-white">
```

With just:

```tsx
<div>
```

The parent (BookingView) will handle the full-page wrapper.

- [ ] **Step 3: Create InvoiceSection component**

Create `apps/web/src/components/delivery/InvoiceSection.tsx`:

```tsx
import type { ProofingData } from "../../hooks/useProofingGallery";

interface InvoiceSectionProps {
  data: ProofingData;
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function InvoiceSection({ data }: InvoiceSectionProps) {
  const invoice = data.invoice;
  if (!invoice) return null;

  const accentColor = data.booking.accentColor;
  const address = data.booking.address.split(",")[0];
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const sentDate = invoice.sentAt
    ? new Date(invoice.sentAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="border-t border-gray-200">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {isOverdue && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-sm">
              This invoice is past due. Please complete payment at your earliest
              convenience.
            </p>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Invoice
          </h2>

          <div className="text-sm text-gray-600 space-y-1 mb-6">
            <p>
              <span className="text-gray-400">From:</span>{" "}
              {data.booking.photographerName}
            </p>
            <p>
              <span className="text-gray-400">For:</span> {address} —
              Photography
            </p>
            {sentDate && (
              <p>
                <span className="text-gray-400">Date:</span> {sentDate}
              </p>
            )}
            {dueDate && (
              <p>
                <span className="text-gray-400">Due:</span> {dueDate}
              </p>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            {invoice.lineItems.map((item, i) => (
              <div
                key={i}
                className="flex justify-between px-4 py-3 border-b border-gray-100 last:border-b-0"
              >
                <span className="text-gray-700">{item.description}</span>
                <span className="text-gray-900 font-medium">
                  {formatDollars(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-gray-100 font-semibold">
              <span className="text-gray-700">Total</span>
              <span className="text-gray-900">
                {formatDollars(invoice.total)}
              </span>
            </div>
          </div>

          {isPaid ? (
            <div className="flex items-center justify-center gap-2 w-full py-4 rounded-lg bg-green-50 border border-green-200 text-green-700 font-semibold text-lg">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Paid{paidDate ? ` on ${paidDate}` : ""}
            </div>
          ) : invoice.paymentUrl ? (
            <a
              href={invoice.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-lg text-white font-semibold text-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              Pay {formatDollars(invoice.total)} Now
            </a>
          ) : null}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Update BookingView**

In `apps/web/src/pages/BookingView.tsx`:

Add import:
```typescript
import { InvoiceSection } from "../components/delivery/InvoiceSection";
```

Wrap the existing `delivered` case in a full-page div (since DownloadPage no longer has `min-h-screen`):

```tsx
  if (gallery.data.booking.status === "delivered") {
    return (
      <div className="min-h-screen bg-white">
        <DownloadPage data={gallery.data} />
      </div>
    );
  }
```

Add the invoiced/overdue/paid case before the fallback:

```tsx
  if (["invoiced", "overdue", "paid"].includes(gallery.data.booking.status)) {
    return (
      <div className="min-h-screen bg-white">
        <DownloadPage data={gallery.data} />
        <InvoiceSection data={gallery.data} />
      </div>
    );
  }
```

- [ ] **Step 5: Verify compilation**

```bash
cd apps/web && npx tsc --noEmit
```

---

### Task 6: Wire exports, typecheck, and commit

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Export payment functions from index.ts**

Replace the commented-out payments line:
```typescript
// export { paymentsCreateInvoice, paymentsStripeWebhook, paymentsOverdueCheck } from "./payments";
```

With:
```typescript
export { paymentsSendInvoice, paymentsStripeWebhook, paymentsOverdueCheck } from "./payments";
```

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: PASS across all packages

- [ ] **Step 3: Commit**

```bash
git add functions/src/payments.ts functions/src/delivery.ts functions/src/booking.ts functions/src/index.ts functions/package.json pnpm-lock.yaml apps/mobile/src/hooks/useInvoice.ts apps/mobile/src/components/booking/InvoiceEditor.tsx apps/mobile/src/components/booking/BookingActions.tsx apps/web/src/hooks/useProofingGallery.ts apps/web/src/components/delivery/DownloadPage.tsx apps/web/src/components/delivery/InvoiceSection.tsx apps/web/src/pages/BookingView.tsx
git commit -m "feat: add invoicing with Stripe checkout, mobile invoice editor, and agent payment page"
```
