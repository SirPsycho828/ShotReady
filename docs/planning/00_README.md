▸ Extended thinking (5193 chars)  
## Overview

ShotReady is a mobile-first operating system for independent real-estate listing photographers and small studios (1-5 people). It manages the complete workflow from agent booking through route-planned shoot days to proofed, MLS-ready delivery and invoice collection.

The product has three surfaces:

- **Photographer mobile app** (React Native/Expo) -- primary interface for managing jobs, shoots, and business operations
- **Web companion** (React/browser) -- desktop interface for bulk photo uploads from Lightroom
- **Agent-facing web pages** (React/browser) -- no-account, link-based flows for booking, proofing, delivery, and payment

Built for a single photographer first. Multi-tenancy and team features are deferred to post-MVP. See `21_Future_Features.md`.

## Dependencies

### External Services

| Service | Used For | Cost Tier |
|---------|----------|-----------|
| Firebase (Blaze plan) | Auth, Firestore, Storage, Functions, FCM | Pay-as-you-go, target < $50/mo |
| Google Maps Platform | Directions API, Geocoding | Pay-per-use |
| Stripe | Payment processing | 2.9% + $0.30 per transaction |
| SendGrid | Transactional email | Free tier (100/day) to start |

### Environment

- Firebase project: `shotready-001`
- Google service account JSON and Firebase config are in project root and **must be in .gitignore**
- Photo uploads: exported Lightroom JPEGs, typically 3-10 MB each, 25-50 per shoot

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile framework | React Native + Expo | Managed workflow |
| Web framework | React | Web companion + agent-facing pages |
| Language | TypeScript | All surfaces |
| Styling | NativeWind (Tailwind for RN) | Mobile app styling |
| Component library | Gluestack UI | Headless, styled with NativeWind |
| Icons | Lucide Icons | `lucide-react-native` |
| Animations | React Native Reanimated | Skeleton shimmer, touch feedback, transitions |
| Auth | Firebase Auth | Photographer accounts + anonymous agent access |
| Database | Cloud Firestore | With offline persistence enabled |
| Storage | Firebase Cloud Storage | Photos, watermarks, thumbnails |
| Server functions | Firebase Cloud Functions | Image processing, notifications, Stripe webhooks |
| Payments | Stripe (basic for v1) | Stripe Connect deferred to multi-tenant |
| Maps & routing | Google Maps Platform | Directions API, geocoding |
| Image processing | Sharp (server-side) | Watermarking, thumbnails, MLS resize |
| Email | SendGrid | Transactional emails to agents |
| Push notifications | Firebase Cloud Messaging | Photographer mobile push |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    Firebase                       │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐ │
│  │   Auth   │  │ Firestore │  │ Cloud Storage │ │
│  └──────────┘  └───────────┘  └───────────────┘ │
│  ┌────────────────────────────────────────────┐  │
│  │           Cloud Functions                  │  │
│  │  - Image processing (Sharp)                │  │
│  │  - Notification dispatch (FCM + SendGrid)  │  │
│  │  - Stripe webhooks                         │  │
│  │  - Route optimization heuristic            │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
         │               │               │
    ┌────┴─────┐   ┌────┴─────┐   ┌────┴─────┐
    │  Mobile  │   │   Web    │   │  Agent   │
    │   App    │   │Companion │   │Web Pages │
    │  (Expo)  │   │ (React)  │   │ (React)  │
    └──────────┘   └──────────┘   └──────────┘
