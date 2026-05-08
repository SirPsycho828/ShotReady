▸ TodoWrite  
  ← result received  
▸ Extended thinking (2842 chars)  
## Overview

This file catalogs all features explicitly deferred from v1 during PRD development. Each item was identified during a specific step (vision, red team reviews, or feature design) and consciously excluded to keep the MVP scope focused on the core booking-to-delivery workflow. Items are grouped by category, ordered by estimated impact, and annotated with complexity and the v1 file that references them.

## Dependencies

This file has no implementation dependencies. It serves as a reference for post-MVP planning and ensures deferred items are not lost.

## Multi-Tenant and Team Features

### Multi-Tenant SaaS

**What:** Multiple photographers sign up independently, each with their own data, branding, and Stripe account. Requires Stripe Connect (not basic Stripe), per-photographer data isolation, and a registration/onboarding flow for new photographers.
**Why deferred:** v1 is built for a single photographer. Multi-tenancy adds auth complexity, data scoping, and billing infrastructure.
**Complexity:** High
**v1 impact:** `01_Auth.md`, `02_Database_Schema.md`, `18_Invoicing_Payments.md`
**Migration notes:** Firestore security rules already scope by `photographerId`. The main work is Stripe Connect onboarding (KYC, identity verification), a marketing/registration site, and subscription billing for ShotReady itself.

### Team and Studio Support

**What:** A studio owner and 1-5 shooters share one account. Role-based permissions (owner, shooter, editor). Shooters see only their assigned bookings. Owner sees everything.
**Why deferred:** Requires role model, invitation flow, and booking assignment. Builds on multi-tenant.
**Complexity:** High
**v1 impact:** `01_Auth.md`, `08_Dashboard_Job_List.md`

## Agent Experience Improvements

### Self-Service Agent Cancellation

**What:** Agent can cancel or request rescheduling directly from the booking URL, subject to the photographer's cancellation policy (free window, cancellation fee).
**Why deferred:** Requires cancellation policy configuration, refund logic, and calendar updates.
**Complexity:** Medium
**v1 impact:** `10_Booking_State_Machine.md`, `11_Agent_Booking.md`

### Returning Agent Pre-Fill

**What:** If an agent books with the same email address, pre-fill their name, phone, and company from the previous booking.
**Why deferred:** Requires querying across bookings by agent email. Simple but not critical for launch.
**Complexity:** Low
**v1 impact:** `11_Agent_Booking.md`

### Per-Booking Message Thread

**What:** Simple message exchange between agent and photographer within the booking URL. Captures communication that currently happens via text/phone.
**Why deferred:** Adds real-time messaging infrastructure. Not core to booking-to-delivery workflow.
**Complexity:** Medium
**v1 impact:** `20_Agent_Web_Shell.md`

### Photo Revision Requests

**What:** Agent can flag specific photos for re-editing or request changes from the proofing gallery, with annotations.
**Why deferred:** Requires annotation UI, revision workflow, and state machine additions.
**Complexity:** Medium
**v1 impact:** `16_Proofing_Gallery.md`

### SMS Notifications for Agents

**What:** Text message notifications for delivery and payment reminders, since agents live on their phones.
**Why deferred:** Adds Twilio dependency and per-message cost. Email is sufficient for v1.
**Complexity:** Low
**v1 impact:** `19_Notifications.md`

## Scheduling and Routing

### Calendar Sync (iCal/Google)

**What:** Export ShotReady schedule as an iCal feed or sync bidirectionally with Google Calendar.
**Why deferred:** Bidirectional sync is complex (conflict resolution). Export-only is simpler but still adds scope.
**Complexity:** Low (export) / High (bidirectional)
**v1 impact:** `09_Schedule_Calendar.md`

### Photographer Start Location

**What:** Store a home/office address for the photographer. Route optimization uses it for accurate first-leg and return-home drive time calculations.
**Why deferred:** Simple to implement but requires a settings field and route algorithm adjustment.
**Complexity:** Low
**v1 impact:** `12_Route_Optimization.md`

### Traffic-Aware Routing

**What:** Use Google Maps Directions API `departureTime` parameter to factor real-time or predicted traffic into route timing.
**Why deferred:** Adds API cost and complexity. Photographer's local knowledge compensates.
**Complexity:** Low
**v1 impact:** `12_Route_Optimization.md`

## Media and Delivery

### Add-On Services

**What:** Dedicated system for selling, tracking, and fulfilling add-on services (virtual staging, floor plans, 3D tours, drone footage). Some fulfilled in-house, some outsourced to vendors. Includes vendor handoff tracking.
**Why deferred:** Core booking-to-delivery workflow comes first. Add-ons can be represented as package line items for v1.
**Complexity:** High
**v1 impact:** `07_Service_Packages.md`

### Lightroom Export Plugin

**What:** Direct export from Lightroom to ShotReady, eliminating the web companion browser step entirely.
**Why deferred:** Requires building and maintaining a Lightroom plugin (Lua SDK). Significant separate project.
**Complexity:** High
**v1 impact:** `14_Web_Companion.md`

### RAW File Storage

**What:** Accept and store RAW files alongside JPEGs. Photographers keep originals in the cloud for backup or re-editing.
**Why deferred:** RAW files are 40-80 MB each. Storage costs increase significantly. No processing pipeline for RAW.
**Complexity:** Medium
**v1 impact:** `14_Web_Companion.md`, `15_Photo_Processing.md`

### Logo Watermark

