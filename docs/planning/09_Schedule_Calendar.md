▸ TodoWrite  
  ← result received  
▸ Extended thinking (992 chars)  
## Overview

The calendar is the photographer's scheduling hub -- the second tab in bottom navigation. It serves two purposes: viewing upcoming shoots at a glance and managing availability windows that control when agents can book. The calendar shows confirmed bookings as time blocks, pending requests as tentative markers, and highlights today with a quick path to route planning. Availability management lives here rather than buried in settings because schedule control is a daily concern.

## Dependencies

- `02_Database_Schema.md` -- `bookings` collection (schedule fields), `photographers` collection (availability windows, blocked dates)
- `04_UI_Design_System.md` -- Color tokens, card patterns, status pills
- `05_Offline_Strategy.md` -- Calendar data cached for offline viewing
- `10_Booking_State_Machine.md` -- Which statuses appear on the calendar
- `11_Agent_Booking.md` -- Availability windows determine bookable slots on the agent form
- `12_Route_Optimization.md` -- "Optimize route" action accessible from day detail

## Screen Structure

The calendar screen has two layers: a monthly grid for navigation and a day detail panel for viewing a selected day's shoots.

```
┌──────────────────────────────┐
│  Calendar        [Settings]  │
│──────────────────────────────│
│       ◀  May 2026  ▶        │
│  M   T   W   T   F   S   S  │
│                  1   2   3   │
│  4   5   6   7  [8]  9  10  │
│  11  12  13  14  15  16  17  │
│  18  19  20  21  22  23  24  │
│  25  26  27  28  29  30  31  │
│──────────────────────────────│
│  Thursday, May 8             │
│  3 shoots · Route planned ✓  │
│──────────────────────────────│
│  ┌──────────────────────────┐│
│  │ 9:00  123 Oak St   1hr  ││
│  │       Agent Smith        ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 10:30 456 Elm Ave  1hr  ││
│  │       Agent Jones        ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 1:00  789 Pine Rd  45m  ││
│  │       Agent Lee          ││
│  └──────────────────────────┘│
│                              │
│  [Optimize Route]            │
│──────────────────────────────│
│ [Jobs] [Calendar] [Route] [⚙]│
└──────────────────────────────┘
```

## Monthly Grid

### Layout

Standard 7-column grid, Monday-start. Fixed height (does not scroll). Swipe left/right or tap arrows to change month.

### Day Cell Indicators

Each day cell shows dots below the date number to indicate bookings:

| Indicator | Meaning | Color |
|-----------|---------|-------|
| Blue dot | Confirmed booking(s) | `accent` |
| Yellow dot | Pending request(s) | `warning` |
| Multiple dots | Multiple bookings (max 3 dots shown) | Mixed based on status |
| Gray background | Blocked date | `surfaceRaised` |
| Strikethrough number | Outside availability (e.g., Sunday when Sunday is off) | `textMuted` |

### Today Highlight

Today's date cell has an `accent` circle behind the number. If today is also the selected day, the circle is filled; otherwise it is an outline.

### Selected Day

Tapping a day cell selects it and scrolls the day detail panel into view below the grid. Selected day has a subtle `surfaceRaised` background.

### Data Query

On month change, query `bookings` where `photographerId == uid` and `schedule.confirmedDate` or `schedule.requestedDate` falls within the visible month range. This fetches all bookings for dot rendering. Single query per month navigation.

## Day Detail Panel

Below the monthly grid, a scrollable panel shows the selected day's shoots in chronological order.

### Day Header

- Full date: "Thursday, May 8"
- Summary line: "{count} shoots" + route status ("Route planned" with checkmark if `routePlans` document exists for this date, or "No route" if absent)

### Shoot Cards

Each booking on the selected day renders as a time-block card:

| Element | Position | Style |
|---------|----------|-------|
| Start time | Left column, top | `h3`, `textPrimary` |
| Property address (street) | Right of time, top | `bodyMedium` |
| Duration | Right-aligned, top | `caption`, `textSecondary` |
| Agent name | Right of time, below address | `caption`, `textSecondary` |
| Status pill | Right-aligned, below duration | Standard status pill |

**Confirmed bookings** have a left border accent line (3px, `accent`).

**Pending bookings** have a left border in `warning` and a dashed card border to visually distinguish them from confirmed shoots. Tapping navigates to the booking detail for approval.

### Shoot Card Ordering

Cards ordered by `schedule.startTime` ascending. Bookings without a start time yet (pending, not route-optimized) appear at the bottom of the list in a "Time TBD" group.

### Empty Day

If the selected day has no bookings:
- "No shoots scheduled"
- If the day is within availability windows: "Available for bookings"
- If the day is blocked or outside availability: "Not available"

