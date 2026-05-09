/**
 * ShotReady Cloud Functions
 *
 * Function groups:
 * - booking: Booking lifecycle (create, update status, get by token)
 * - media: Photo processing (upload trigger, MLS export, download URL)
 * - routing: Route optimization
 * - payments: Stripe integration (invoice, webhook, overdue check)
 * - notifications: Push + email dispatch
 */

// Function groups will be imported here as they are implemented:
export { bookingGetByToken, bookingToggleSelection, bookingSubmitSelections } from "./booking";
export { mediaOnUpload } from "./media";
export { mediaOnPhotoDeleted, mediaRetentionCleanup } from "./media-cleanup";
export { deliverPhotos } from "./delivery";
export { routingOptimize } from "./routing";
// export { paymentsCreateInvoice, paymentsStripeWebhook, paymentsOverdueCheck } from "./payments";
// export { notificationsOnBookingChange } from "./notifications";

// Placeholder to verify deployment works
import { onRequest } from "firebase-functions/v2/https";
import { REGION } from "./config";

export const health = onRequest({ region: REGION }, (req, res) => {
  res.json({ status: "ok", service: "shotready-functions" });
});