**What:** Use the photographer's uploaded logo as the watermark overlay instead of (or in addition to) tiled text.
**Why deferred:** Requires logo processing (transparency handling, sizing, positioning). Text watermark is simpler and always readable.
**Complexity:** Low
**v1 impact:** `15_Photo_Processing.md`

### Social Media Crops

**What:** Auto-generate social-media-optimized crops (1:1 Instagram, 16:9 Facebook cover, 9:16 Stories) alongside MLS exports.
**Why deferred:** Adds processing time and storage. Agents can crop manually from delivered files.
**Complexity:** Medium
**v1 impact:** `17_Delivery_MLS_Export.md`

### Re-Delivery Flow

**What:** Allow the photographer to undo a delivery, swap photos, and re-deliver. Adds a `delivered` to `editing` backward transition in the state machine.
**Why deferred:** Backward state transitions add complexity. Workaround: manual file replacement in Storage.
**Complexity:** Medium
**v1 impact:** `10_Booking_State_Machine.md`, `17_Delivery_MLS_Export.md`

## Payments and Business

### Tax Calculation

**What:** Auto-calculate sales tax on invoices based on jurisdiction. Some states/cities tax photography services.
**Why deferred:** Tax rules vary by location and change frequently. Requires a tax API (e.g., TaxJar, Avalara) or manual rate configuration.
**Complexity:** Medium
**v1 impact:** `18_Invoicing_Payments.md`

### Invoice PDF Generation

**What:** Generate downloadable PDF invoices for agents and the photographer's records.
**Why deferred:** PDF generation library adds complexity. The web-based invoice display is sufficient for v1.
**Complexity:** Low
**v1 impact:** `18_Invoicing_Payments.md`

### Revenue Dashboard

**What:** Photographer sees earnings over time: weekly/monthly revenue, average job value, top agents by revenue, payment collection rate.
**Why deferred:** Analytics require aggregation queries or a reporting pipeline. Not critical for daily operations.
**Complexity:** Medium
**v1 impact:** `08_Dashboard_Job_List.md`

### Partial Payments and Payment Plans

**What:** Allow agents to pay invoices in installments or make partial payments.
**Why deferred:** Stripe supports this but the invoice tracking and UI becomes significantly more complex.
**Complexity:** Medium
**v1 impact:** `18_Invoicing_Payments.md`

### Multi-Currency

**What:** Support currencies other than USD for international photographers.
**Why deferred:** Requires currency configuration, Stripe multi-currency setup, and display formatting.
**Complexity:** Low
**v1 impact:** `07_Service_Packages.md`, `18_Invoicing_Payments.md`

## Platform and UX

### Social Login (Google, Apple)

**What:** Sign in with Google or Apple in addition to email/password.
**Why deferred:** Firebase Auth supports both but adds UI for account linking and provider selection.
**Complexity:** Low
**v1 impact:** `01_Auth.md`

### QR Code Web Companion Linking

**What:** Mobile app generates a QR code that the web companion scans to establish a linked session, avoiding email/password entry on desktop.
**Why deferred:** Nice UX improvement but adds a custom token flow. Direct login works fine.
**Complexity:** Medium
**v1 impact:** `01_Auth.md`, `14_Web_Companion.md`

### Ambient Light Auto-Switch

**What:** Automatically switch between dark and light mode based on the device's ambient light sensor during shoots.
**Why deferred:** Sensor APIs vary across devices. Manual toggle and prompted switch are sufficient.
**Complexity:** Medium
**v1 impact:** `04_UI_Design_System.md`

### Custom Fonts

**What:** Replace system fonts with a branded typeface (Inter, Plus Jakarta Sans) for a more premium feel.
**Why deferred:** System fonts render fastest and look native. Custom fonts add load time and bundle size.
**Complexity:** Low
**v1 impact:** `04_UI_Design_System.md`

### Full White-Labeling

**What:** Photographers get a custom domain, custom email sender address, and removal of all ShotReady branding on agent-facing pages.
**Why deferred:** Requires per-photographer domain management, SSL certificates, and DNS configuration. Potential premium tier feature.
**Complexity:** High
**v1 impact:** `20_Agent_Web_Shell.md`, `19_Notifications.md`

### Internationalization (i18n)

**What:** Support for non-English languages in both the photographer app and agent-facing pages.
**Why deferred:** Requires an i18n framework, translation management, and RTL layout support.
**Complexity:** High
**v1 impact:** `20_Agent_Web_Shell.md`

### Account Deletion (GDPR/CCPA)

**What:** Photographer can delete their account and all associated data. Required for compliance in certain jurisdictions.
**Why deferred:** Must be implemented before public multi-tenant launch. Single-photographer v1 can handle this manually.
**Complexity:** Medium
**v1 impact:** `01_Auth.md`

## Gaps & Assumptions

### Prioritization Guidance

If choosing what to build next after MVP, the recommended priority based on user impact:

1. **Cancellation and rescheduling flow** -- happens frequently in real estate, currently handled outside the app
2. **Revenue dashboard** -- photographers need to see if ShotReady is helping their business
3. **Returning agent pre-fill** -- low complexity, high agent satisfaction
4. **Self-service agent cancellation** -- reduces text/call interruptions for the photographer
5. **Add-on services** -- revenue expansion for the photographer

### Assumptions

- All deferred features can be added without breaking changes to the v1 data model. The Firestore schema is intentionally flexible (document-based) to accommodate new fields and collections.
- Multi-tenant migration is the largest architectural change. All other features are additive.
- Complexity ratings are relative: Low = 1-2 days, Medium = 3-7 days, High = 1-3 weeks. These assume a developer familiar with the codebase and stack.  