## Availability Management

Accessed via the gear icon in the calendar header, which opens an "Availability" bottom sheet.

### Recurring Windows

The same weekly grid from onboarding (see `06_Photographer_Onboarding.md`). Seven rows (Mon-Sun), each with:
- Toggle switch (available / not available)
- Start time picker (when toggled on)
- End time picker (when toggled on)

Changes save immediately on toggle or time change (optimistic write to `photographers/{uid}.availability.windows`).

### Blocked Dates

Below the recurring windows, a "Blocked Dates" section:
- "Add blocked date" button opens a date picker
- List of currently blocked dates, each with a remove (X) button
- Blocked dates override recurring availability (a blocked Monday means no bookings that Monday even if Monday is normally available)

Changes save immediately (optimistic write to `photographers/{uid}.availability.blockedDates`).

### How Availability Affects Booking

Availability data is read by the agent booking form (see `11_Agent_Booking.md`) to show which dates are bookable. The booking Cloud Function also checks availability on submission, but still creates the booking as `pending` with a warning if the agent picks an unavailable date (photographer decides whether to accommodate).

## Conflict Detection

### Visual Conflict Warning

If two confirmed bookings overlap in time on the same day (start time + duration of one overlaps with start time of another), both cards show a `warning` border and a small alert icon (Lucide `alert-triangle`, 16px) with tooltip: "Time overlap with another shoot."

### Conflict Calculation

```
Booking A conflicts with Booking B if:
  A.startTime < B.startTime + B.duration
  AND
  B.startTime < A.startTime + A.duration
```

Times are compared as minutes from midnight. Calculation runs client-side when rendering the day detail.

### Conflict Resolution

No automatic resolution. The photographer resolves conflicts by:
1. Tapping a conflicting booking to adjust its time or date
2. Re-running route optimization for the day (which will re-sequence and re-time shoots). See `12_Route_Optimization.md`

## Today Quick Actions

When today is selected (default on calendar open), additional actions appear below the shoot cards:

- **"Optimize Route"** button -- navigates to route planning for today. Visible only when today has 2+ confirmed bookings and either no route plan exists or bookings have changed since last optimization. See `12_Route_Optimization.md`.
- **"Start Shoot Day"** button -- navigates to the route view (third tab) with today's plan loaded. Visible when a route plan exists for today.

## Pending Booking Indicators

Pending bookings are important calendar signals -- they represent potential schedule commitments that need attention.

- Pending bookings show as yellow-dotted days on the monthly grid
- In the day detail, pending cards appear in a separate "Pending Requests" section above confirmed shoots
- Each pending card has inline "Approve" and "Decline" buttons so the photographer can act without navigating away from the calendar
- Approving from the calendar sets status to `confirmed` and moves the card into the confirmed shoot list with animation

## Data and Performance

### Queries

| View | Query |
|------|-------|
| Monthly grid dots | `bookings` where `photographerId == uid`, `schedule.confirmedDate` (or `requestedDate`) within month range. One query per month. |
| Day detail | Client-side filter from the monthly query results. No additional query. |
| Availability | Single read of `photographers/{uid}` (already cached from app init). |

### Caching

Monthly booking data is cached by Firestore's offline persistence. Navigating between months while offline shows cached data if previously viewed. Today's bookings are always cached as part of Tier 1 data. See `05_Offline_Strategy.md`.

### Real-Time Updates

Firestore listener on the monthly query. New bookings, status changes, and schedule updates reflect on the calendar in real time when online.

## Gaps & Assumptions

### Gaps

- **Multi-day bookings** -- No specification for shoots spanning multiple days (e.g., large commercial properties). Default: not supported for v1. Each booking is a single date.
- **Time zone handling** -- No specification for photographers who work across time zones. Default: all times in the device's local time zone. Firestore timestamps are UTC; display converts to local.
- **Recurring blocked dates** -- Only individual blocked dates are supported. No "block every Saturday in June" shortcut. Photographer must add dates individually.
- **Calendar sharing or export** -- No iCal export or sync with Google Calendar. See `21_Future_Features.md`.

### Assumptions

- Calendar defaults to today's date on open. The photographer's most common action is checking today and the next few days.
- Monthly booking queries return at most 30-40 bookings (realistic max for a busy month). Client-side filtering for day detail is performant.
- Availability windows use the photographer's device time zone. All `startTime` and `endTime` strings are local time.
- The calendar does not show non-booking events (personal appointments, travel blocks). It is exclusively a shoot calendar for v1.
- Blocked dates are stored as ISO date strings (`YYYY-MM-DD`) without time zone information. A blocked date blocks the entire day regardless of availability windows.  
