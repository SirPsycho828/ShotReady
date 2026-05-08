## Overview

All server-side logic runs as Firebase Cloud Functions (Node.js/TypeScript). Functions handle operations that cannot or should not run on the client: image processing, payment webhooks, notification dispatch, route optimization, and agent-facing data access. Agent-facing pages never read Firestore directly -- they call Cloud Functions that validate the agent token server-side. See `01_Auth.md` for the auth pattern.

## Dependencies

- `01_Auth.md` -- Auth verification patterns for photographer vs agent vs webhook calls
- `02_Database_Schema.md` -- All collection and document shapes referenced here
- `15_Photo_Processing.md` -- Detailed watermarking and resize specs
- `17_Delivery_MLS_Export.md` -- MLS export dimensions and metadata
- `18_Invoicing_Payments.md` -- Stripe integration details
- `19_Notifications.md` -- Notification content and delivery rules

## Function Categories

Functions are organized into five groups. Each group deploys as a separate Cloud Functions module for independent scaling.

| Group | Trigger Types | Purpose |
|-------|--------------|---------|
| `booking` | Callable, Firestore triggers | Booking lifecycle operations |
| `media` | Storage triggers, Callable | Photo processing pipeline |
| `routing` | Callable | Route optimization |
| `payments` | HTTP (webhook), Callable | Stripe integration |
| `notifications` | Firestore triggers | Push, email, in-app dispatch |

## Booking Functions

### `booking-create` (Callable)

**Auth:** None (public, called from agent booking form).

Receives agent booking submission. Validates required fields, geocodes property address via Google Maps Geocoding API, generates the 32-char `agentToken`, creates the booking document with status `pending`, and triggers the new-booking notification flow.

**Inputs:** Agent name, email, phone (optional), property address, requested date, selected package ID, notes (optional), access code (optional).

**Side effects:**
- Creates `bookings/{id}` document. See `02_Database_Schema.md`
- Geocodes address, writes `property.lat` and `property.lng`
- Generates and stores `agentToken`
- Copies package snapshot (name, price, deliverables) from `packages/{id}`
- Generates default `shotList` array from `packages/{id}.shotListTemplate`

**Error cases:**
- Invalid or ungeocatable address: return error, do not create booking
- Package ID does not exist or is inactive: return error
- Requested date is outside photographer's availability windows: return warning (still creates as `pending`, photographer decides)

### `booking-updateStatus` (Callable)

**Auth:** Photographer (Firebase Auth ID token).

Advances booking status. Validates the transition against allowed transitions defined in `10_Booking_State_Machine.md`. Certain transitions trigger side effects.

| Transition | Side Effects |
|-----------|-------------|
| `pending` to `confirmed` | Sends confirmation email to agent. Updates `schedule.confirmedDate` |
| `pending` to `declined` | Sends decline email to agent. Terminal state |
| `editing` to `proofing` | Sets `proofing.sentAt`. Sends proofing email to agent |
| `proofing` to `delivered` | Sets `delivery.deliveredAt`. Triggers invoice generation. Sends delivery email |

### `booking-getByToken` (HTTP GET)

**Auth:** Agent token in URL path.

Returns booking data scoped to what the agent should see for the current state. Strips internal fields (`photographerNotes`, `photographerId`, storage paths). Used by agent-facing web pages.

**Response shape varies by status.** For `proofing` state, includes photo list with watermarked URLs. For `delivered` state, includes download links. See `20_Agent_Web_Shell.md`.

### `booking-submitSelections` (Callable)

**Auth:** Agent token in request body.

Receives the agent's photo selections from the proofing gallery. Updates `isSelected` on each photo document in the subcollection. Sets `proofing.completedAt` and `proofing.selectedCount` on the booking. Can only be called when booking status is `proofing`.

**Inputs:** Agent token, array of selected photo IDs.

### `booking-approvalReminder` (Scheduled -- every 30 minutes)

Queries bookings with status `pending` and `createdAt` older than 2 hours. Sends a reminder push notification to the photographer for each. Only sends one reminder per booking (track with a `reminderSentAt` field).

## Media Functions

### `media-onUpload` (Storage trigger)

**Trigger:** Object finalized in `uploads/{photographerId}/{bookingId}/{filename}`.

