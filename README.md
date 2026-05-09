<p align="center">
  <h1 align="center">ShotReady</h1>
  <p align="center">
    <strong>The mobile-first operating system for independent real estate listing photographers.</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=white" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white" alt="Expo" />
    <img src="https://img.shields.io/badge/Firebase-v2_Functions-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Stripe-Checkout-635BFF?logo=stripe&logoColor=white" alt="Stripe" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </p>
</p>

---

## Overview

ShotReady manages the complete booking-to-delivery workflow for solo real estate photographers. One photographer, their agent clients, and a streamlined pipeline from booking request to paid invoice — all from a phone.

Agents book shoots through a branded web form, photographers manage everything from their mobile app, and the entire photo lifecycle flows through automated processing, proofing, delivery, and invoicing.

## Features

<table>
<tr>
<td width="50%">

### Photographer Mobile App
- **Dashboard** with 3-bucket job list (Needs Action, Waiting, Completed)
- **Calendar** with monthly grid and day detail views
- **Booking management** with 12-status state machine
- **Route optimization** via Google Maps with lighting annotations
- **Field mode** shot list checklist for shoot day
- **Invoice editor** with editable line items and one-tap send
- **Push notifications** for new bookings, payments, and proofing
- **Offline support** with connectivity detection and sync

</td>
<td width="50%">

### Agent Web Experience
- **Branded booking form** with package selection and date picker
- **Evolving booking URL** — one link, content changes with status
- **Photo proofing gallery** with selection, lightbox, and approval
- **Download page** with ZIP delivery and photo preview grid
- **Invoice & payment** via Stripe Checkout
- **Responsive design** for phone, tablet, and desktop
- **Photographer branding** (logo, accent color) on every page

</td>
</tr>
<tr>
<td width="50%">

### Web Companion (Desktop)
- **Photo upload** from Lightroom with drag-and-drop
- **3-concurrent upload** throttling with per-file progress
- **Processing status** tracking (thumbnail + watermark generation)
- **Send to proofing** workflow with confirmation

</td>
<td width="50%">

### Cloud Functions
- **Photo processing** — Sharp thumbnails (400px) and watermarks
- **Delivery pipeline** — MLS-compliant resize, ZIP packaging
- **Stripe integration** — invoice drafting, Checkout Sessions, webhooks
- **Notifications** — SendGrid emails (9 types) + FCM push (4 types)
- **Route optimization** — Google Maps Distance Matrix API
- **Media cleanup** — 90-day retention with scheduled purge

</td>
</tr>
</table>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.81, Expo 54, Expo Router, NativeWind |
| Web (Agent) | React 19, Vite 6, Tailwind CSS, React Router |
| Web (Companion) | Same stack, dark theme, Firebase Auth |
| Backend | Firebase Cloud Functions v2 (Node 20) |
| Database | Cloud Firestore with offline persistence |
| Storage | Firebase Cloud Storage (photos, ZIPs) |
| Auth | Firebase Auth (photographer accounts, agent token-based access) |
| Payments | Stripe Checkout Sessions |
| Email | SendGrid transactional emails |
| Push | Firebase Cloud Messaging (FCM) |
| Image Processing | Sharp (resize, watermark, thumbnails) |
| Types | Shared TypeScript package across all surfaces |

## Architecture

```
shotready/
├── apps/
│   ├── mobile/                 # React Native + Expo photographer app
│   │   └── src/
│   │       ├── app/            # Expo Router file-based routing
│   │       │   ├── (auth)/     # Login, Register
│   │       │   ├── (onboarding)/ # 4-step setup wizard
│   │       │   ├── (tabs)/     # Dashboard, Calendar, Settings
│   │       │   ├── booking/    # Booking detail + actions
│   │       │   └── field-mode/ # Shoot day checklist
│   │       ├── components/     # UI components (booking, field-mode, route, ui)
│   │       ├── contexts/       # AuthContext
│   │       ├── hooks/          # useBookings, usePackages, useInvoice, etc.
│   │       └── theme/          # Design tokens
│   │
│   └── web/                    # Vite + React agent pages + companion
│       └── src/
│           ├── components/
│           │   ├── shell/      # ShellLayout, StatusMessageCard, PropertySummaryCard
│           │   ├── proofing/   # PhotoCell, Lightbox, ProofingGallery
│           │   └── delivery/   # DownloadPage, InvoiceSection
│           ├── hooks/          # useProofingGallery, usePhotographerBySlug, useAuth
│           └── pages/          # BookingForm, BookingView, WebCompanion
│
├── functions/                  # Firebase Cloud Functions v2
│   └── src/
│       ├── booking.ts          # Token-based booking access, photo selection
│       ├── delivery.ts         # MLS export, ZIP packaging
│       ├── media.ts            # Upload trigger → thumbnail + watermark
│       ├── media-cleanup.ts    # Delete trigger + 90-day retention
│       ├── notifications.ts    # Firestore triggers → email + push
│       ├── payments.ts         # Stripe invoice, checkout, webhook
│       ├── routing.ts          # Google Maps route optimization
│       └── config.ts           # Region, secrets, function configs
│
├── packages/
│   └── shared/                 # Shared TypeScript types + constants
│       └── src/types/          # Booking, Photographer, Photo, etc.
│
├── firebase.json               # Hosting, Functions, Firestore, Storage config
├── firestore.rules
├── storage.rules
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- **Node.js** 20+ (required for Cloud Functions)
- **pnpm** 10+ (`npm install -g pnpm`)
- **Expo CLI** (`npx expo` — comes with Expo SDK)
- **Firebase CLI** (`npm install -g firebase-tools`)
- iOS Simulator (macOS) or Android emulator, or Expo Go on a physical device

### Install

```bash
git clone <repo-url> shotready
cd shotready
pnpm install
```

### Environment Setup

#### Firebase Project

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password provider)
3. Create a **Firestore** database
4. Enable **Cloud Storage**
5. Add a **Web app** and copy the config

#### Web App (`apps/web`)

Create `apps/web/.env`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

#### Mobile App (`apps/mobile`)

Configure `apps/mobile/google-services.json` (Android) and `apps/mobile/GoogleService-Info.plist` (iOS) from the Firebase console.

#### Cloud Functions Secrets

Set these via Firebase CLI:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set GOOGLE_MAPS_API_KEY
```

