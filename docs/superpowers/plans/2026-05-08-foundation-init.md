# ShotReady Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the ShotReady monorepo with Expo mobile app, React web app, Firebase Cloud Functions, shared TypeScript types, Firebase configuration, design system tokens, and auth scaffolding -- everything needed before feature development can begin.

**Architecture:** pnpm monorepo with `apps/mobile` (Expo + NativeWind + Gluestack), `apps/web` (Vite + React + Tailwind), `functions/` (Firebase Cloud Functions 2nd gen), and `packages/shared` (TypeScript types and constants). Firebase project `shotready-001`. Single-photographer v1.

**Tech Stack:** TypeScript, React Native, Expo (managed), NativeWind v4, Gluestack UI, Vite, React 19, Firebase (Auth, Firestore, Storage, Functions, FCM), pnpm workspaces

---

## File Structure

```
shotready/
├── apps/
│   ├── mobile/                     # Expo React Native app
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── tailwind.config.ts
│   │   ├── global.css
│   │   ├── nativewind-env.d.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── _layout.tsx          # Root layout (Expo Router)
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── _layout.tsx
│   │   │   │   │   ├── login.tsx
│   │   │   │   │   └── register.tsx
│   │   │   │   └── (tabs)/
│   │   │   │       ├── _layout.tsx      # Bottom tab navigator
│   │   │   │       ├── index.tsx        # Jobs tab (dashboard)
│   │   │   │       ├── calendar.tsx
│   │   │   │       ├── route.tsx
│   │   │   │       └── settings.tsx
│   │   │   ├── lib/
│   │   │   │   ├── firebase.ts          # Firebase SDK init
│   │   │   │   ├── auth.tsx             # Auth context + provider
│   │   │   │   └── offline.ts           # Offline persistence + connectivity
│   │   │   ├── theme/
│   │   │   │   ├── colors.ts
│   │   │   │   ├── typography.ts
│   │   │   │   └── spacing.ts
│   │   │   └── components/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── StatusPill.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── SkeletonLoader.tsx
│   │   │       └── OfflineBar.tsx
│   │   └── assets/
│   └── web/                        # Vite + React web app
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── index.css
│           ├── lib/
│           │   └── firebase.ts
│           └── pages/
│               ├── BookingForm.tsx       # /book/:slug
│               ├── BookingView.tsx       # /b/:token
│               └── WebCompanion.tsx      # /upload
├── functions/                      # Firebase Cloud Functions
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── config.ts
├── packages/
│   └── shared/                     # Shared types & constants
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types/
│           │   ├── index.ts
│           │   ├── photographer.ts
│           │   ├── booking.ts
│           │   ├── package.ts
│           │   ├── photo.ts
│           │   ├── route-plan.ts
│           │   ├── invoice.ts
│           │   └── notification.ts
│           └── constants/
│               ├── index.ts
│               ├── booking-status.ts
│               └── transitions.ts
├── .firebaserc
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .env.example
└── CLAUDE.md
```

---

