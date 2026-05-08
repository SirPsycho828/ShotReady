▸ TodoWrite  
  ← result received  
▸ Extended thinking (1223 chars)  
## Overview

The dashboard is the photographer's home screen -- the first thing they see when opening the app. It answers one question: "What do I need to do right now?" With 5-15 concurrent jobs across various lifecycle stages, the dashboard must communicate status at a glance without requiring the photographer to tap into individual bookings. The primary organization is a two-bucket split: jobs that need the photographer's action versus jobs waiting on someone else.

## Dependencies

- `02_Database_Schema.md` -- `bookings` collection, composite index on `photographerId` + `status`
- `04_UI_Design_System.md` -- Job card pattern, status pills, skeleton screens, swipe actions
- `05_Offline_Strategy.md` -- Dashboard uses cached booking data when offline
- `10_Booking_State_Machine.md` -- Status values and what each means for the photographer

## Screen Structure

The dashboard lives under the **Jobs** tab in bottom navigation (first tab, default on app open).

```
┌──────────────────────────────┐
│  ShotReady          [bell]   │  <- Header with notification bell
│──────────────────────────────│
│  [Needs Your Action (3)]     │  <- Section header with count
│  ┌──────────────────────────┐│
│  │ 123 Oak St    [Pending]  ││  <- Job card
│  │ Agent Smith · May 12     ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 456 Elm Ave   [Editing]  ││
│  │ Agent Jones · May 10     ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 789 Pine Rd   [Delivered]││
│  │ Agent Lee · May 8        ││
│  └──────────────────────────┘│
│                              │
│  [Waiting on Others (4)]     │  <- Section header with count
│  ┌──────────────────────────┐│
│  │ 321 Maple Dr  [Proofing] ││
│  │ Agent Park · May 11      ││
│  └──────────────────────────┘│
│  ...                         │
│                              │
│  [Completed] ▸               │  <- Collapsed by default
│──────────────────────────────│
│ [Jobs] [Calendar] [Route] [⚙]│ <- Bottom nav
└──────────────────────────────┘
```

## Two-Bucket Organization

### Bucket 1: Needs Your Action

Jobs where the photographer is the blocker. Sorted by urgency (oldest first within each status).

| Status | Why It Needs Action |
|--------|-------------------|
| `pending` | New booking request awaiting approval or decline |
| `confirmed` | Shoot is approved but hasn't happened yet (upcoming shoots) |
| `shooting` | Active shoot in progress |
| `editing` | Photos shot, not yet uploaded/processed |
| `delivered` | Photos delivered but invoice may need attention |
| `overdue` | Invoice past due, photographer may need to follow up |

### Bucket 2: Waiting on Others

Jobs where the photographer is not the blocker. The ball is in someone else's court.

| Status | Who Is It Waiting On |
|--------|---------------------|
| `proofing` | Agent is selecting photos |
| `invoiced` | Agent has been sent the invoice, awaiting payment |

### Bucket 3: Completed (Collapsed)

Jobs in terminal states. Collapsed by default with a count badge. Tap to expand.

| Status | Meaning |
|--------|---------|
| `paid` | Invoice paid, job complete |
| `closed` | Archived after payment |
| `cancelled` | Booking was cancelled |
| `declined` | Photographer declined the booking |

## Job Card Design

Each booking is rendered as a tappable card following the card pattern in `04_UI_Design_System.md`.

### Card Content

| Element | Position | Style |
|---------|----------|-------|
| Property address (street only) | Top-left | `h3` |
| Status pill | Top-right | Per `04_UI_Design_System.md` status pill colors |
| Agent name | Below address, left | `caption`, `textSecondary` |
| Date | Below address, right | `caption`, `textSecondary`, formatted "Mon, May 12" |
| Chevron right icon | Far right, vertically centered | Lucide `chevron-right`, `textMuted` |

### Card Tap

Navigates to the booking detail screen for that job. The detail screen content varies by booking status. See `10_Booking_State_Machine.md`.

### Card Swipe Actions

Swipe right reveals a single contextual quick action based on current status:

| Status | Swipe Action | Icon | Background |
|--------|-------------|------|------------|
| `pending` | Approve booking | `check` | `success` |
| `confirmed` | Navigate to property | `navigation` | `accent` |
| `shooting` | Navigate to property | `navigation` | `accent` |
| `editing` | Open web companion | `upload` | `accent` |
| `proofing` | Copy proofing link | `link` | `accent` |
| `delivered` | Copy download link | `link` | `accent` |
| `invoiced` | Copy payment link | `link` | `accent` |
| `overdue` | Resend invoice | `send` | `warning` |

Only one swipe direction (right). No destructive swipe actions on the dashboard.