Processes each uploaded photo:
1. Validates file type (JPEG only for v1) and size (reject > 30 MB)
2. Reads image dimensions
3. Generates thumbnail (400px wide, JPEG 80% quality)
4. Generates watermarked copy (photographer's business name, semi-transparent diagonal. See `15_Photo_Processing.md`)
5. Writes all variants to storage: `processed/{bookingId}/thumb_{filename}`, `processed/{bookingId}/wm_{filename}`
6. Creates or updates the photo document in `bookings/{bookingId}/photos` subcollection with paths, dimensions, file size, and `processingStatus: "ready"`

**Error handling:** If processing fails, set `processingStatus: "error"` on the photo document. Photographer sees the error in the upload interface and can re-upload.

**Library:** Sharp (already available in Cloud Functions Node.js runtime).

### `media-generateMlsExport` (Callable)

**Auth:** Photographer (Firebase Auth ID token).

Generates MLS-ready versions of selected/approved photos. Reads MLS config from `photographers/{id}.mlsConfig`. Resizes to max dimensions, strips non-MLS metadata, optimizes file size. Writes to `processed/{bookingId}/mls_{filename}`.

Called when photographer triggers delivery. See `17_Delivery_MLS_Export.md`.

### `media-generateDownloadUrl` (Callable)

**Auth:** Agent token or Photographer auth.

Generates a time-limited signed URL for downloading final photos as a ZIP. Creates the ZIP on-the-fly from the MLS-ready files in Cloud Storage. URL expires in 7 days.

**Note:** For large shoots (50 photos, 3-10 MB each = 150-500 MB), ZIP generation may hit Cloud Functions timeout (540 seconds max on 2nd gen). If this becomes an issue, split into multiple ZIPs or use a background task. Default: single ZIP, monitor for timeouts.

## Routing Functions

### `routing-optimize` (Callable)

**Auth:** Photographer (Firebase Auth ID token).

Generates or updates the route plan for a given date. Queries all `confirmed` bookings for that date, calculates optimal order considering drive time (Google Maps Directions API) and lighting windows (bounded heuristic from property orientation). Writes result to `routePlans/{photographerId}_{date}`.

**Inputs:** Date (ISO string).

**Lighting heuristic:**
- East-facing properties: prefer morning (before noon)
- West-facing properties: prefer afternoon (after noon)
- North/South-facing: no strong preference, optimize for drive time
- Unknown orientation: optimize for drive time only

**Output:** Ordered stops array with estimated arrival times, drive durations between stops, and lighting window annotations. See `routePlans` collection in `02_Database_Schema.md`.

**Google Maps API usage:** One Directions API call with all stops as waypoints, optimized ordering. Single API call per optimization run.

## Payment Functions

### `payments-createInvoice` (Firestore trigger)

**Trigger:** Booking status changes to `delivered`.

Creates an invoice document in the `invoices` collection. Copies line items from the booking's package snapshot. Creates a Stripe Payment Link for the total amount. Writes the payment URL to the invoice document. See `18_Invoicing_Payments.md`.

### `payments-stripeWebhook` (HTTP POST)

**Auth:** Stripe webhook signature verification.

Listens for `payment_intent.succeeded` events. Matches to an invoice by `stripe.paymentIntentId`. Updates invoice status to `paid`, sets `paidAt`. Updates booking status to `paid`. Sends payment confirmation email to photographer and receipt to agent.

**Endpoint:** `https://{region}-{project}.cloudfunctions.net/payments-stripeWebhook`

Must be registered in Stripe Dashboard webhook settings.

### `payments-overdueCheck` (Scheduled -- daily at 9:00 AM)

Queries invoices with status `sent` and `dueDate` in the past. Updates status to `overdue`. Sends a reminder email to the agent with the payment link. Sends a push notification to the photographer.

## Notification Functions

### `notifications-onBookingChange` (Firestore trigger)

**Trigger:** Update to any `bookings/{id}` document.

Evaluates the status change and dispatches notifications per the rules in `19_Notifications.md`. Uses Firebase Cloud Messaging for push and SendGrid for email.

| Status Change | Photographer Gets | Agent Gets |
|--------------|-------------------|------------|
| Created (`pending`) | Push: "New booking request" | Email: "Booking submitted" confirmation |
| `pending` to `confirmed` | -- | Email: "Booking confirmed" with details |
| `pending` to `declined` | -- | Email: "Booking not available" with message |
| `editing` to `proofing` | -- | Email: "Your photos are ready for review" with link |
| Proofing completed | Push: "Agent completed selections" | -- |
| `proofing` to `delivered` | -- | Email: "Your photos are ready" with download link |
| Invoice paid | Push: "Payment received" | Email: receipt |

### `notifications-sendEmail` (internal helper)

Wraps SendGrid API. Accepts recipient, template ID, and template variables. All emails are sent from the photographer's configured email address (or a no-reply fallback). See `19_Notifications.md` for email content.

## Runtime Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Runtime | Node.js 20 | |
| Region | `us-central1` | Single region for v1. Match to photographer's geography |
| Memory | 256 MB default, 1 GB for media functions | Sharp image processing needs more memory |
| Timeout | 60s default, 540s for media-generateDownloadUrl | ZIP generation may be slow |
| Min instances | 0 | Cold starts acceptable for v1 budget |
| Secrets | Stripe secret key, SendGrid API key, Google Maps API key | Use Firebase Functions secrets manager |

## Gaps & Assumptions

### Gaps

- **Retry strategy for failed notifications** -- If SendGrid or FCM fails, should the function retry? Default: Cloud Functions automatic retry for Firestore triggers (at-least-once delivery). Idempotency must be ensured.
- **ZIP generation at scale** -- 50 photos at 10 MB each is 500 MB. Cloud Functions has 2 GB memory max and 540s timeout. This should work but has not been validated. If it fails, fall back to individual file downloads.
- **Geocoding failures** -- Some addresses may not geocode cleanly. Default: store what Google returns, flag for photographer review if confidence is low.
- **Cold start latency** -- With min instances at 0, agent-facing pages may have 3-5 second cold starts. Acceptable for v1 budget. Increase min instances if user experience suffers.

### Assumptions

- All functions deploy from a single Firebase project (`shotready-001`).
- Cloud Functions 2nd gen is used for all functions (better timeout limits, concurrency).
- SendGrid free tier (100 emails/day) is sufficient at launch. A 5-shoot day generates roughly 15-20 emails.
- Google Maps Directions API with waypoint optimization handles up to 25 stops per request. Max realistic daily shoots is 10-15, well within limits.
- Stripe webhooks are configured for only the events listed above. Additional events can be added as needed.  
