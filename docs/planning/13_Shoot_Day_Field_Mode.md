▸ TodoWrite  
  ← result received  
▸ Extended thinking (1541 chars)  
## Overview

Field mode is the photographer's active shoot companion. When the photographer taps "Start Shoot" on a booking, the app transitions into a streamlined interface optimized for one-handed use in bright outdoor light: shot list checklist, property access codes, agent notes, and a "Complete Shoot" action. Everything the photographer needs is visible at a glance with no navigation required. Field mode runs entirely on cached data -- spotty connectivity inside homes must not break the experience.

## Dependencies

- `02_Database_Schema.md` -- `bookings.shotList` array shape, property nested object, `shooting` timestamps
- `04_UI_Design_System.md` -- Field mode layout constraints, light mode auto-switch, tap target sizes
- `05_Offline_Strategy.md` -- Shot list updates are allowed offline writes, property data is Tier 1 cached
- `07_Service_Packages.md` -- Shot list templates seed the booking's shot list
- `10_Booking_State_Machine.md` -- `confirmed` to `shooting` to `editing` transitions
- `12_Route_Optimization.md` -- Field mode entered from route screen stop cards

## Entering Field Mode

### Trigger

The photographer enters field mode by tapping "Start Shoot" on either:
- A booking detail screen (from the dashboard) when booking status is `confirmed`
- A stop card on the route screen

### State Transition

"Start Shoot" transitions the booking from `confirmed` to `shooting`. This writes `shooting.startedAt` and `updatedAt` to the booking document. See `10_Booking_State_Machine.md`.

### Light Mode Prompt

On entering field mode, if the app is in dark mode, show a brief prompt: "Switch to light mode for outdoor visibility?" with "Switch" and "Stay Dark" options. The prompt auto-dismisses after 5 seconds (defaults to staying in current mode). See `04_UI_Design_System.md` for dual-mode design.

## Screen Layout

Field mode replaces the standard app chrome. No bottom tab bar, no standard header. Every interactive element sits in the bottom 60% of the screen for one-handed thumb reach.

```
┌──────────────────────────────┐
│                              │  ← Top 40%: read-only info
│  123 Oak St                  │
│  Agent: Sarah Smith          │
│                              │
│  ACCESS: 4821               │  ← Large, glanceable
│  Ring doorbell, lockbox on   │
│  left side of garage         │
│                              │
│──────────────────────────────│
│                              │  ← Bottom 60%: interactive
│  SHOT LIST          4 / 15   │
│  ┌──────────────────────────┐│
│  │ [✓] Front exterior       ││
│  │ [✓] Front exterior angle ││
│  │ [✓] Rear exterior        ││
│  │ [✓] Kitchen - wide       ││
│  │ [ ] Kitchen - detail     ││  ← Next unchecked item
│  │ [ ] Living room          ││
│  │ [ ] Dining room          ││
│  │ ...                      ││
│  └──────────────────────────┘│
│                              │
│  [+ Add Shot]  [Complete ▶] │
│                              │
└──────────────────────────────┘
```

## Top Section (Read-Only Info)

The top 40% of the screen displays reference information the photographer glances at but does not interact with during the shoot.

### Property Header

- **Address** -- `h2` size, `textPrimary`. Street address only (no city/state).
- **Agent name** -- `body` size, `textSecondary`. "Agent: {name}"

### Access Information

- **Access code** -- `h2` size, `accent` color, bold. Prominent and unmissable. If no access code exists, this row is hidden.
- **Access notes** -- `body` size, `textPrimary`. Full text of `property.accessNotes`. If no notes, hidden.

The access code is intentionally large. A photographer juggling a camera and tripod while standing at a gate needs to read a 4-digit code at arm's length.

### Agent Notes

If the agent included notes at booking (e.g., "Make sure to get the new kitchen" or "Staging will be done by 9am"), show them below access info in a subtle card: `caption` label "Agent Notes", `body` text content, `surface` background. Hidden if no notes exist.

## Bottom Section (Interactive)

### Shot List

The shot list is the primary interactive element in field mode.

**Header:** "SHOT LIST" label with a progress counter: "{completed} / {total}" in `bodyMedium`.

**List items:** Each shot is a tappable row with:

| Element | Size | Behavior |
|---------|------|----------|
| Checkbox | 32x32px visual, 56x56px tap target | Tap to toggle |
| Shot label | `body` size | Static text |

**Checked state:** Checkbox filled with `success` color, checkmark icon. Label gets `textSecondary` color (dimmed but still readable). Checked items stay in place -- they do not move to the bottom or disappear.

**Unchecked state:** Empty checkbox outline in `border` color. Label in `textPrimary`.

**On check:** Write `isCompleted: true` and `completedAt: now` to the shot list item on the booking document. This is an allowed offline write. See `05_Offline_Strategy.md`.

**On uncheck:** Write `isCompleted: false` and `completedAt: null`. Allowed offline.

**Scroll behavior:** The shot list scrolls independently within its container. On entry, auto-scrolls to the first unchecked item so the photographer immediately sees what is next.

### Shot List Management

