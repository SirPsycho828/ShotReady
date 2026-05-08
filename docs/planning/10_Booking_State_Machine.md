▸ TodoWrite  
  ← result received  
▸ Extended thinking (3336 chars)  
## Overview

Every booking in ShotReady follows a strict state machine. The `status` field on the booking document determines what actions are available, what the photographer sees on the detail screen, what the agent sees at their evolving URL, and what notifications fire. Invalid transitions are rejected by the `booking-updateStatus` Cloud Function. This file is the single source of truth for all valid states and transitions.

## Dependencies

- `02_Database_Schema.md` -- `bookings.status` field
- `03_Cloud_Functions.md` -- `booking-updateStatus` enforces transitions, triggers side effects
- `08_Dashboard_Job_List.md` -- Status determines bucket placement and card appearance
- `19_Notifications.md` -- Transitions trigger specific notifications
- `20_Agent_Web_Shell.md` -- Agent URL renders different content per state

## States

| Status | Description | Who's Acting |
|--------|------------|-------------|
| `pending` | Agent submitted booking request. Awaiting photographer review. | Photographer |
| `confirmed` | Photographer approved. Shoot is scheduled. | Neither (waiting for shoot day) |
| `shooting` | Photographer is at the property or actively shooting. | Photographer |
| `editing` | Shoot complete. Photographer is editing and processing photos. | Photographer |
| `proofing` | Watermarked photos published. Agent is reviewing and selecting. | Agent |
| `delivered` | Final photos delivered to agent. Invoice auto-drafted. | Photographer (review invoice) |
| `invoiced` | Invoice sent to agent. Awaiting payment. | Agent |
| `overdue` | Invoice past due date. | Agent (with photographer follow-up) |
| `paid` | Payment received via Stripe. | System (auto-close pending) |
| `closed` | Job archived. Terminal state. | -- |
| `declined` | Photographer declined the booking request. Terminal state. | -- |
| `cancelled` | Booking cancelled before shoot. Terminal state. | -- |

## Transition Map

```
                 ┌──────────┐
                 │ declined │ (terminal)
                 └──────────┘
                      ▲
                      │ decline
     ┌─────────┐─────┘
     │ pending │──────────────────┐
     └─────────┘  cancel          │ approve
          │                       ▼
          │              ┌───────────┐
          └─────────────▶│ cancelled │ (terminal)
                         └───────────┘
                              ▲
                   cancel     │
              ┌───────────────┤
              │               │
         ┌────┴──────┐       │
         │ confirmed │───────┘
         └───────────┘
              │ start shoot
              ▼
         ┌──────────┐
         │ shooting │
         └──────────┘
              │ complete shoot
              ▼
         ┌──────────┐
         │ editing  │
         └──────────┘
              │ send to proofing
              ▼
         ┌──────────┐
         │ proofing │
         └──────────┘
              │ deliver finals
              ▼
         ┌───────────┐
         │ delivered │
         └───────────┘
              │ send invoice
              ▼
         ┌───────────┐     due date passes
         │ invoiced  │──────────────┐
         └───────────┘              │
              │ payment received    ▼
              │              ┌──────────┐
              │              │ overdue  │
              │              └──────────┘
              │ payment received    │
              ▼◀────────────────────┘
         ┌──────────┐
         │   paid   │
         └──────────┘
              │ auto-close (7 days) or manual
              ▼
         ┌──────────┐
         │  closed  │ (terminal)
         └──────────┘
```

## Transition Rules

Each row defines a valid transition with its trigger, who initiates it, and what side effects occur.

| From | To | Trigger | Initiated By | Side Effects |
|------|----|---------|-------------|-------------|
| `pending` | `confirmed` | Photographer approves | Photographer (app) | Set `schedule.confirmedDate`. Email agent confirmation. |
| `pending` | `declined` | Photographer declines | Photographer (app) | Email agent with decline message. Terminal. |
| `pending` | `cancelled` | Cancelled before approval | Photographer (app) | Email agent cancellation notice. Terminal. |
| `confirmed` | `shooting` | Photographer starts shoot | Photographer (app) | Timestamp for analytics. Suggest light mode switch. |
| `confirmed` | `cancelled` | Cancelled after approval | Photographer (app) | Email agent cancellation notice. Terminal. |
| `shooting` | `editing` | Photographer completes shoot | Photographer (app) | -- |
| `editing` | `proofing` | Photographer triggers proofing | Photographer (app) | Set `proofing.sentAt`. Email agent proofing link. |
| `proofing` | `delivered` | Photographer delivers finals | Photographer (app) | Set `delivery.deliveredAt`. Generate MLS exports. Auto-create invoice (draft). Email agent download link. |
| `delivered` | `invoiced` | Photographer sends invoice | Photographer (app) | Create Stripe Payment Link. Set invoice status to `sent`. Email agent invoice with payment link. |
| `invoiced` | `overdue` | Due date passes | System (scheduled function) | Update invoice status. Email agent reminder. Push notify photographer. |
| `invoiced` | `paid` | Stripe payment succeeds | System (webhook) | Set invoice `paidAt`. Email agent receipt. Push notify photographer. |
| `overdue` | `paid` | Stripe payment succeeds | System (webhook) | Same as invoiced-to-paid. |
| `paid` | `closed` | 7 days after payment, or manual | System (scheduled) or Photographer | Archive. Terminal. |

### Invalid Transitions

Any transition not listed above is invalid. The `booking-updateStatus` Cloud Function must reject invalid transitions and return an error. Examples of invalid transitions:

