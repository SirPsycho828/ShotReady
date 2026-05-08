▸ TodoWrite  
  ← result received  
▸ Extended thinking (1253 chars)  
## Overview

ShotReady uses Stripe for payment collection. When a photographer delivers final photos, an invoice is auto-drafted from the booking's package snapshot. The photographer reviews the draft, adjusts line items if needed, then sends it. The agent receives an email with a Stripe-hosted payment link. Stripe webhooks update the invoice and booking status when payment completes. For v1, this is basic Stripe (photographer's own account), not Stripe Connect. See `21_Future_Features.md` for the multi-tenant migration path.

## Dependencies

- `02_Database_Schema.md` -- `invoices` collection schema, booking `invoiceId` field
- `03_Cloud_Functions.md` -- `payments-createInvoice`, `payments-stripeWebhook`, `payments-overdueCheck`
- `06_Photographer_Onboarding.md` -- Stripe contextual prompt at first delivery
- `10_Booking_State_Machine.md` -- `delivered` to `invoiced` to `paid` transitions
- `19_Notifications.md` -- Invoice-related email content
- `20_Agent_Web_Shell.md` -- Payment section on the agent-facing evolving URL

## Stripe Setup

### Photographer Configuration

The photographer connects their Stripe account during the contextual prompt triggered at first delivery (see `06_Photographer_Onboarding.md`) or manually in Settings > Payments.

**Setup flow:**
1. Photographer taps "Connect Stripe"
2. Redirect to Stripe's standard OAuth authorization page
3. Photographer logs into their existing Stripe account or creates a new one
4. Stripe redirects back to ShotReady with the account credentials
5. Store `stripe.accountId` and set `stripe.isConnected: true` on the photographer document

**No Stripe account yet?** Stripe's OAuth flow handles account creation. The photographer signs up for Stripe within the flow and returns to ShotReady with a connected account.

### Stripe Not Connected

If the photographer tries to send an invoice without Stripe connected:
- Block the "Send Invoice" action
- Show a prompt: "Connect your Stripe account to send invoices and collect payments online."
- The invoice draft still exists and can be edited. Only sending requires Stripe.

## Invoice Lifecycle

### Auto-Draft at Delivery

When a booking transitions to `delivered`, the `payments-createInvoice` Cloud Function creates an invoice document:

| Field | Value |
|-------|-------|
| `bookingId` | From the booking |
| `photographerId` | From the booking |
| `agentEmail` | From `bookings.agent.email` |
| `agentName` | From `bookings.agent.name` |
| `lineItems` | Generated from booking package snapshot (see below) |
| `subtotal` | Sum of line item amounts |
| `total` | Same as subtotal for v1 (no tax) |
| `status` | `"draft"` |
| `dueDate` | `delivery.deliveredAt` + 7 days |
| `createdAt` | Current timestamp |

The booking's `invoiceId` field is set to the new invoice document ID.

### Line Items

Auto-generated from the booking's package snapshot:

```
[
  {
    description: "Standard Listing Package",
    amount: 25000    // cents ($250.00)
  }
]
```

Single line item matching the package name and price. The photographer can modify this before sending.

### Photographer Review and Edit

On the mobile app, the `delivered` booking detail screen shows the invoice draft with an editable line item list.

**Editable fields per line item:**
- Description (text, max 100 chars)
- Amount (dollar input, converts to cents)

**Actions:**
- **Add line item** -- "+" button appends a new empty line item. Use for add-on charges, travel fees, rush delivery, etc.
- **Remove line item** -- Swipe-left to delete. At least one line item must remain.
- **Edit existing** -- Tap a line item to modify description or amount inline.

**Total recalculation:** Subtotal and total update in real time as line items change. All changes save to the invoice document immediately (optimistic writes).

### Send Invoice

Photographer taps "Send Invoice" after reviewing the draft.

**Cloud Function flow:**
1. Validate Stripe is connected
2. Create a Stripe Payment Link for the invoice total amount
   - Description: "Photography - {property address}"
   - Amount: invoice `total` in cents
   - Currency: USD
   - Metadata: `{ invoiceId, bookingId }`
3. Write `stripe.paymentIntentId` and `stripe.paymentUrl` to the invoice document
4. Update invoice status from `draft` to `sent`
5. Set `sentAt` to current timestamp
6. Transition booking status from `delivered` to `invoiced`
7. Send invoice email to agent via SendGrid (see `19_Notifications.md`)

## Agent Payment Experience

### Evolving URL Payment Section

When the booking is in `invoiced` or `overdue` status, the agent's evolving URL (`/b/{agentToken}`) shows the download section (photos still accessible) plus an invoice and payment section below.

### Invoice Display

