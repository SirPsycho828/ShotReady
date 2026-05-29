<p align="center">
  <h1 align="center">ShotReady</h1>
  <p align="center">
    <strong>The mobile-first operating system for independent real estate listing photographers.</strong>
    <br />
    <em>From booking request to paid invoice — all from your phone.</em>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Firebase-Functions_v2-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firebase" />
    <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Stripe-Checkout-635BFF?style=flat-square&logo=stripe&logoColor=white" alt="Stripe" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </p>
</p>

---

## Overview

ShotReady manages the complete booking-to-delivery workflow for solo real estate photographers. Agents book shoots through a branded web form, photographers manage everything from their mobile app, and the entire photo lifecycle flows through automated processing, proofing, delivery, and invoicing.

**Three surfaces, one workflow:**

| Surface | Stack | Purpose |
|---------|-------|---------|
| **Photographer App** | React Native + Expo | Manage bookings, route shoots, send invoices |
| **Agent Web Pages** | React + Vite | Book shoots, proof photos, download & pay |
| **Web Companion** | React + Vite (dark theme) | Desktop photo upload from Lightroom |

Agents never create accounts — every interaction happens through unique token-based URLs with the photographer's own branding.

## Features

<table>
<tr>
<td width="50%">

### Photographer Mobile App
- **Dashboard** — 3-bucket job list (Needs Action, Waiting, Completed) with search and filter chips
- **Calendar** — Monthly grid with day-detail views and booking counts
- **Booking management** — 12-status state machine with guided transitions
- **Route optimization** — Google Maps Distance Matrix with golden-hour lighting annotations
- **Field mode** — Shot list checklist for shoot day with one-tap completion
- **Invoice editor** — Editable line items, package auto-population, one-tap send
- **Push notifications** — FCM alerts for new bookings, payments, and proofing activity
- **Offline support** — Firestore persistence with connectivity detection

</td>
<td width="50%">

### Agent Web Experience
- **Branded booking form** — Package selection, date picker, property details
- **Evolving booking URL** — One link, content changes with status progression
- **Photo proofing gallery** — Thumbnail grid with lightbox, selection checkboxes, bulk approve
- **Download page** — MLS-compliant photos with ZIP delivery
- **Stripe Checkout** — Invoice display with secure payment flow
- **Photographer branding** — Logo, accent color, and business name on every page
- **Responsive design** — Phone, tablet, and desktop layouts

</td>
</tr>
<tr>
<td width="50%">

### Web Companion
- **Drag-and-drop upload** from Lightroom workflow
- **3-concurrent throttling** with per-file progress bars
- **Processing status** tracking (thumbnail + watermark generation)
- **Send to proofing** workflow with confirmation step

</td>
<td width="50%">

### Cloud Functions (14 endpoints)
- **Photo processing** — Sharp thumbnails (400px) and watermark compositing
- **Delivery pipeline** — MLS-compliant resize, ZIP packaging via JSZip
- **Stripe integration** — Invoice drafting, Checkout Sessions, webhook handling
- **Notifications** — SendGrid emails (9 templates) + FCM push (4 event types)
- **Route optimization** — Google Maps Distance Matrix API
- **Media cleanup** — 90-day retention with scheduled daily purge

</td>
</tr>
</table>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.81, Expo 54, Expo Router, NativeWind 4 |
| Web | React 19, Vite 6, Tailwind CSS 3.4, React Router 7 |
| Backend | Firebase Cloud Functions v2 (Node 20, TypeScript) |
| Database | Cloud Firestore with offline persistence |
| Storage | Firebase Cloud Storage (photos, thumbnails, ZIPs) |
| Auth | Firebase Auth (photographer accounts) + token-based agent access |
| Payments | Stripe Checkout Sessions + webhook reconciliation |
| Email | SendGrid transactional templates |
| Push | Firebase Cloud Messaging (FCM) |
| Image Processing | Sharp (resize, watermark, thumbnail generation) |
| Shared Types | TypeScript monorepo package (`@shotready/shared`) |

## Architecture

