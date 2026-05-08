import { defineString } from "firebase-functions/params";

export const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineString("STRIPE_WEBHOOK_SECRET");
export const sendgridApiKey = defineString("SENDGRID_API_KEY");
export const googleMapsApiKey = defineString("GOOGLE_MAPS_API_KEY");

export const REGION = "us-central1";

export const FUNCTIONS_CONFIG = {
  booking: { memory: "256MiB" as const, timeoutSeconds: 60 },
  media: { memory: "1GiB" as const, timeoutSeconds: 120 },
  mediaZip: { memory: "1GiB" as const, timeoutSeconds: 540 },
  routing: { memory: "256MiB" as const, timeoutSeconds: 60 },
  payments: { memory: "256MiB" as const, timeoutSeconds: 60 },
  notifications: { memory: "256MiB" as const, timeoutSeconds: 60 },
} as const;
