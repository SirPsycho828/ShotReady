▸ ToolSearch: select:TodoWrite  
  ← result received  
▸ Extended thinking (1271 chars)  
## Overview

Before a photographer can receive their first booking, they need a business name, at least one service package, and availability hours. That is the minimum. Everything else -- Stripe, MLS presets, branding, notification preferences -- is prompted contextually when first needed, not demanded upfront. The onboarding flow is progressive: get to value fast, then deepen configuration over time. A solo photographer evaluating ShotReady will give it 5-10 minutes to prove itself. The first-run experience must respect that.

## Dependencies

- `01_Auth.md` -- Registration creates the Firebase Auth user, onboarding creates the photographer profile
- `02_Database_Schema.md` -- `photographers` collection (`onboardingComplete` flag), `packages` collection
- `04_UI_Design_System.md` -- Skeleton screens, card patterns, input styles
- `07_Service_Packages.md` -- Package creation UI and data shape

## Onboarding Flow

### Trigger

Onboarding starts immediately after successful email/password registration. The photographer lands on Step 1 with no intermediate screens. If they close the app mid-onboarding and return later, they resume at the last incomplete step (tracked by which fields are populated on their photographer document).

### Step 1: Business Identity

**Goal:** Establish who they are.

**Fields:**
- Business name (required) -- pre-filled from the display name entered during registration, editable
- Phone number (optional) -- for their own records, not shared with agents unless they choose

**UI:** Single screen, large `h1` heading "Let's set up your business", two inputs, prominent "Continue" button. No back button (nothing to go back to).

**On complete:** Writes `businessName` and `phone` to `photographers/{uid}`.

### Step 2: First Package

**Goal:** Create at least one service package agents can book.

**Fields:**
- Package name (required) -- placeholder: "Standard Listing"
- Price (required) -- numeric input with dollar formatting, stored in cents
- Description (required) -- short text describing what's included. Placeholder: "Professional photos for your listing"
- Deliverables (required, at least 1) -- add/remove list of deliverable strings. Start with one empty field, "+" button to add more. Placeholders: "25 edited photos", "24-hour turnaround"
- Estimated duration (required) -- picker in 15-minute increments from 30 min to 4 hours. Default: 1 hour

**UI:** Scrollable form. The package card preview updates live at the top of the screen as the photographer fills in fields, showing exactly what the agent will see on the booking form. This creates an immediate feedback loop.

**On complete:** Creates a document in `packages` with `isActive: true`, `sortOrder: 0`. See `07_Service_Packages.md` for full package schema.

**Skip option:** None. At least one package is required before the photographer can receive bookings.

### Step 3: Availability

**Goal:** Define when they are available for shoots.

**UI:** Weekly grid showing Monday through Sunday. Each day has a toggle (on/off) and start/end time pickers. Default state: Monday-Friday, 8:00 AM to 5:00 PM enabled. Saturday and Sunday off.

The photographer taps a day to toggle it, then adjusts hours if needed. Minimal interaction for the common case (weekday business hours).

**On complete:** Writes `availability.windows` array to `photographers/{uid}`. See `02_Database_Schema.md` for the window shape.

### Step 4: Booking Link

**Goal:** Generate their unique booking URL.

**Auto-generated:** The system proposes a slug based on the business name (lowercased, hyphenated, stripped of special characters). Example: "Smith Photography" becomes `smith-photography`.

**Fields:**
- Booking slug (required) -- editable, validated for uniqueness and URL-safety (lowercase alphanumeric and hyphens only)

**Display:** Shows the full URL preview: `https://{domain}/book/{slug}`. Includes a "Copy Link" button and a brief explanation: "Share this link with agents. They'll use it to book shoots with you."

**On complete:** Writes `bookingSlug` to `photographers/{uid}`. Sets `onboardingComplete: true`.

### Completion Screen

Brief celebration screen: "You're ready to go." Shows:
- Their booking link with copy button
- "Share this with your agents to start receiving bookings"
- A prompt card for the next recommended setup action (see Contextual Prompts below)
- "Go to Dashboard" button

No confetti, no excessive animation. Professional tone.

## Contextual Prompts (Post-Onboarding)

These prompts appear at the right moment, not during initial setup. Each prompt appears once and can be dismissed permanently.

### Stripe Setup

**Trigger:** Photographer's first booking reaches `delivered` status (they are about to need payment collection).

**Prompt:** Card on the booking detail screen: "Ready to get paid? Connect your Stripe account to send invoices and collect payment online." CTA: "Connect Stripe". Dismiss: "I'll do this later".