## Task 1: Root Monorepo Configuration

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `CLAUDE.md`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "shotready",
  "private": true,
  "scripts": {
    "mobile": "pnpm --filter @shotready/mobile start",
    "web": "pnpm --filter @shotready/web dev",
    "functions:build": "pnpm --filter @shotready/functions build",
    "shared:build": "pnpm --filter @shotready/shared build",
    "typecheck": "pnpm -r run typecheck",
    "clean": "pnpm -r run clean"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "functions"
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.expo/
*.tsbuildinfo
.env
.env.local
*.log
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
```

- [ ] **Step 5: Create .env.example**

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=shotready-001.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=shotready-001
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=shotready-001.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Web app uses VITE_ prefix
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=shotready-001.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=shotready-001
VITE_FIREBASE_STORAGE_BUCKET=shotready-001.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Cloud Functions Secrets (set via firebase functions:secrets:set)
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
# SENDGRID_API_KEY
# GOOGLE_MAPS_API_KEY
```

- [ ] **Step 6: Create CLAUDE.md**

```markdown
# ShotReady

Mobile-first OS for independent real estate listing photographers. Manages booking-to-delivery workflow.

## Project Structure

pnpm monorepo:
- `apps/mobile` - React Native + Expo (NativeWind, Gluestack UI, Expo Router)
- `apps/web` - Vite + React (agent pages + web companion)
- `functions` - Firebase Cloud Functions 2nd gen (TypeScript)
- `packages/shared` - Shared TypeScript types and constants

## Commands

- `pnpm mobile` - Start Expo dev server
- `pnpm web` - Start Vite dev server
- `pnpm functions:build` - Build Cloud Functions
- `pnpm typecheck` - Typecheck all packages

## Firebase

Project: `shotready-001`
Region: `us-central1`

## Key Decisions

- Single-photographer v1 (no multi-tenancy)
- Agents never create accounts (token-based URL access)
- Firestore offline persistence for field use
- Dark mode default, light mode for shoots
- Monetary values in cents (integer)
- Timestamps use Firestore Timestamp type
```

- [ ] **Step 7: Run pnpm install to initialize root**

Run: `pnpm install`
Expected: Creates pnpm-lock.yaml, no errors

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/photographer.ts`
- Create: `packages/shared/src/types/booking.ts`
- Create: `packages/shared/src/types/package.ts`
- Create: `packages/shared/src/types/photo.ts`
- Create: `packages/shared/src/types/route-plan.ts`
- Create: `packages/shared/src/types/invoice.ts`
- Create: `packages/shared/src/types/notification.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared package.json**

```json
{
  "name": "@shotready/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create shared tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create photographer type**

File: `packages/shared/src/types/photographer.ts`

```typescript
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
```

- [ ] **Step 4: Create booking type**

File: `packages/shared/src/types/booking.ts`

```typescript
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
```

- [ ] **Step 5: Create package type**

File: `packages/shared/src/types/package.ts`

```typescript
import type { Timestamp } from "./common";

export interface ServicePackage {
  photographerId: string;
  name: string;
  description: string;
  price: number; // cents
  deliverables: string[];
  shotListTemplate: string[];
  estimatedDuration: number; // minutes
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 6: Create photo type**

File: `packages/shared/src/types/photo.ts`

```typescript
import type { Timestamp } from "./common";

export type ProcessingStatus = "uploading" | "processing" | "ready" | "error";

export interface Photo {
  filename: string;
  storagePath: string;
  watermarkedPath: string | null;
  thumbnailPath: string | null;
  width: number;
  height: number;
  fileSize: number; // bytes
  sortOrder: number;
  isSelected: boolean;
  processingStatus: ProcessingStatus;
  uploadedAt: Timestamp;
  processedAt: Timestamp | null;
}
```

- [ ] **Step 7: Create route plan type**

File: `packages/shared/src/types/route-plan.ts`

```typescript
import type { Timestamp } from "./common";

export interface LightingWindow {
  ideal: string; // "09:00-11:00"
  reason: string; // "East-facing front, morning light"
}

export interface RouteStop {
  bookingId: string;
  address: string;
  lat: number;
  lng: number;
  sortOrder: number;
  estimatedArrival: string; // "09:30" (24h)
  estimatedDuration: number; // minutes
  lightingWindow: LightingWindow;
  driveFromPrevious: number; // minutes
}

export interface RoutePlan {
  photographerId: string;
  date: string; // ISO YYYY-MM-DD
  stops: RouteStop[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  isOptimized: boolean;
  optimizedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 8: Create invoice type**

File: `packages/shared/src/types/invoice.ts`

```typescript
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
```

- [ ] **Step 9: Create notification type**

File: `packages/shared/src/types/notification.ts`

```typescript
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
```

- [ ] **Step 10: Create common type and index barrel**

File: `packages/shared/src/types/common.ts`

```typescript
/**
 * Platform-agnostic Timestamp type.
 * On Firestore client: firebase Timestamp
 * On Cloud Functions: admin.firestore.Timestamp
 * In tests/mocks: { seconds: number; nanoseconds: number }
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}
```

File: `packages/shared/src/types/index.ts`

```typescript
export type { Timestamp } from "./common";
export type { Photographer, AvailabilityWindow, MlsConfig, PhotographerBranding, PhotographerNotificationPrefs } from "./photographer";
export type { Booking, ShotListItem } from "./booking";
export type { ServicePackage } from "./package";
export type { Photo, ProcessingStatus } from "./photo";
export type { RoutePlan, RouteStop, LightingWindow } from "./route-plan";
export type { Invoice, InvoiceLineItem, InvoiceStatus } from "./invoice";
export type { AppNotification, NotificationType } from "./notification";
```

- [ ] **Step 11: Create shared index**

File: `packages/shared/src/index.ts`

```typescript
export * from "./types";
export * from "./constants";
```

- [ ] **Step 12: Install shared deps and verify types compile**

Run: `cd packages/shared && pnpm install && pnpm typecheck`
Expected: Install succeeds, typecheck succeeds (after constants are created in Task 3)

---

## Task 3: Shared Constants & Validation

**Files:**
- Create: `packages/shared/src/constants/booking-status.ts`
- Create: `packages/shared/src/constants/transitions.ts`
- Create: `packages/shared/src/constants/index.ts`

- [ ] **Step 1: Create booking status constants**

File: `packages/shared/src/constants/booking-status.ts`

```typescript
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
```

- [ ] **Step 2: Create state machine transitions**

File: `packages/shared/src/constants/transitions.ts`

```typescript
import type { BookingStatus } from "./booking-status";

export const VALID_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "declined", "cancelled"],
  confirmed: ["shooting", "cancelled"],
  shooting: ["editing"],
  editing: ["proofing"],
  proofing: ["delivered"],
  delivered: ["invoiced"],
  invoiced: ["overdue", "paid"],
  overdue: ["paid"],
  paid: ["closed"],
  closed: [],
  declined: [],
  cancelled: [],
};

export function isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Status priority for dashboard "Needs Your Action" sort order.
 * Lower number = higher priority (shown first).
 */
export const STATUS_PRIORITY: Record<BookingStatus, number> = {
  pending: 0,
  overdue: 1,
  shooting: 2,
  editing: 3,
  delivered: 4,
  confirmed: 5,
  proofing: 6,
  invoiced: 7,
  paid: 8,
  closed: 9,
  declined: 10,
  cancelled: 11,
};
```

- [ ] **Step 3: Create constants index**

File: `packages/shared/src/constants/index.ts`

```typescript
export {
  BOOKING_STATUSES,
  TERMINAL_STATUSES,
  PHOTOGRAPHER_ACTION_STATUSES,
  WAITING_ON_OTHERS_STATUSES,
  COMPLETED_STATUSES,
  PROPERTY_ORIENTATIONS,
  INVOICE_STATUSES,
  PROCESSING_STATUSES,
} from "./booking-status";
export type { BookingStatus, PropertyOrientation } from "./booking-status";
export { VALID_TRANSITIONS, isValidTransition, STATUS_PRIORITY } from "./transitions";
```

- [ ] **Step 4: Verify shared package compiles**

Run: `cd packages/shared && pnpm typecheck`
Expected: No errors

---

## Task 4: Firebase Configuration

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `storage.rules`

- [ ] **Step 1: Create .firebaserc**

```json
{
  "projects": {
    "default": "shotready-001"
  }
}
```

- [ ] **Step 2: Create firebase.json**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "hosting": {
    "public": "apps/web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 3: Create Firestore security rules**

File: `firestore.rules`

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Photographer profile: only the owner can read/write
    match /photographers/{photographerId} {
      allow read, write: if request.auth != null && request.auth.uid == photographerId;

      // Notifications subcollection
      match /notifications/{notificationId} {
        allow read, write: if request.auth != null && request.auth.uid == photographerId;
      }
    }

    // Packages: only the owning photographer
    match /packages/{packageId} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.photographerId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.photographerId;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.photographerId;
    }

    // Bookings: only the owning photographer via client SDK.
    // Agents access bookings through Cloud Functions (server-side token validation).
    match /bookings/{bookingId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.photographerId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.photographerId;

      // Photos subcollection
      match /photos/{photoId} {
        allow read, write: if request.auth != null
          && get(/databases/$(database)/documents/bookings/$(bookingId)).data.photographerId == request.auth.uid;
      }
    }

    // Route plans: only the owning photographer
    match /routePlans/{planId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.photographerId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.photographerId;
    }

    // Invoices: only the owning photographer
    match /invoices/{invoiceId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.photographerId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.photographerId;
    }
  }
}
```

- [ ] **Step 4: Create Firestore composite indexes**

File: `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "bookings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "photographerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "bookings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "photographerId", "order": "ASCENDING" },
        { "fieldPath": "schedule.confirmedDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "bookings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "photographerId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "packages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "photographerId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "sortOrder", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "photographerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 5: Create Cloud Storage rules**

File: `storage.rules`

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Photographer uploads: only the authenticated photographer can write
    match /uploads/{photographerId}/{bookingId}/{fileName} {
      allow read: if request.auth != null && request.auth.uid == photographerId;
      allow write: if request.auth != null && request.auth.uid == photographerId
        && request.resource.size < 30 * 1024 * 1024  // 30 MB max
        && request.resource.contentType.matches('image/jpeg');
    }

    // Processed files: read by authenticated photographer, written by Cloud Functions only
    match /processed/{bookingId}/{fileName} {
      allow read: if request.auth != null;
      // Write is server-side only (Cloud Functions uses admin SDK, bypasses rules)
    }

    // Branding assets
    match /branding/{photographerId}/{fileName} {
      allow read;  // Public (agent pages load logos)
      allow write: if request.auth != null && request.auth.uid == photographerId
        && request.resource.size < 2 * 1024 * 1024;  // 2 MB max
    }
  }
}
```

---

## Task 5: Expo Mobile App Scaffold

**Files:**
- Create: `apps/mobile/` (via create-expo-app)
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/tsconfig.json`

- [ ] **Step 1: Create Expo app**

Run: `cd apps && npx create-expo-app@latest mobile --template blank-typescript`
Expected: Expo app scaffold created in apps/mobile/

- [ ] **Step 2: Update package.json name and add shared dependency**

Update `apps/mobile/package.json` -- set name and add workspace dependency:

```json
{
  "name": "@shotready/mobile",
  ...existing fields...,
  "dependencies": {
    ...existing deps...,
    "@shotready/shared": "workspace:*"
  }
}
```

- [ ] **Step 3: Update app.json**

Replace `apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "ShotReady",
    "slug": "shotready",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0F1117"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.shotready.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F1117"
      },
      "package": "com.shotready.app"
    },
    "scheme": "shotready",
    "plugins": [
      "expo-router"
    ]
  }
}
```

- [ ] **Step 4: Install core mobile dependencies**

Run from `apps/mobile/`:

```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