```
┌──────────────────────────────────────────────┐
│  INVOICE                                     │
│──────────────────────────────────────────────│
│                                              │
│  From: {Photographer Business Name}          │
│  For: 123 Oak St - Photography               │
│  Date: May 8, 2026                           │
│  Due: May 15, 2026                           │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ Standard Listing Package    $250.00  │    │
│  │ Rush delivery fee            $50.00  │    │
│  ├──────────────────────────────────────┤    │
│  │ Total                       $300.00  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          Pay $300.00 Now  →            │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

### Pay Button

"Pay ${total} Now" button links to the Stripe-hosted payment page. The agent completes payment entirely on Stripe's interface (credit card, bank transfer, etc.). ShotReady does not collect or display payment form fields.

### Overdue State

If the invoice is `overdue`, a gentle banner appears above the invoice: "This invoice is past due. Please complete payment at your earliest convenience." The banner uses `warning` background tint. No aggressive language.

### Paid State

After payment, the page updates:
- Invoice section shows "Paid" with a checkmark and payment date
- "Pay Now" button replaced with "Paid on {date}" in `success` color
- Download section remains accessible (within retention window)

## Stripe Webhook

### Endpoint

`POST https://{region}-{project}.cloudfunctions.net/payments-stripeWebhook`

Registered in the Stripe Dashboard under Webhooks. Listens for:

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Match to invoice by metadata `invoiceId`. Update invoice: `status: "paid"`, set `paidAt`. Update booking: `status: "paid"`. Send receipt email to agent, push notification to photographer. |
| `payment_intent.payment_failed` | Log the failure. No status change. The agent can retry on Stripe's page. |

### Webhook Security

- Verify the `Stripe-Signature` header using the webhook signing secret
- Reject requests with invalid signatures (return 400)
- Process events idempotently (check if invoice is already `paid` before processing `payment_intent.succeeded`)

### Webhook Secret

Stored in Firebase Functions secrets manager. Not in source code or environment variables.

## Overdue Check

The `payments-overdueCheck` scheduled function runs daily at 9:00 AM (photographer's local time zone, approximated by the Cloud Function's deployed region).

**Logic:**
1. Query `invoices` where `status == "sent"` and `dueDate < now`
2. For each overdue invoice:
   - Update `status` to `"overdue"`
   - Update corresponding booking status to `"overdue"`
   - Send reminder email to agent with payment link
   - Send push notification to photographer: "Invoice overdue for {property address}"
3. For invoices already in `overdue` status, send a follow-up reminder email to the agent every 7 days (track with a `lastReminderAt` field on the invoice)

### Reminder Limits

Maximum 3 reminder emails after the initial overdue notification. After that, the photographer must follow up manually. This prevents spam and protects the photographer's sender reputation.

## Photographer Invoice Management

### Invoice List

In Settings > Invoices (or accessible from the dashboard via a filter), the photographer sees all invoices:

| Column | Content |
|--------|---------|
| Property address | From linked booking |
| Agent name | From invoice |
| Amount | Formatted total |
| Status | Pill: Draft, Sent, Paid, Overdue, Void |
| Date | `sentAt` or `createdAt` for drafts |

Sortable by date, filterable by status.

### Void an Invoice

The photographer can void a sent or overdue invoice. This:
- Sets invoice status to `void`
- Invalidates the Stripe Payment Link (if possible via Stripe API, otherwise leaves it -- Stripe will reject payment on a cancelled intent)
- Does not change the booking status (booking remains in its current state)
- No notification to the agent (the photographer communicates manually)

Use case: wrong amount, agent dispute, or photographer decides to waive the fee.

### Resend Invoice

For `sent` or `overdue` invoices, the photographer can tap "Resend" to re-send the invoice email to the agent. The same payment link is included. Updates `lastReminderAt`.

## Gaps & Assumptions

### Gaps

- **Tax calculation** -- No tax support for v1. `total` equals `subtotal`. Some jurisdictions require sales tax on photography services. See `21_Future_Features.md`.
- **Partial payments** -- Stripe Payment Links are all-or-nothing. No support for partial payments or payment plans. If an agent needs to split payment, the photographer handles it outside the app.
- **Refunds** -- No refund flow in the app. The photographer would issue refunds directly through their Stripe Dashboard. ShotReady does not track refunds for v1.
- **Invoice PDF** -- No downloadable PDF invoice for v1. The agent sees the invoice on the web page and receives details in the email. PDF generation is a post-MVP enhancement.
- **Multi-currency** -- USD only. See `21_Future_Features.md`.

### Assumptions

- Basic Stripe (not Connect) is sufficient for v1 single-photographer use. The photographer's Stripe account receives payments directly. Stripe's standard processing fee (2.9% + $0.30) applies.
- Payment Links are the simplest Stripe integration for v1. No custom checkout page, no embedded payment form. The agent is redirected to Stripe's hosted page.
- The 7-day default due date is reasonable for real estate photography. The photographer cannot change the default for v1 but can manually adjust the due date on individual invoices before sending.
- Invoice amounts are typically $150-$500 per shoot. Stripe has no minimum transaction amount for Payment Links.
- The photographer's Stripe account is in good standing. ShotReady does not monitor Stripe account health or handle Stripe account issues.  
