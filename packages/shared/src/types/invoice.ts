import type { Timestamp } from "./common";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export interface InvoiceLineItem {
  description: string;
  amount: number; // cents
}

export interface Invoice {
  bookingId: string;
  photographerId: string;
  agentEmail: string;
  agentName: string;
  lineItems: InvoiceLineItem[];
  subtotal: number; // cents
  total: number; // cents (same as subtotal for v1, no tax)
  status: InvoiceStatus;
  stripe: {
    paymentIntentId: string | null;
    paymentUrl: string | null;
  };
  dueDate: Timestamp;
  sentAt: Timestamp | null;
  paidAt: Timestamp | null;
  lastReminderAt: Timestamp | null;
  reminderCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