- [ ] **Step 5: Update mobile tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"],
      "@shotready/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

---

## Task 6: NativeWind + Design System Configuration

**Files:**
- Create: `apps/mobile/tailwind.config.ts`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/nativewind-env.d.ts`
- Modify: `apps/mobile/babel.config.js`
- Modify: `apps/mobile/metro.config.js`
- Create: `apps/mobile/src/theme/colors.ts`
- Create: `apps/mobile/src/theme/typography.ts`
- Create: `apps/mobile/src/theme/spacing.ts`

- [ ] **Step 1: Install NativeWind and Tailwind**

Run from `apps/mobile/`:

```bash
npx expo install nativewind tailwindcss@^3.4
```

- [ ] **Step 2: Create tailwind.config.ts**

File: `apps/mobile/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        border: "var(--color-border)",
        "border-focus": "var(--color-border-focus)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
      fontSize: {
        h1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        h2: ["22px", { lineHeight: "28px", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "22px", fontWeight: "400" }],
        "body-medium": ["16px", { lineHeight: "22px", fontWeight: "500" }],
        caption: ["14px", { lineHeight: "18px", fontWeight: "400" }],
        small: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },
      borderRadius: {
        card: "12px",
        button: "12px",
        input: "10px",
        pill: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create global.css**

File: `apps/mobile/global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Dark mode (default) */
  --color-background: #0F1117;
  --color-surface: #1A1D27;
  --color-surface-raised: #242836;
  --color-border: #2E3347;
  --color-border-focus: #2563EB;
  --color-text-primary: #F1F3F9;
  --color-text-secondary: #9BA3BF;
  --color-text-muted: #5E6687;
  --color-accent: #2563EB;
  --color-accent-hover: #3B82F6;
}

.light {
  --color-background: #FFFFFF;
  --color-surface: #F8F9FB;
  --color-surface-raised: #F1F3F7;
  --color-border: #D1D5E0;
  --color-border-focus: #1D4ED8;
  --color-text-primary: #111827;
  --color-text-secondary: #4B5563;
  --color-text-muted: #9CA3AF;
  --color-accent: #1D4ED8;
  --color-accent-hover: #2563EB;
}
```

- [ ] **Step 4: Create nativewind-env.d.ts**

```typescript
/// <reference types="nativewind/types" />
```

- [ ] **Step 5: Update babel.config.js**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

- [ ] **Step 6: Create metro.config.js**

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch shared packages
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 7: Create theme constants**

File: `apps/mobile/src/theme/colors.ts`

```typescript
export const darkColors = {
  background: "#0F1117",
  surface: "#1A1D27",
  surfaceRaised: "#242836",
  border: "#2E3347",
  borderFocus: "#2563EB",
  textPrimary: "#F1F3F9",
  textSecondary: "#9BA3BF",
  textMuted: "#5E6687",
  accent: "#2563EB",
  accentHover: "#3B82F6",
} as const;

export const lightColors = {
  background: "#FFFFFF",
  surface: "#F8F9FB",
  surfaceRaised: "#F1F3F7",
  border: "#D1D5E0",
  borderFocus: "#1D4ED8",
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#9CA3AF",
  accent: "#1D4ED8",
  accentHover: "#2563EB",
} as const;

export const statusColors = {
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
} as const;
```

File: `apps/mobile/src/theme/typography.ts`

```typescript
export const typography = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "600" as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  bodyMedium: { fontSize: 16, lineHeight: 22, fontWeight: "500" as const },
  caption: { fontSize: 14, lineHeight: 18, fontWeight: "400" as const },
  small: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
} as const;
```

File: `apps/mobile/src/theme/spacing.ts`

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;
```

---

## Task 7: Mobile App Navigation Shell

**Files:**
- Create: `apps/mobile/src/app/_layout.tsx`
- Create: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/src/app/(tabs)/index.tsx`
- Create: `apps/mobile/src/app/(tabs)/calendar.tsx`
- Create: `apps/mobile/src/app/(tabs)/route.tsx`
- Create: `apps/mobile/src/app/(tabs)/settings.tsx`
- Create: `apps/mobile/src/app/(auth)/_layout.tsx`
- Create: `apps/mobile/src/app/(auth)/login.tsx`
- Create: `apps/mobile/src/app/(auth)/register.tsx`

- [ ] **Step 1: Create root layout**

File: `apps/mobile/src/app/_layout.tsx`

```tsx
import "../global.css";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <Slot />
    </View>
  );
}
```

- [ ] **Step 2: Create tab layout**

File: `apps/mobile/src/app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from "expo-router";
import { Briefcase, Calendar, MapPin, Settings } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#5E6687",
        tabBarStyle: {
          backgroundColor: "#0F1117",
          borderTopColor: "#2E3347",
          height: 56,
        },
        headerStyle: {
          backgroundColor: "#0F1117",
        },
        headerTintColor: "#F1F3F9",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: "Route",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Create placeholder tab screens**

File: `apps/mobile/src/app/(tabs)/index.tsx`

```tsx
import { View, Text } from "react-native";

export default function JobsScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Jobs</Text>
      <Text className="text-body text-text-secondary mt-sm">Your bookings will appear here</Text>
    </View>
  );
}
```

File: `apps/mobile/src/app/(tabs)/calendar.tsx`

```tsx
import { View, Text } from "react-native";

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Calendar</Text>
      <Text className="text-body text-text-secondary mt-sm">Your schedule will appear here</Text>
    </View>
  );
}
```

File: `apps/mobile/src/app/(tabs)/route.tsx`

```tsx
import { View, Text } from "react-native";

