import type { Timestamp } from "./common";

export interface AvailabilityWindow {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "08:00" (24h format)
  endTime: string; // "17:00"
}

export interface MlsConfig {
  name: string;
  maxWidth: number; // pixels
  maxHeight: number; // pixels
  maxFileSize: number; // bytes
}

export interface PhotographerBranding {
  logoUrl: string | null;
  accentColor: string; // hex, default "#2563EB"
}

export interface PhotographerNotificationPrefs {
  pushEnabled: boolean;
  pushBookingNew: boolean;
  pushPaymentReceived: boolean;
  pushProofingComplete: boolean;
  pushOverdue: boolean;
  emailDigest: boolean;
  emailDigestHour: number; // 0-23
}

export interface Photographer {
  businessName: string;
  email: string;
  phone: string | null;
  bookingSlug: string;
  branding: PhotographerBranding;
  availability: {
    windows: AvailabilityWindow[];
    blockedDates: string[]; // ISO YYYY-MM-DD
  };
  mlsConfig: MlsConfig | null;
  stripe: {
    accountId: string | null;
    isConnected: boolean;
  };
  notifications: PhotographerNotificationPrefs;
  onboardingComplete: boolean;
  fcmToken: string | null;
  dismissedPrompts: Record<string, boolean>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