## Sorting Within Buckets

### Needs Your Action

Primary sort: status priority (most urgent first), secondary sort: date ascending (oldest first).

Status priority order:
1. `pending` -- new requests lose value if ignored
2. `overdue` -- money owed
3. `shooting` -- active field work
4. `editing` -- blocking delivery
5. `delivered` -- may need invoice follow-up
6. `confirmed` -- upcoming shoots, sorted by `schedule.confirmedDate` ascending (nearest date first)

### Waiting on Others

Sorted by `updatedAt` descending (most recently updated first). When an agent completes proofing or pays an invoice, that job moves up.

### Completed

Sorted by `updatedAt` descending (most recently completed first). Limited to last 30 jobs to keep the list manageable. "View all" link at the bottom navigates to a full history screen.

## Data Loading

### Initial Load

Query: `bookings` where `photographerId == uid`, ordered by `updatedAt` descending, limit 50.

This single query fetches all active and recently completed bookings. Client-side grouping into the three buckets based on `status` field. No separate query per bucket.

### Real-Time Updates

Firestore real-time listener on the same query. When a booking status changes (e.g., agent completes proofing, Stripe webhook marks payment), the dashboard updates automatically. The card animates from one bucket to another.

### Offline Behavior

Dashboard renders from Firestore's offline cache. See `05_Offline_Strategy.md`. The offline indicator bar appears at the top. All cards remain tappable and viewable. Swipe actions that require connectivity (resend invoice) are disabled.

## Notification Bell

Top-right corner of the dashboard header. Shows an unread count badge (red circle with white number) when there are unread notifications.

Tap opens a notification list (bottom sheet or separate screen) showing recent events:
- New booking requests
- Agent proofing completions
- Payments received
- Overdue invoice alerts

See `19_Notifications.md` for notification types and content.

## Empty States

### No Bookings Yet (First-Time User)

After onboarding, the dashboard shows:
- Lucide `briefcase` icon, 64px, `textMuted`
- "No bookings yet"
- "Share your booking link with agents to get started"
- Copy booking link button (accent, prominent)

### No Jobs Needing Action

If all jobs are in "Waiting on Others" or "Completed":
- "Needs Your Action" section shows a brief message: "You're all caught up" in `textSecondary`
- Section remains visible (not hidden) so the photographer knows where new action items will appear

## Pull to Refresh

Standard pull-to-refresh gesture on the job list. Re-executes the Firestore query and refreshes all cards. Shows the platform-native refresh indicator.

## Filter and Search

### Quick Filters

A horizontally scrollable chip bar below the header. Chips:
- **All** (default, selected)
- **Today** -- bookings with `schedule.confirmedDate` matching today
- **This Week** -- bookings within the current calendar week
- **Pending** -- status `pending` only
- **Overdue** -- status with overdue invoices

Selecting a filter re-groups the visible cards. The two-bucket structure remains; the filter just narrows which bookings appear.

### Search

A search icon in the header (left of the notification bell) expands to a text input. Searches across:
- Property address
- Agent name
- Agent email

Search is client-side against the cached bookings (max 50). No server-side search for v1.

## Bucket Transition Animation

When a booking moves between buckets (e.g., photographer approves a pending booking, moving it from "Needs Your Action" as `pending` to `confirmed` which stays in the same bucket but reorders), the card animates:
- Fading out from old position (150ms)
- Fading in at new position (150ms)

Built with React Native Reanimated layout animations. Keeps the dashboard feeling alive without being distracting.

## Gaps & Assumptions

### Gaps

- **Batch actions** -- No specification for acting on multiple bookings at once (e.g., approve 3 pending bookings). Default: single-action only for v1. Batch operations add complexity without clear need at 5-15 job scale.
- **Revenue summary** -- The User Red Team asked "Is there a way for the photographer to see revenue/earnings over time?" Not included on the dashboard for v1. See `21_Future_Features.md`.
- **Job count limits** -- No specification for what happens when a photographer has 50+ historical bookings. The query limit of 50 and the "View all" link on completed jobs handles this, but a dedicated history/archive screen is not fully specified.

### Assumptions

- 50-booking query limit is sufficient. A photographer with 5 shoots/week accumulates ~250 bookings/year. The 50 most recent cover roughly 2-3 months of active and recent work.
- Client-side bucket grouping and sorting is performant for up to 50 bookings. No server-side aggregation needed.
- The dashboard is always the first screen after app launch (unless onboarding is incomplete, in which case onboarding resumes per `06_Photographer_Onboarding.md`).
- Booking detail screens (accessed by tapping a card) are separate from this spec. Each status has its own detail view content, coordinated by the state machine in `10_Booking_State_Machine.md`.  
