▸ TodoWrite  
  ← result received  
▸ Extended thinking (1142 chars)  
## Overview

Route optimization plans the photographer's shoot day: what order to visit properties, when to arrive at each, and how lighting conditions affect timing. The system uses a bounded heuristic combining Google Maps Directions API for drive times with property orientation data for lighting preferences. The photographer can override the suggested order at any time. The route screen is the third tab in bottom navigation and serves as the day-of-shoot command center before entering field mode at each stop.

## Dependencies

- `02_Database_Schema.md` -- `routePlans` collection and stop shape, `bookings` collection (property lat/lng, orientation)
- `03_Cloud_Functions.md` -- `routing-optimize` callable function
- `05_Offline_Strategy.md` -- Route plan is Tier 1 cached data
- `09_Schedule_Calendar.md` -- "Optimize Route" action triggered from calendar day detail
- `13_Shoot_Day_Field_Mode.md` -- Route screen transitions into field mode at each stop

## Optimization Algorithm

### Inputs

The `routing-optimize` Cloud Function receives a date and queries all `confirmed` bookings for that date. For each booking it extracts:

- `property.lat`, `property.lng` (geocoded at booking creation)
- `property.orientation` (N, NE, E, SE, S, SW, W, NW, or unknown)
- `schedule.estimatedDuration` (minutes, from package)

### Step 1: Drive Time Matrix

Call Google Maps Directions API with all properties as waypoints and `optimizeWaypoints: true`. This returns the drive-time-optimized order and leg durations. Single API call.

**API limits:** Directions API supports up to 25 waypoints per request. A photographer with 10-15 shoots per day is well within this limit.

### Step 2: Lighting Adjustment

After receiving the drive-time-optimized order, apply lighting preferences as a secondary sort. The heuristic is intentionally simple:

| Orientation | Preferred Window | Reason |
|-------------|-----------------|--------|
| E, NE, SE | Before noon | East-facing fronts are lit by morning sun |
| W, NW, SW | After noon | West-facing fronts are lit by afternoon sun |
| N, S | No preference | Even lighting throughout the day |
| Unknown | No preference | Optimize for drive time only |

**Adjustment logic:**

1. Start with the Directions API optimized order
2. For each stop, calculate its estimated arrival time based on cumulative drive + shoot durations starting from the photographer's first availability hour
3. Check if the arrival time falls within the lighting window for that property's orientation
4. If a simple swap of two adjacent stops would move both into better lighting windows without adding more than 15 minutes of total drive time, perform the swap
5. Repeat until no beneficial swaps remain

This is a greedy local optimization, not a global solver. It respects drive time as the primary constraint and treats lighting as a best-effort improvement. The 15-minute threshold prevents lighting optimization from creating unreasonable detours.

### Step 3: Build Route Plan

Assemble the final stop sequence with computed fields:

- `sortOrder` -- position in route (0-indexed)
- `estimatedArrival` -- calculated from start time + cumulative drive and shoot durations
- `driveFromPrevious` -- minutes driving from the previous stop (0 for the first stop)
- `lightingWindow.ideal` -- formatted time range from the heuristic (e.g., "9:00-12:00")
- `lightingWindow.reason` -- human-readable explanation (e.g., "East-facing front, morning light")
- `totalDistanceMeters` and `totalDurationMinutes` -- route summary

### Start Time

The route starts at the photographer's earliest availability window for that day of week. Example: if their Monday window is 8:00-17:00, the first stop's estimated arrival is 8:00 plus drive time from the photographer's location.

**Photographer start location:** Not stored for v1. The first stop's drive time assumes zero drive (photographer starts at the first property). The photographer can mentally add their commute. Post-MVP: add a "start from" address in settings.

## Route Plan Document

Written to `routePlans/{photographerId}_{YYYY-MM-DD}`. Full schema in `02_Database_Schema.md`. Key fields:

- `stops` array with the ordered sequence
- `isOptimized: true` after the function completes
- `optimizedAt` timestamp
- `totalDistanceMeters` and `totalDurationMinutes` for the summary header

## Route Screen (Third Tab)

### Date Selection

Top of screen shows the selected date with left/right arrows to navigate days. Defaults to today. Only shows dates that have confirmed bookings.

### Route Summary Header

Below the date:
- "{X} stops" -- total count
- "{Y} hr {Z} min total" -- drive time + shoot time
- "{D} miles" -- total distance (converted from meters)
- Route status: "Optimized" with checkmark or "Not optimized" with refresh icon

### Stop List

Vertical scrollable list of stop cards in route order. Each card:

```
┌──────────────────────────────────────┐
│  [drag]  1. 123 Oak St         9:00  │
│          Agent Smith · 1hr shoot     │
│          ☀ Best light: 9am-12pm      │
│          🚗 -- (first stop)          │
├──────────────────────────────────────┤
│          🚗 18 min drive             │
├──────────────────────────────────────┤
│  [drag]  2. 456 Elm Ave       10:18  │
│          Agent Jones · 1hr shoot     │
│          ☀ No lighting preference    │
│          🚗 18 min from previous     │
└──────────────────────────────────────┘
```

