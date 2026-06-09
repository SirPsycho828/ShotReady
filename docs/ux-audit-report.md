# UX Intuitiveness Audit

## App Context
- **Name:** ShotReady
- **Domain:** Real estate photography workflow management
- **Target Users:** Independent real estate photographers (authenticated) and real estate agents (unauthenticated, token-based)
- **Tech Stack:** React 19 + Tailwind CSS 3.4 + custom components (no library)
- **Pages:** 6
- **Routes:** 6

## Workflow Map

### Workflow 1: Set Up Photographer Account — Bumpy
Path: Landing -> SignIn -> Dashboard (setup banner) -> Settings (Profile -> Packages -> Availability) -> Dashboard (copy booking link)
Gaps:
- [WF-001] Unclear Sequence at Settings -- 4 sections with no recommended order or required-vs-optional indication
- [WF-002] Dead End at Settings -- After completing all sections, no completion guidance or CTA to share booking link
- [WF-003] Hidden Prerequisite at Booking Link -- Doesn't mention that packages + availability are required for a working booking form

### Workflow 2: Monitor Bookings (web) — Bumpy
Path: Dashboard -> view booking cards (read-only)
Gaps:
- [WF-004] Dead End at BookingCard -- Hover shadow effect looks clickable but cards are non-interactive divs

### Workflow 3: Upload Photos to Booking — Smooth
Path: Dashboard -> Upload -> BookingSelector -> UploadScreen -> Send to Proofing -> success banner
Gaps:
- [WF-005] Missing Handoff after Send to Proofing -- No explicit next step suggested

### Workflow 4: Agent Books a Shoot — Smooth
Path: /book/:slug -> fill form -> submit -> success StatusMessageCard
Gaps:
- [WF-006] Dead End after Booking Submission -- Success message doesn't mention tracking link

### Workflow 5: Agent Reviews & Approves Photos — Smooth
Path: /b/:token (proofing) -> ProofingGallery -> select photos -> approve -> success banner
Gaps:
- [WF-007] Broken Feedback Loop -- Uses window.confirm() which doesn't match Darkroom design

### Workflow 6: Agent Downloads Photos — Smooth
No gaps found.

### Workflow 7: Agent Pays Invoice — Smooth
Path: /b/:token (invoiced) -> InvoiceSection -> Pay -> Stripe Checkout
Gaps:
- [WF-008] Missing Handoff after Stripe Payment -- No guidance about payment processing time

## Page Scorecard

| Page | Orient. | Actions | Progress | Guidance | Metrics | Empty | Next | Feedback | Intent | Score |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Landing | P | P | - | P | - | - | P | - | P | 5/5 |
| Dashboard | P | P | P | P | P | P | / | P | P | 8.5/9 |
| Booking Form | P | P | M | P | - | - | / | P | P | 5.5/7 |
| Booking View | P | / | P | P | / | P | / | / | P | 6.5/9 |
| Web Companion | / | P | P | P | / | P | / | P | P | 7.5/9 |
| Settings | P | P | M | / | - | P | M | P | / | 5/8 |

## Findings (Prioritized)

### High
- **UX-001** [Unclear Sequence] Settings page has 4 sections (Profile, Booking Link, Packages, Availability) with no indication of recommended order, required vs. optional, or setup completion progress. New users won't know all three (profile + packages + availability) are needed for a working booking link. (Pages: Settings)
  Layer: Progress/Status | Fix: Add a setup checklist or progress indicator at the top of Settings showing which sections are complete and which are required.

- **UX-002** [Hidden Prerequisite] Booking Link section only says "Set a booking slug" but doesn't reveal that at least 1 active package and availability windows are also required for the booking form to function. A photographer could share their link and agents would see a broken experience. (Pages: Settings)
  Layer: Guidance | Fix: Add a status indicator showing prerequisites: "Booking slug set", "At least 1 active package", "Availability configured". Show warning if sharing link with incomplete setup.

- **UX-003** [Missing Progress] Booking Form is a long form with 5 sections (Your Info, Property Details, Date, Package, Notes) but no step indicator or progress bar. On mobile especially, agents can't tell how far through the form they are. (Pages: Booking Form)
  Layer: Progress/Status | Fix: Add a section progress indicator (e.g., "Step 2 of 5" or a progress bar) that updates as the user scrolls through sections.