```
shotready/
├── apps/
│   ├── mobile/                 # React Native + Expo photographer app
│   │   └── src/
│   │       ├── app/            # Expo Router file-based routing
│   │       │   ├── (auth)/     # Login, Register
│   │       │   ├── (onboarding)/ # 4-step setup wizard
│   │       │   ├── (tabs)/     # Dashboard, Calendar, Route, Settings
│   │       │   ├── booking/    # Booking detail + actions
│   │       │   └── field-mode/ # Shoot day checklist
│   │       ├── components/     # UI components (booking, field-mode, route, ui)
│   │       ├── contexts/       # AuthContext with Firestore persistence
│   │       ├── hooks/          # useBookings, usePackages, useInvoice, etc.
│   │       └── theme/          # Design tokens (colors, typography, spacing)
│   │
│   └── web/                    # Vite + React agent pages + companion
│       └── src/
│           ├── components/
│           │   ├── shell/      # ShellLayout, StatusMessageCard, PropertySummaryCard
│           │   ├── proofing/   # PhotoCell, Lightbox, ProofingGallery
│           │   └── delivery/   # DownloadPage, InvoiceSection
│           ├── hooks/          # useProofingGallery, usePhotographerBySlug, useAuth
│           └── pages/          # BookingForm, BookingView, WebCompanion, Landing
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
│       ├── email.ts            # SendGrid email dispatch
│       └── config.ts           # Region, secrets, function configs
│
├── packages/
│   └── shared/                 # Shared TypeScript types + constants
│       └── src/
│           ├── types/          # Booking, Photographer, Photo, Invoice, etc.
│           └── constants/      # Status enums, state transitions
│
├── firebase.json               # Hosting, Functions, Firestore, Storage config
├── firestore.rules             # Security rules (owner-only access patterns)
├── storage.rules               # Storage rules (size limits, JPEG validation)
└── pnpm-workspace.yaml
```

## Booking State Machine

Bookings flow through 12 statuses. Each transition triggers agent notifications and updates the evolving booking URL:

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

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (`npm install -g pnpm`)
- **Firebase CLI** (`npm install -g firebase-tools`)
- iOS Simulator (macOS) or Android emulator, or Expo Go on a physical device

### Install

```bash
git clone https://github.com/SirPsycho828/ShotReady.git
cd ShotReady
pnpm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in your Firebase project credentials:

```bash
cp .env.example apps/web/.env
cp .env.example apps/mobile/.env
```

#### Firebase Project

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password)
3. Create a **Firestore** database
4. Enable **Cloud Storage**
5. Add a **Web app** and copy the config values into `.env`

#### Cloud Functions Secrets

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set GOOGLE_MAPS_API_KEY
```

### Development

```bash
# Photographer mobile app (Expo dev server)
pnpm mobile

# Agent web pages + companion (Vite dev server)
pnpm web

# Build Cloud Functions
pnpm functions:build

# Typecheck all packages
pnpm typecheck
```

### Deploy

```bash
# Web app (Firebase Hosting)
cd apps/web && pnpm build && cd ../..
firebase deploy --only hosting

# Cloud Functions
firebase deploy --only functions

# Full deploy (hosting + functions + rules)
cd apps/web && pnpm build && cd ../..
firebase deploy --only hosting,functions,firestore:rules,storage
```

## Cloud Functions Reference

| Function | Trigger | Purpose |
|----------|---------|---------|
| `health` | HTTP | Deployment health check |
| `bookingGetByToken` | Callable | Fetch booking data by agent token |
| `bookingToggleSelection` | Callable | Batch-update photo selections |
| `bookingSubmitSelections` | Callable | Finalize agent's photo choices |
| `mediaOnUpload` | Storage | Generate thumbnail + watermark on upload |
| `mediaOnPhotoDeleted` | Firestore | Clean up storage files on doc delete |
| `mediaRetentionCleanup` | Scheduled (daily) | Purge files older than 90 days |
| `deliverPhotos` | Callable | MLS resize + ZIP + auto-draft invoice |
| `routingOptimize` | Callable | Google Maps route optimization |
| `paymentsSendInvoice` | Callable | Create Stripe Checkout Session |
| `paymentsStripeWebhook` | HTTP | Handle Stripe payment events |
| `paymentsOverdueCheck` | Scheduled (daily) | Flag overdue invoices |
| `notificationsOnBookingCreated` | Firestore | New booking email + push |
| `notificationsOnBookingUpdated` | Firestore | Status change notifications |

## Design Decisions

- **Single photographer** — no multi-tenancy for v1; optimized for the solo operator
- **Agents never create accounts** — all access via unique token URLs
- **Monetary values in cents** — integer math, no floating-point rounding issues
- **Firestore offline persistence** — photographers work in the field with spotty connectivity
- **Dark mode default** on mobile; light mode for agent-facing web pages
- **Stripe Checkout Sessions** — full control over the payment flow vs. Payment Links
- **Cloud Function cold starts accepted** — no min instances, stays within free/Blaze tier budget
- **pnpm monorepo** — shared TypeScript types enforce contracts across all three surfaces

## License

MIT
