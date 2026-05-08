export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "shooting",
  "editing",
  "proofing",
  "delivered",
  "invoiced",
  "overdue",
  "paid",
  "closed",
  "declined",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TERMINAL_STATUSES: readonly BookingStatus[] = ["closed", "declined", "cancelled"];

export const PHOTOGRAPHER_ACTION_STATUSES: readonly BookingStatus[] = [
  "pending",
  "confirmed",
  "shooting",
  "editing",
  "delivered",
  "overdue",
];

export const WAITING_ON_OTHERS_STATUSES: readonly BookingStatus[] = [
  "proofing",
  "invoiced",
];

export const COMPLETED_STATUSES: readonly BookingStatus[] = [
  "paid",
  "closed",
  "cancelled",
  "declined",
];

export const PROPERTY_ORIENTATIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type PropertyOrientation = (typeof PROPERTY_ORIENTATIONS)[number];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;

export const PROCESSING_STATUSES = ["uploading", "processing", "ready", "error"] as const;