- `editing` to `confirmed` (cannot go backwards)
- `proofing` to `editing` (cannot revert after agent has been sent proofing link)
- `declined` to anything (terminal state)
- `closed` to anything (terminal state)

## Agent-Facing URL Behavior

Each booking has one URL: `https://{domain}/b/{agentToken}`. The page content changes based on the current status. See `20_Agent_Web_Shell.md` for layout and branding.

| Status | Agent Sees |
|--------|-----------|
| `pending` | Confirmation message: "Your booking request has been submitted. You'll receive an email when your photographer responds." Show submitted details (date, address, package). |
| `confirmed` | Booking confirmed card with date, time (if assigned), address, package details. |
| `shooting` | "Your shoot is in progress." Brief status with property address and date. |
| `editing` | "Your photos are being edited. You'll receive an email when they're ready for review." |
| `proofing` | Full proofing gallery. See `16_Proofing_Gallery.md`. |
| `delivered` | Download section with final photos. Download button or link to ZIP. |
| `invoiced` | Download section (still accessible) + invoice summary + "Pay Now" button linking to Stripe. |
| `overdue` | Same as `invoiced` with a gentle "Payment overdue" banner and due date. |
| `paid` | Download section + "Paid" confirmation with receipt date. |
| `closed` | "This booking has been archived." Downloads available until retention period expires (90 days post-delivery). After that: "Photos are no longer available for download." |
| `declined` | "This booking was not accepted. Please contact your photographer directly." No booking details shown. |
| `cancelled` | "This booking was cancelled." Show original date and address for reference. |

## Photographer Detail Screen Per State

Each status renders a different primary action and content on the booking detail screen in the mobile app.

| Status | Primary Action Button | Detail Content |
|--------|----------------------|---------------|
| `pending` | "Approve" / "Decline" | Agent info, property details, requested date, package, agent notes |
| `confirmed` | "Start Shoot" | Scheduled date/time, property details with map, access code, shot list preview |
| `shooting` | "Complete Shoot" | Shot list (interactive checklist), access code, property notes. Field mode layout. See `13_Shoot_Day_Field_Mode.md` |
| `editing` | "Send to Proofing" | Upload status (link to web companion), photo count, processing status |
| `proofing` | -- (waiting on agent) | Proofing status: "Agent has selected X of Y photos" or "Agent has not viewed yet" |
| `delivered` | "Send Invoice" | Delivery confirmation, invoice draft preview with editable line items |
| `invoiced` | "Resend Invoice" | Invoice status, amount, due date, payment link |
| `overdue` | "Resend Invoice" | Same as invoiced + overdue warning, days past due |
| `paid` | "Close Job" | Payment confirmation, amount, date. Revenue added to history. |
| `closed` | -- | Read-only archive view. All details preserved. |

## Status Timestamps

Each transition writes a timestamp for audit and analytics. Stored as fields on the booking document:

| Transition | Timestamp Field |
|-----------|----------------|
| Created | `createdAt` |
| Confirmed | `schedule.confirmedDate` |
| Shoot started | `shooting.startedAt` |
| Shoot completed | `shooting.completedAt` |
| Proofing sent | `proofing.sentAt` |
| Proofing completed (by agent) | `proofing.completedAt` |
| Delivered | `delivery.deliveredAt` |
| Paid | Referenced from `invoices` collection |
| Any status change | `updatedAt` (automatic) |

**Note:** `shooting.startedAt` and `shooting.completedAt` are not in the current schema in `02_Database_Schema.md`. Add a `shooting` nested object: `{ startedAt: timestamp, completedAt: timestamp }`.

## Cancellation Rules

Cancellation is allowed only from `pending` or `confirmed` states. Once a shoot has started (`shooting` or later), the booking cannot be cancelled -- it must proceed through the workflow or be handled manually outside the app.

**From `pending`:** Either the photographer cancels (declines is preferred, but cancel is also valid if the agent requested cancellation) or the agent requests cancellation through direct communication with the photographer.

**From `confirmed`:** Only the photographer can cancel through the app. Agent cancellation requests come via external communication; the photographer then cancels in-app.

**No self-service agent cancellation for v1.** The agent-facing URL has no "Cancel" button. See `21_Future_Features.md`.

## Gaps & Assumptions

### Gaps

- **Reopen after close** -- PRD says "default to done, but easy to reopen." No reopen transition is defined. If an agent requests re-edits after closing, the photographer would need to create a new booking or handle it outside the app. Consider adding `closed` to `editing` transition post-MVP.
- **Partial delivery** -- No state for delivering some photos while waiting on additional edits. All-or-nothing delivery for v1.
- **Skip states** -- Can a photographer jump from `confirmed` directly to `editing` if they forget to tap "Start Shoot"? Default: no skipping. The photographer must progress through each state in order. This provides accurate timestamps for analytics.
- **Schema addition needed** -- `shooting.startedAt` and `shooting.completedAt` fields need to be added to the booking document shape in `02_Database_Schema.md`.

### Assumptions

- State transitions are atomic. The Cloud Function updates the status and triggers side effects in a single operation. If a side effect fails (e.g., email send fails), the status still updates -- the notification system handles retries independently. See `19_Notifications.md`.
- The `overdue` check runs daily at 9:00 AM. An invoice due at midnight will not be marked overdue until the next morning. Acceptable granularity for v1.
- Auto-close from `paid` to `closed` runs as a scheduled function checking for bookings with `paid` status older than 7 days. The photographer can also manually close at any time from `paid`.
- Terminal states (`closed`, `declined`, `cancelled`) are permanent for v1. Documents are never deleted -- they remain for historical reference and revenue reporting.  