**Flow:** Opens Stripe's OAuth flow (basic Stripe for v1). On success, writes `stripe.accountId` and `stripe.isConnected: true` to photographer document.

**If dismissed:** The photographer can still manually deliver photos. Invoice generation works but the payment link will show an error state until Stripe is connected. A persistent but subtle indicator appears in Settings showing "Payments: Not connected".

### MLS Configuration

**Trigger:** Photographer taps "Deliver" on a booking for the first time.

**Prompt:** Bottom sheet: "Set up your MLS export format so delivered photos meet your board's requirements." Fields for MLS name, max width, max height, max file size. Common presets available (dropdown with "CRMLS", "Bright MLS", "Custom").

**On complete:** Writes `mlsConfig` to photographer document. Applied to all future deliveries.

**If dismissed:** Photos deliver at original resolution. Photographer can configure later in Settings.

### Branding

**Trigger:** First booking reaches `proofing` status (agent is about to see photographer-branded pages).

**Prompt:** Card on the booking screen: "Add your logo and brand color to the pages your agents see." CTA: "Customize Branding". Dismiss: "Use defaults".

**Flow:** Simple form: upload logo (image picker, max 2 MB, stored in Cloud Storage), pick accent color (color picker or hex input, defaults to ShotReady blue `#2563EB`).

**On complete:** Writes `branding.logoUrl` and `branding.accentColor` to photographer document. See `20_Agent_Web_Shell.md`.

### Notification Preferences

**Trigger:** Third booking created (photographer has enough activity to care about notification volume).

**Prompt:** Card on dashboard: "Customize how you get notified about bookings and updates." CTA: "Set Preferences".

**Flow:** Notification settings screen with toggles. See `19_Notifications.md`.

## Resume and Recovery

### Incomplete Onboarding

If the photographer closes the app during onboarding:
- On next open, check `onboardingComplete` on their photographer document
- If `false` or document missing, resume onboarding at the earliest incomplete step
- Determination: Step 1 complete if `businessName` exists, Step 2 complete if at least one active package exists, Step 3 complete if `availability.windows` is non-empty

### Re-Configuration

All onboarding choices are editable in Settings after completion:
- Business name and phone: Profile section
- Packages: Packages section (full CRUD, see `07_Service_Packages.md`)
- Availability: Schedule section
- Booking link slug: Profile section (with uniqueness re-validation)

## Onboarding State on Photographer Document

| Field | Set During | Default |
|-------|-----------|---------|
| `businessName` | Step 1 | -- (required) |
| `phone` | Step 1 | `null` |
| `bookingSlug` | Step 4 | -- (required) |
| `availability.windows` | Step 3 | -- (required) |
| `onboardingComplete` | Step 4 completion | `false` |
| `branding.logoUrl` | Contextual prompt | `null` |
| `branding.accentColor` | Contextual prompt | `#2563EB` |
| `mlsConfig` | Contextual prompt | `null` |
| `stripe.isConnected` | Contextual prompt | `false` |
| `notifications.*` | Contextual prompt | See `19_Notifications.md` defaults |

## Gaps & Assumptions

### Gaps

- **Slug uniqueness for v1** -- With a single photographer, slug collision is impossible. However, the uniqueness check should be implemented now (Firestore query on `bookingSlug`) so it works correctly when multi-tenant is added. If the slug is taken, append a random 4-digit suffix.
- **Sample data** -- Should onboarding pre-populate a sample booking so the photographer can explore the app before receiving a real one? Not specified. Default: no sample data for v1. The dashboard shows an empty state with a prompt to share their booking link.
- **Package templates** -- The PRD does not specify whether the photographer should be offered pre-built package templates (e.g., "Basic: 15 photos, $150" / "Standard: 25 photos, $250" / "Premium: 40 photos + drone, $400") to choose from instead of building from scratch. Default: no templates for v1, but placeholders guide them.

### Assumptions

- Onboarding takes under 5 minutes for a photographer who knows their pricing.
- The photographer document is created during onboarding Step 1, not during Firebase Auth registration. Auth registration creates only the Firebase Auth user.
- Shot list templates (tied to packages) are not part of onboarding. They can be configured later in package settings. See `13_Shoot_Day_Field_Mode.md`.
- All contextual prompts track dismissal state using simple boolean fields on the photographer document (e.g., `prompts.stripeDismissed`, `prompts.brandingDismissed`). These are not included in the main schema to avoid clutter -- add a `dismissedPrompts` map field.  