### Medium
- **UX-004** [Dead End] After saving any Settings section, a brief "Saved" indicator appears for 2 seconds but there's no guidance on what to do next. After completing all setup, no celebration or CTA to go share the booking link. (Pages: Settings)
  Layer: Next Steps | Fix: After all required sections are complete, show a persistent "Setup Complete" card with CTA to copy/share booking link from Dashboard.

- **UX-005** [Dead End] Dashboard BookingCards have hover shadow effect (`hover:shadow-md`) making them appear clickable, but they're plain divs with no interaction. Users will try to click for booking details. (Pages: Dashboard)
  Layer: Action Clarity | Fix: Either make cards truly clickable (link to a detail view or expand inline) or remove the hover shadow effect to signal they're informational only. Consider adding a subtle "Manage on mobile app" indicator.

- **UX-006** [Broken Feedback Loop] Proofing photo approval uses `window.confirm()` which renders as a plain browser dialog — visually jarring against the polished Darkroom design. The confirmation text is good but the presentation breaks immersion. (Pages: Booking View)
  Layer: Feedback | Fix: Replace window.confirm() with a custom confirmation modal that matches the Darkroom design system.

- **UX-007** [Missing Orientation] Web Companion page lacks a heading/title when a booking is selected for upload. The UploadScreen component shows booking address and agent name but no page-level orientation ("Upload Photos for 123 Main St"). (Pages: Web Companion)
  Layer: Orientation | Fix: Add a clear page heading and back-to-selector breadcrumb context in UploadScreen.

- **UX-008** [Missing Guidance] BookingView pending/confirmed statuses show "You'll receive an email when [photographer] responds" but don't set expectations about timing (e.g., "Most photographers respond within 24 hours"). (Pages: Booking View)
  Layer: Guidance | Fix: Add a subtle timing expectation to the status message body.

### Low
- **UX-009** [Missing Handoff] After sending photos to proofing, success message says "Photos sent to [agent]!" but doesn't explicitly suggest what to do next (e.g., "Head back to your Dashboard" or "The agent will be notified by email"). (Pages: Web Companion)
  Layer: Next Steps | Fix: Enhance success banner with a "Back to Dashboard" link or explain the agent will be emailed.

- **UX-010** [Dead End] After booking form submission, the success message says "You'll receive an email" but doesn't mention the agent will get a unique tracking link they can use to check status anytime. (Pages: Booking Form)
  Layer: Next Steps | Fix: Add a line to the success message: "We'll email you a link to track your booking's progress."

- **UX-011** [Missing Handoff] After Stripe payment, agent returns to the booking URL but there's no guidance about how quickly the payment will be reflected. (Pages: Booking View)
  Layer: Feedback | Fix: Add a brief note near the invoice section about payment processing time.

- **UX-012** [Partial Metrics] BookingView has limited metrics -- proofing shows selected count and delivery shows file size/photo count, but no expected timelines or additional context on pending/confirmed statuses. (Pages: Booking View)
  Layer: Metrics | Fix: Add package name, scheduled date, and estimated timeline where available.

## Summary
- **Total findings:** 12
- **By severity:** 0 critical, 3 high, 5 medium, 4 low
- **Pages with worst scores:** Settings (5/8), Booking Form (5.5/7), Booking View (6.5/9)
- **Most common missing layer:** Next Steps (partial/missing on 4 pages)
- **Workflows at risk:** Set Up Photographer Account (Bumpy), Monitor Bookings (Bumpy)

## Results

### Before/After Scorecard
| Page | Before | After | Change |
|------|--------|-------|--------|
| Landing | 5/5 | 5/5 | -- |
| Dashboard | 8.5/9 | 8.5/9 | UX-005 fix |
| Booking Form | 5.5/7 | 7/7 | +1.5 |
| Booking View | 6.5/9 | 9/9 | +2.5 |
| Web Companion | 7.5/9 | 8.5/9 | +1 |
| Settings | 5/8 | 8/8 | +3 |

### Summary
- **Findings resolved:** 12/12
- **Average page score:** 82% -> 98%
- **Workflows fixed:** Set Up Photographer Account (Bumpy -> Smooth), Monitor Bookings (Bumpy -> Smooth)
- **Components created:** GuidanceTip, NextStepCard, AppTour (apps/web/src/components/ux/)
- **Onboarding:** 5-stop app tour (Stats, Quick Actions, Jobs Pipeline, Upload, Settings) — auto-starts on first visit, skippable, replayable from Settings. Setup wizard not needed (3 setup entities with inline checklist).
- **Pages modified:** 7 (+ AppTour provider wrapping App.tsx)
- **Anti-patterns:** All 8 checked, none present