### Development

```bash
# Start the mobile app (Expo dev server)
pnpm mobile

# Start the web app (Vite dev server)
pnpm web

# Build Cloud Functions
pnpm functions:build

# Typecheck all packages
pnpm typecheck
```

### Deploy

#### Web App (Firebase Hosting)

```bash
cd apps/web
pnpm build
cd ../..
firebase deploy --only hosting
```

#### Cloud Functions

```bash
firebase deploy --only functions
```

#### Full Deploy

```bash
cd apps/web && pnpm build && cd ../..
firebase deploy --only hosting,functions,firestore:rules,storage
```

## Booking State Machine

Bookings flow through 12 statuses, each triggering specific agent notifications and UI changes:

```
pending → confirmed → shooting → editing → proofing → delivered → invoiced → paid → closed
    ↓                                                                  ↓
 declined                                                           overdue
    ↓         ↓
 cancelled  cancelled
```

| Status | Photographer Action | Agent Sees |
|--------|-------------------|-----------|
| `pending` | Confirm or decline | "Booking request submitted" |
| `confirmed` | Schedule shoot | "Shoot confirmed" with date |
| `shooting` | Complete field checklist | "Photos in progress" |
| `editing` | Upload photos via web companion | "Photos in progress" |
| `proofing` | Wait for agent selections | Photo selection gallery |
| `delivered` | Send invoice | Download page with ZIP |
| `invoiced` | Monitor payment | Download + invoice + pay button |
| `overdue` | Follow up | Download + overdue banner |
| `paid` | Archive | Download + paid receipt |
| `closed` | — | Archived notice |
| `declined` | — | Declined notice |
| `cancelled` | — | Cancelled notice |

## Key Design Decisions

- **Single photographer** — no multi-tenancy for v1
- **Agents never create accounts** — all access is via unique token URLs
- **Monetary values in cents** — integer math, no floating point
- **Firestore offline persistence** — photographers work in the field with spotty connectivity
- **Dark mode default** on mobile, **light mode** for agent-facing web pages
- **Stripe Checkout Sessions** — not Payment Links, for full control over the flow
- **Cloud Function cold starts accepted** — no min instances to stay within budget

## Cloud Functions Reference

| Function | Trigger | Purpose |
|----------|---------|---------|
| `health` | HTTP | Deployment health check |
| `bookingGetByToken` | Callable | Fetch booking data by agent token |
| `bookingToggleSelection` | Callable | Batch-update photo selections |
| `bookingSubmitSelections` | Callable | Finalize agent's photo choices |
| `mediaOnUpload` | Storage trigger | Generate thumbnail + watermark |
| `mediaOnPhotoDeleted` | Firestore trigger | Clean up storage files |
| `mediaRetentionCleanup` | Scheduled (daily) | Purge files after 90 days |
| `deliverPhotos` | Callable | MLS resize + ZIP + auto-draft invoice |
| `routingOptimize` | Callable | Google Maps route optimization |
| `paymentsSendInvoice` | Callable | Create Stripe Checkout Session |
| `paymentsStripeWebhook` | HTTP | Handle Stripe payment events |
| `paymentsOverdueCheck` | Scheduled (daily) | Flag overdue invoices |
| `notificationsOnBookingCreated` | Firestore trigger | New booking email + push |
| `notificationsOnBookingUpdated` | Firestore trigger | Status change notifications |

## License

Private — all rights reserved.