export default function RouteScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Route</Text>
      <Text className="text-body text-text-secondary mt-sm">Your daily route will appear here</Text>
    </View>
  );
}
```

File: `apps/mobile/src/app/(tabs)/settings.tsx`

```tsx
import { View, Text } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Settings</Text>
      <Text className="text-body text-text-secondary mt-sm">App settings will appear here</Text>
    </View>
  );
}
```

- [ ] **Step 4: Create auth layout and screens (placeholder)**

File: `apps/mobile/src/app/(auth)/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F1117" },
      }}
    />
  );
}
```

File: `apps/mobile/src/app/(auth)/login.tsx`

```tsx
import { View, Text } from "react-native";

export default function LoginScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">ShotReady</Text>
      <Text className="text-body text-text-secondary mt-sm">Sign in to continue</Text>
    </View>
  );
}
```

File: `apps/mobile/src/app/(auth)/register.tsx`

```tsx
import { View, Text } from "react-native";

export default function RegisterScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-lg">
      <Text className="text-h1 text-text-primary">Create Account</Text>
      <Text className="text-body text-text-secondary mt-sm">Set up your photography business</Text>
    </View>
  );
}
```

- [ ] **Step 5: Install lucide-react-native**

Run from `apps/mobile/`:

```bash
npx expo install lucide-react-native react-native-svg
```

- [ ] **Step 6: Verify mobile app starts**

Run: `cd apps/mobile && npx expo start`
Expected: Expo dev server starts, QR code displayed

---

## Task 8: Web App Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/pages/BookingForm.tsx`
- Create: `apps/web/src/pages/BookingView.tsx`
- Create: `apps/web/src/pages/WebCompanion.tsx`

