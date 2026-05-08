import type { Timestamp } from "./common";

export type NotificationType =
  | "booking_new"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_reminder"
  | "proofing_viewed"
  | "proofing_complete"
  | "payment_received"
  | "invoice_overdue"
  | "photos_processed"
  | "booking_closed";

export interface AppNotification {
  type: NotificationType;
  title: string;
  body: string;
  bookingId: string;
  isRead: boolean;
  createdAt: Timestamp;
}