**Card elements:**

| Element | Position | Style |
|---------|----------|-------|
| Drag handle | Far left | Lucide `grip-vertical`, `textMuted` |
| Stop number | Left of address | `bodyMedium` |
| Property address (street) | Center | `bodyMedium` |
| Estimated arrival time | Right | `h3`, `accent` |
| Agent name + duration | Below address | `caption`, `textSecondary` |
| Lighting note | Below agent | `caption`, `textSecondary`, sun icon |

**Drive time between stops:** Rendered as a connecting segment between cards with drive duration and a car icon.

### Lighting Annotations

Each stop shows a brief lighting note explaining why it is scheduled at that time:

| Scenario | Annotation |
|----------|-----------|
| In ideal window | "Best light: 9am-12pm" (green text) |
| Outside ideal window | "Ideal light: 2pm-5pm (arriving 10am)" (yellow text) |
| No preference | "No lighting preference" (muted text) |
| Unknown orientation | "Lighting: unknown orientation" (muted text) |

These annotations build trust in the algorithm. The photographer sees the reasoning, not just the result. See User Red Team Issue #8.

## Manual Override

### Drag to Reorder

Stop cards have drag handles. The photographer can drag any stop to a new position. On drop:

1. Update `sortOrder` values in the local stops array
2. Recalculate estimated arrival times based on the new order (client-side, using the cached drive time matrix)
3. Update lighting annotations to reflect new arrival times
4. Show a "Re-optimize" button at the top if the order differs from the last optimized sequence
5. Save the updated route plan to Firestore

**Drive time recalculation on reorder:** The original optimization call returns drive durations between all pairs of adjacent stops in the optimized order. For manual reorder, approximate drive times using straight-line distance ratio from known legs. For exact times after significant reordering, the photographer taps "Re-optimize" which calls the Cloud Function again with the current stop set.

### Re-Optimize Button

Appears when the photographer has manually reordered. Tapping it calls `routing-optimize` again, generating a fresh route. The photographer's manual order is replaced. Confirmation prompt: "Re-optimize will recalculate the best route. Your manual changes will be replaced. Continue?"

## Navigation Handoff

Each stop card has a "Navigate" button (Lucide `navigation` icon) that opens the native maps app with turn-by-turn directions to that property.

**Implementation:** Deep link to the device's default maps app using the property's lat/lng coordinates.

- iOS: `maps://` URL scheme
- Android: `geo:` intent or Google Maps URL

The photographer taps "Navigate" on the next stop, drives there, then returns to ShotReady to start the shoot (transitioning into field mode). See `13_Shoot_Day_Field_Mode.md`.

## Route Generation Triggers

| Trigger | Source |
|---------|--------|
| Manual "Optimize Route" button | Calendar day detail (see `09_Schedule_Calendar.md`) |
| Manual "Re-optimize" button | Route screen after manual reorder |
| Auto-suggestion | When a new booking is confirmed for a date that already has a route plan, show a prompt: "Route may need updating. Re-optimize?" |

No automatic re-optimization. The photographer always initiates or approves route generation.

## Route Screen Actions

| Action | When Available |
|--------|---------------|
| Optimize / Re-optimize | 2+ confirmed stops, online only |
| Navigate to stop | Any stop, opens native maps |
| Start Shoot | Tap a stop card to enter field mode for that booking |
| Drag reorder | Always available |

## Gaps & Assumptions

### Gaps

- **Photographer start location** -- No home/office address stored. The first stop's drive time is effectively zero. Post-MVP: add a start address to profile for accurate first-leg timing.
- **Return home time** -- Route does not calculate drive time home after the last stop. Total duration only reflects stop-to-stop time.
- **Traffic conditions** -- Google Maps Directions API can include traffic estimates with `departureTime` parameter. Not used for v1 (adds complexity and cost). The photographer's local knowledge compensates.
- **Multi-stop route sharing** -- No way to share the full route plan (e.g., with a studio assistant). Single-user view only.

### Assumptions

- A photographer has at most 10-15 shoots per day. The Directions API handles this easily.
- The lighting heuristic is intentionally simple. Photographers understand that "east-facing = morning light" is an approximation, not a guarantee. The annotation text builds trust without overpromising precision.
- Property orientation is optional. If most bookings lack orientation data, the route defaults to pure drive-time optimization, which is still valuable.
- One Directions API call per optimization run. At $5 per 1,000 calls, a photographer optimizing once daily costs roughly $0.15/month.
- Drag-to-reorder produces approximate drive times between reordered stops. Exact recalculation requires a re-optimize call.  