- [ ] **Step 1: Create web package.json**

```json
{
  "name": "@shotready/web",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "firebase": "^11.0.0",
    "lucide-react": "^0.460.0",
    "@shotready/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Create web tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create Tailwind config (web)**

File: `apps/web/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        border: "var(--color-border)",
        "border-focus": "var(--color-border-focus)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

File: `apps/web/postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>ShotReady</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create main.tsx and App.tsx**

File: `apps/web/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

File: `apps/web/src/App.tsx`

```tsx
import { Routes, Route } from "react-router-dom";
import BookingForm from "./pages/BookingForm";
import BookingView from "./pages/BookingView";
import WebCompanion from "./pages/WebCompanion";

export default function App() {
  return (
    <Routes>
      <Route path="/book/:slug" element={<BookingForm />} />
      <Route path="/b/:token" element={<BookingView />} />
      <Route path="/upload" element={<WebCompanion />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Create index.css with agent-facing light mode tokens**

File: `apps/web/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Agent-facing pages: light mode only */
  --color-background: #FFFFFF;
  --color-surface: #F8F9FB;
  --color-surface-raised: #F1F3F7;
  --color-border: #D1D5E0;
  --color-border-focus: #1D4ED8;
  --color-text-primary: #111827;
  --color-text-secondary: #4B5563;
  --color-text-muted: #9CA3AF;
  --color-accent: var(--photographer-accent, #2563EB);
  --color-accent-hover: #3B82F6;
}

