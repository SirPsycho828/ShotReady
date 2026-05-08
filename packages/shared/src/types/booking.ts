import type { Timestamp } from "./common";
import type { BookingStatus, PropertyOrientation } from "../constants/booking-status";

export interface ShotListItem {
  label: string;
  isCompleted: boolean;
  completedAt: Timestamp | null;
}

export interface Booking {
  photographerId: string;
  status: BookingStatus;
  agentToken: string;
  agent: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
  };
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
    accessCode: string | null;
    accessNotes: string | null;
    orientation: PropertyOrientation | null;
  };
  schedule: {
    requestedDate: Timestamp;
    confirmedDate: Timestamp | null;
    startTime: string | null; // "10:00" (24h)
    estimatedDuration: number; // minutes
  };
  package: {
    packageId: string;
    name: string;
    price: number; // cents
    deliverables: string[];
  };
  shotList: ShotListItem[];
  shooting: {
    startedAt: Timestamp | null;
    completedAt: Timestamp | null;
  };
  proofing: {
    sentAt: Timestamp | null;
    viewedAt: Timestamp | null;
    completedAt: Timestamp | null;
    approvedAll: boolean | null;
    selectedCount: number | null;
  };
  delivery: {
    deliveredAt: Timestamp | null;
    downloadToken: string | null;
  };
  invoiceId: string | null;
  photographerNotes: string | null;
  agentNotes: string | null;
  reminderSentAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