**Add Shot:** A button below the shot list that appends a new item. Tapping it opens a text input at the bottom of the list. The photographer types a shot description and taps a confirm button (checkmark icon). The new item is added to the `shotList` array with `isCompleted: false`.

**Reorder:** Not available in field mode. Reordering is a pre-shoot activity done on the booking detail screen. During a shoot, the list order is fixed to reduce accidental touches.

**Delete:** Not available in field mode. Items can be deleted from the booking detail screen before or after the shoot.

### Pre-Shoot Shot List Editing

Before the shoot (when booking is in `confirmed` status), the booking detail screen shows the shot list in an editable mode:

- **Add:** Append new items
- **Delete:** Swipe-left to remove items
- **Reorder:** Drag handles for reordering
- **Edit text:** Tap a label to edit it inline

The shot list is seeded from the package's `shotListTemplate` at booking creation (see `07_Service_Packages.md`). The photographer customizes per job as needed. Common customization: adding agent-requested shots from `agentNotes`, removing rooms that don't exist (e.g., "no dining room in this unit").

## Complete Shoot Action

### Button

"Complete" button in the bottom-right corner. Prominent, `accent` fill, `bodyMedium` weight. Right-aligned with forward chevron icon to suggest progression.

### Behavior

1. If unchecked shot list items remain, show a confirmation: "You have {X} unchecked shots. Complete anyway?" with "Yes, Complete" and "Go Back" options. This catches accidental taps and forgotten rooms.
2. On confirm, transition booking from `shooting` to `editing`. Writes `shooting.completedAt`.
3. Exit field mode. Return to the route screen (if there are more stops today) or the booking detail screen.

### After Completion

The booking is now in `editing` status. The photographer heads to their next stop (if any) or returns home/office to begin editing and uploading via the web companion. See `14_Web_Companion.md`.

## Shot List Data

### Source and Lifecycle

1. **At booking creation:** `booking-create` Cloud Function copies `shotListTemplate` from the selected package, transforming each string into `{ label, isCompleted: false, completedAt: null }`. See `03_Cloud_Functions.md`.
2. **Pre-shoot:** Photographer optionally edits the list on the booking detail screen (add, remove, reorder, rename).
3. **During shoot:** Photographer checks items off in field mode. Adds ad-hoc shots if needed.
4. **Post-shoot:** Shot list is frozen. Serves as a record of what was captured.

### No Template? No Problem

If the selected package has no `shotListTemplate`, the booking starts with an empty shot list. The photographer can:
- Add items manually before or during the shoot
- Shoot without a list entirely (field mode still shows access codes and property info, just no checklist)

## Field Mode Navigation

### Exiting Without Completing

If the photographer needs to leave field mode without completing (e.g., to check a different booking, take a phone call), they tap the back arrow in the top-left corner. The booking remains in `shooting` status. Shot list progress is preserved (already written to Firestore). They can re-enter field mode by tapping the booking card again.

### Next Stop Shortcut

If the photographer entered field mode from the route screen and there are subsequent stops, the "Complete" action shows a "Navigate to Next Stop" option after completion. This opens the native maps app with directions to the next property. See `12_Route_Optimization.md` for navigation handoff.

## Offline Behavior in Field Mode

Field mode is the most offline-critical part of the app.

| Action | Works Offline | Notes |
|--------|--------------|-------|
| View property details | Yes | Tier 1 cached data |
| View access code | Yes | Cached on booking document |
| View shot list | Yes | Cached on booking document |
| Check/uncheck shots | Yes | Allowed offline write, syncs later |
| Add new shot | Yes | Allowed offline write |
| Complete shoot (status change) | No | Status transitions require Cloud Function. Show message: "Go online to complete this shoot." |

The "Complete" button is the only action that requires connectivity. All other field mode interactions work fully offline. If the photographer is in a dead zone, they check off their shots and complete the shoot when they return to their car or move to an area with signal.

**Design exception:** Although status changes are normally blocked offline (see `05_Offline_Strategy.md`), the `shooting` to `editing` transition is low-risk (no external notifications triggered, single writer). Consider allowing this as an offline write that syncs later. Implementation decision: default to online-required, evaluate during testing.

## Gaps & Assumptions

### Gaps

- **Photo count from camera** -- No integration with the phone's camera roll to auto-count photos taken during the shoot. The photographer manually tracks via the shot list. In-app photo capture is not supported for v1.
- **Timer or duration tracking** -- No visible timer showing how long the shoot has been in progress. `shooting.startedAt` and `shooting.completedAt` provide duration data after the fact, but no live clock in field mode.
- **Agent no-show** -- No dedicated flow for when the agent is not present or the property is inaccessible. The photographer would exit field mode and handle it outside the app (call the agent, cancel, or reschedule).

### Assumptions

- Shot lists have at most 30 items (cap from package template). Scrolling is manageable at this size.
- The photographer's phone is their primary field device. No tablet or secondary device support for v1.
- Screen brightness is managed by the photographer or the device's auto-brightness. The app does not control display brightness.
- Field mode does not suppress incoming calls, notifications, or other system interrupts. The photographer manages their device as usual.
- One-handed use is the design target but not a hard requirement. Two-handed interaction for typing (adding a shot) is acceptable.  