/* Web companion: dark mode for photographer */
.companion-theme {
  --color-background: #0F1117;
  --color-surface: #1A1D27;
  --color-surface-raised: #242836;
  --color-border: #2E3347;
  --color-border-focus: #2563EB;
  --color-text-primary: #F1F3F9;
  --color-text-secondary: #9BA3BF;
  --color-text-muted: #5E6687;
  --color-accent: #2563EB;
  --color-accent-hover: #3B82F6;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  background-color: var(--color-background);
  color: var(--color-text-primary);
}
```

- [ ] **Step 8: Create placeholder page components**

File: `apps/web/src/pages/BookingForm.tsx`

```tsx
import { useParams } from "react-router-dom";

export default function BookingForm() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">Book a Shoot</h1>
        <p className="text-text-secondary mt-2">Photographer: {slug}</p>
      </div>
    </div>
  );
}
```

File: `apps/web/src/pages/BookingView.tsx`

```tsx
import { useParams } from "react-router-dom";

export default function BookingView() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">Your Booking</h1>
        <p className="text-text-secondary mt-2">Loading booking details...</p>
      </div>
    </div>
  );
}
```

File: `apps/web/src/pages/WebCompanion.tsx`

```tsx
export default function WebCompanion() {
  return (
    <div className="min-h-screen companion-theme flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">ShotReady Upload</h1>
        <p className="text-text-secondary mt-2">Sign in to upload photos</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Install web deps and verify it builds**

Run:

```bash
cd apps/web && pnpm install && pnpm build
```

Expected: Build succeeds, `dist/` created

---

## Task 9: Cloud Functions Scaffold

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/.eslintrc.js`
- Create: `functions/src/index.ts`
- Create: `functions/src/config.ts`

- [ ] **Step 1: Create functions package.json**

```json
{
  "name": "@shotready/functions",
  "private": true,
  "version": "0.0.1",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions",
    "clean": "rm -rf dist"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0",
    "@shotready/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create functions tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create config.ts**

File: `functions/src/config.ts`

```typescript
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
```

- [ ] **Step 4: Create index.ts with placeholder exports**

File: `functions/src/index.ts`

```typescript
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
// export { bookingCreate, bookingUpdateStatus, bookingGetByToken } from "./booking";
// export { mediaOnUpload, mediaGenerateMlsExport, mediaGenerateDownloadUrl } from "./media";
// export { routingOptimize } from "./routing";
// export { paymentsCreateInvoice, paymentsStripeWebhook, paymentsOverdueCheck } from "./payments";
// export { notificationsOnBookingChange } from "./notifications";

// Placeholder to verify deployment works
import { onRequest } from "firebase-functions/v2/https";
import { REGION } from "./config";

export const health = onRequest({ region: REGION }, (req, res) => {
  res.json({ status: "ok", service: "shotready-functions" });
});
```

- [ ] **Step 5: Install functions deps and verify build**

Run:

```bash
cd functions && pnpm install && pnpm build
```

Expected: Build succeeds, `dist/` created with compiled JS

---

## Task 10: Firebase SDK Initialization

**Files:**
- Create: `apps/mobile/src/lib/firebase.ts`
- Create: `apps/web/src/lib/firebase.ts`

- [ ] **Step 1: Create mobile Firebase init**

File: `apps/mobile/src/lib/firebase.ts`

```typescript
import { initializeApp, getApps, getApp } from "@react-native-firebase/app";

/**
 * React Native Firebase reads config from google-services.json (Android)
 * and GoogleService-Info.plist (iOS) automatically.
 *
 * For Expo managed workflow, config is set in app.json plugins.
 * Ensure the Firebase config files are placed in the project root.
 */

const app = getApps().length === 0 ? initializeApp() : getApp();

export { app };
```

- [ ] **Step 2: Create web Firebase init**

File: `apps/web/src/lib/firebase.ts`

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };
```

---

## Task 11: Git Init & First Commit

- [ ] **Step 1: Initialize git repository**

Run:

```bash
git init
```

- [ ] **Step 2: Stage all files**

Run:

```bash
git add .
```

- [ ] **Step 3: Verify no secrets are staged**

Run:

```bash
git status
```

Expected: No `.env`, `google-services.json`, `GoogleService-Info.plist`, or credential files staged. Only source code, config, and docs.

- [ ] **Step 4: Create initial commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat: initialize ShotReady monorepo

- pnpm workspace with apps/mobile, apps/web, functions, packages/shared
- Expo React Native app with NativeWind, Expo Router, bottom tab navigation
- Vite + React web app with React Router (agent pages + web companion)
- Firebase Cloud Functions scaffold with health endpoint
- Shared TypeScript types for all Firestore collections
- Shared constants: booking statuses, state machine transitions
- Firebase config: Firestore rules, indexes, Storage rules
- Design system color tokens (dark mode default, light mode for shoots)
EOF
)"
```

---

## Summary

After completing all tasks, the project has:

1. **Monorepo structure** with pnpm workspaces connecting all packages
2. **Shared types** for every Firestore collection (Photographer, Booking, Package, Photo, RoutePlan, Invoice, Notification)
3. **Shared constants** with booking statuses, valid transitions, and status priority
4. **Firebase configuration** with security rules, composite indexes, and storage rules
5. **Expo mobile app** with NativeWind, Expo Router, 4-tab navigation, dark mode theme
6. **React web app** with Vite, Tailwind, React Router (3 routes: booking form, booking view, web companion)
7. **Cloud Functions** scaffold with health endpoint and config for all function groups
8. **Firebase SDK** initialization for both mobile and web
9. **Git repository** with clean first commit

**Next plans needed:**
- **Plan 2: Auth & Base Components** -- Firebase Auth integration (login/register), auth context, base UI components (Button, Input, Card, StatusPill, SkeletonLoader, OfflineBar)
- **Plan 3: Photographer Onboarding** -- 4-step wizard (business identity, first package, availability, booking link)
- **Plan 4: Service Packages** -- Package CRUD, shot list templates, drag-to-reorder
- Then core workflow plans (Dashboard, Calendar, Booking State Machine, etc.)