```

## File Index

| File | Contents | Build Phase |
|------|----------|-------------|
| `00_README.md` | Project overview, tech stack, file index | -- |
| `01_Auth.md` | Firebase Auth, photographer vs agent auth, sessions | Foundation |
| `02_Database_Schema.md` | Firestore collections, document shapes, indexes | Foundation |
| `03_Cloud_Functions.md` | Server-side triggers, callable functions, HTTP endpoints | Foundation |
| `04_UI_Design_System.md` | Colors, typography, spacing, components, dark/light/field modes | Foundation |
| `05_Offline_Strategy.md` | Local caching, sync behavior, conflict resolution | Foundation |
| `06_Photographer_Onboarding.md` | Progressive setup wizard, minimum viable config | Setup |
| `07_Service_Packages.md` | Package CRUD, pricing, deliverable definitions | Setup |
| `08_Dashboard_Job_List.md` | Primary job list, status grouping, action prioritization | Core workflow |
| `09_Schedule_Calendar.md` | Calendar view, availability windows, conflict detection | Core workflow |
| `10_Booking_State_Machine.md` | Booking lifecycle states, valid transitions, triggers | Core workflow |
| `11_Agent_Booking.md` | Agent-facing booking form, package selection, confirmation | Core workflow |
| `12_Route_Optimization.md` | Daily route planning, lighting-aware scheduling, nav handoff | Core workflow |
| `13_Shoot_Day_Field_Mode.md` | Field mode UI, shot lists, access codes, one-handed design | Core workflow |
| `14_Web_Companion.md` | Desktop upload portal, auth linking, batch upload UX | Media pipeline |
| `15_Photo_Processing.md` | Upload pipeline, watermarking, thumbnails, storage layout | Media pipeline |
| `16_Proofing_Gallery.md` | Agent-facing gallery, photo selection, approval flow | Media pipeline |
| `17_Delivery_MLS_Export.md` | Final delivery, MLS format config, download links | Media pipeline |
| `18_Invoicing_Payments.md` | Stripe integration, invoice generation, payment tracking | Business ops |
| `19_Notifications.md` | Push, email, in-app notifications, digest and tier rules | Business ops |
| `20_Agent_Web_Shell.md` | Shared agent web layout, photographer branding, responsive | Polish |
| `21_Future_Features.md` | Deferred features and post-MVP roadmap | -- |

## Build Sequence

Implementation follows file numbering. Key dependency chains:

1. **Foundation** (01-05): Auth, schema, functions, design system, offline. Prerequisites for everything.
2. **Photographer setup** (06-07): Onboarding and packages must exist before bookings.
3. **Core workflow** (08-13): Dashboard, calendar, booking lifecycle, agent booking, routing, shoot day. The daily operating loop.
4. **Media pipeline** (14-17): Upload, processing, proofing, delivery. The post-shoot workflow.
5. **Business ops** (18-19): Invoicing and notifications layer on top of core workflow.
6. **Agent polish** (20): Shared web shell ties agent-facing pages together with branding.

## Key Architectural Decisions

**Single-photographer v1.** No multi-tenancy, no team features. Basic Stripe (not Connect). Simplifies auth, data isolation, and billing.

**Firestore document model.** Single booking document with nested objects for core data. Separate photo documents as a subcollection for individual selection. Separate `routePlans/{date}` documents for daily route planning. See `02_Database_Schema.md`.

**Offline-first for field use.** Firestore offline persistence enabled for the photographer's current day data. The app must function during shoots with no connectivity. See `05_Offline_Strategy.md`.

**Dual-mode design.** Dark mode default for indoor use (editing, scheduling, invoicing). Auto-switch to high-contrast light mode during active shoots. See `04_UI_Design_System.md`.

**Accountless agent experience.** Agents never create accounts or install apps. All interactions happen via web links with token-based access. See `01_Auth.md` and `20_Agent_Web_Shell.md`.

**Evolving booking URL.** Each booking has one URL shared with the agent. Page content changes based on booking state: confirmation, proofing, delivery, payment. One link through the entire lifecycle. See `10_Booking_State_Machine.md`.

**Lighting-aware route optimization.** Uses a bounded heuristic (property orientation + time-of-day), not full sun-path calculation. See `12_Route_Optimization.md`.

## Gaps & Assumptions

### Critical Gaps

| Gap | Impact | Tracked In |
|-----|--------|------------|
| Agent web UX has no wireframes or detailed flow specs | Agents are half of every transaction | `20_Agent_Web_Shell.md`, `11_Agent_Booking.md`, `16_Proofing_Gallery.md` |
| Booking state machine transitions not formally defined | Undefined transitions cause bugs | `10_Booking_State_Machine.md` |
| Shot list creation and template system underspecified | Field mode has no content to display | `13_Shoot_Day_Field_Mode.md` |

### Medium Gaps

| Gap | Impact | Tracked In |
|-----|--------|------------|
| Photo retention policy undefined | Unclear storage costs and agent expectations | `15_Photo_Processing.md` |
| MLS format requirements vary by market, no preset list | Photos rejected by MLS create rework | `17_Delivery_MLS_Export.md` |
| Web companion auth linking mechanism unspecified | Desktop uploads need secure session | `14_Web_Companion.md` |
| Cancellation and rescheduling flow undefined | Common real-estate scenario unhandled | `21_Future_Features.md` |

### Assumptions

- Single photographer using the system at launch (not multi-tenant)
- Agents will accept web-link-based interactions without demanding a native app
- Photo volume is 25-50 exported JPEGs per shoot at 3-10 MB each
- Photographer manages 5-15 concurrent jobs across various lifecycle stages
- Cloud budget stays under $50/month at launch scale
- One local MLS with a single set of export requirements for v1

### Defaults Applied

| Ambiguity | Default | Source |
|-----------|---------|--------|
| Booking approval timeout reminder | 2 hours | User Red Team suggestion |
| Photo retention period | 90 days post-delivery | User Red Team suggestion |
| Free cancellation window | 24 hours before shoot | Reasonable industry default |
| Max photos per shoot | 100 | Upper bound for document limits |
| Proofing gallery auto-save interval | On every selection change | Low-tech agent safety net |  
