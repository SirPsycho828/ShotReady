▸ TodoWrite  
  ← result received  
▸ Extended thinking (1063 chars)  
## Overview

The proofing gallery is an agent-facing web page where agents view watermarked photos, select their favorites, and submit their choices. It renders at the booking's evolving URL (`/b/{agentToken}`) when the booking status is `proofing`. The gallery must be dead simple for low-tech agents: open the link, see the photos, tap to select or deselect, and hit "Done." All selections auto-save so the agent never loses progress. No account, no login, no prior knowledge of ShotReady required.

## Dependencies

- `01_Auth.md` -- Agent token validation, no account required
- `02_Database_Schema.md` -- `photos` subcollection (`isSelected`, `watermarkedPath`, `thumbnailPath`), booking `proofing` fields
- `03_Cloud_Functions.md` -- `booking-getByToken` returns gallery data, `booking-submitSelections` processes final selections
- `04_UI_Design_System.md` -- Photo card selection states, agent-facing light mode
- `15_Photo_Processing.md` -- Watermarked and thumbnail image URLs
- `20_Agent_Web_Shell.md` -- Page shell, photographer branding, responsive layout

## Page Structure

The gallery renders inside the agent web shell (see `20_Agent_Web_Shell.md`) with the photographer's logo and accent color. Light mode only.

```
┌──────────────────────────────────────────────┐
│  [Photographer Logo]                         │
│  Photos for 123 Oak St                       │
│──────────────────────────────────────────────│
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Tap photos to select your favorites.  │  │
│  │  Or approve all to keep everything.    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Select All]  [Deselect All]    18 selected │
│                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │  [✓]   │ │  [✓]   │ │  [✓]   │           │
│  │        │ │        │ │        │           │
│  │  img   │ │  img   │ │  img   │           │
│  │        │ │        │ │        │           │
│  └────────┘ └────────┘ └────────┘           │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │  [ ]   │ │  [✓]   │ │  [✓]   │           │
│  │        │ │        │ │        │           │
│  │  img   │ │  img   │ │  img   │           │
│  │        │ │        │ │        │           │
│  └────────┘ └────────┘ └────────┘           │
│  ...                                         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │      Approve 18 Selected Photos  →     │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

## Instruction Banner

On first load, a brief instruction banner appears above the photo grid:

> Tap photos to select your favorites. Or approve all to keep everything.

The banner uses a soft `info` background tint with `textPrimary` text. It remains visible until the agent interacts with the gallery (taps a photo or a bulk action). After first interaction, it collapses to save space. Does not reappear on subsequent visits.

## Photo Grid

### Layout

Responsive grid of watermarked photo thumbnails:
- **Mobile (< 640px):** 2 columns
- **Tablet (640-1024px):** 3 columns
- **Desktop (> 1024px):** 4 columns

Grid gap: 8px. Photos maintain their original aspect ratio (no square cropping). Lazy loading for images below the fold.

### Photo Cells

Each cell displays:

| Element | Details |
|---------|---------|
| Thumbnail image | From `thumbnailPath`. On tap anywhere on the image, toggles selection |
| Selection checkbox | Top-right corner, 32x32px visual, semi-transparent dark overlay behind for contrast |
| Expand icon | Bottom-right corner, small magnifying glass icon. Opens lightbox |

### Selection States

**Selected (default):**
- Checkbox filled with photographer's accent color, white checkmark
- Subtle accent border (3px) around the photo
- No opacity change -- the photo remains fully visible

**Deselected:**
- Empty checkbox outline, white border
- Photo dims to 60% opacity
- This visual distinction makes it immediately obvious which photos are excluded

### Default: All Selected

When the gallery first loads, every photo is selected (`isSelected: true` is the default set during processing). This means the agent's simplest path is to approve everything without touching a single photo. Only agents who want to exclude specific shots need to interact with individual photos.

## Bulk Actions

Above the photo grid, two action buttons and a counter:

- **"Select All"** -- Sets all photos to selected. Useful if the agent deselected several and wants to start over.
- **"Deselect All"** -- Sets all photos to deselected. Useful if the agent wants to pick only a handful of favorites rather than exclude rejects.
- **Selection counter** -- "{X} of {Y} selected" right-aligned. Updates in real time as selections change.

## Lightbox

Tapping the expand icon (magnifying glass) on any photo opens a full-screen lightbox overlay showing the watermarked image at its full 1600px resolution (from `watermarkedPath`).

### Lightbox Features

| Feature | Behavior |
|---------|----------|
| Navigation | Left/right arrows or swipe to move between photos |
| Selection toggle | Checkbox in the top-right corner, same as grid view. Agent can select/deselect from lightbox |
| Close | X button in top-left corner, or tap outside the image, or press Escape |
| Counter | "{current} / {total}" in the top center |
| Zoom | Pinch-to-zoom on mobile, scroll-to-zoom on desktop. Allows inspecting detail even through the watermark |

The lightbox does not show photo filenames or metadata. The agent sees only the image and selection controls.

## Auto-Save

**Every selection change saves immediately.** When the agent taps a photo to select or deselect it, the change is written to the photo document's `isSelected` field via a Cloud Function call. No "save" button, no batch update.

This means:
- If the agent closes the browser tab mid-selection, their progress is preserved
- If they reopen the link later, all previous selections are intact
- No risk of lost work from accidental tab closure, phone calls, or browser crashes

### Implementation

Each selection toggle calls a lightweight Cloud Function that validates the agent token and updates the single photo document's `isSelected` field. Debounce rapid toggles: batch selection changes within a 500ms window into a single Cloud Function call.

### First View Tracking

When the gallery page loads and the booking's `proofing.viewedAt` is null, write the current timestamp. This lets the photographer see "Agent viewed proofing gallery" on their booking detail screen.

## Approve Button

Fixed to the bottom of the viewport (sticky footer) so it is always visible as the agent scrolls through photos.

### Button States

| State | Label | Behavior |
|-------|-------|----------|
| Photos selected | "Approve {X} Selected Photos" | Active, accent color fill |
| No photos selected | "Select at least one photo" | Disabled, gray |
| Already submitted | "Selections Submitted" | Disabled, success color, checkmark icon |

### Submission Flow

1. Agent taps "Approve {X} Selected Photos"
2. Confirmation dialog: "You've selected {X} of {Y} photos. Your photographer will prepare these for delivery. This cannot be undone."
3. On confirm, calls `booking-submitSelections` Cloud Function with the agent token and array of selected photo IDs
4. Cloud Function validates token, writes `proofing.completedAt`, `proofing.selectedCount`, and `proofing.approvedAll` (true if all photos selected)
5. Button changes to "Selections Submitted" with checkmark
6. Gallery becomes read-only (selections are locked, checkboxes no longer interactive)
7. Page content updates to a confirmation message below the gallery

### Post-Submission Confirmation

After the agent submits, a success banner replaces the instruction area:

> Your selections have been submitted! Your photographer will prepare your final photos and send them to you at {agent email}.

The gallery remains visible below (read-only) so the agent can review what they chose.

## Revisiting After Submission

If the agent returns to the same URL after submitting:
- Gallery displays in read-only mode with their final selections visible
- The approve button shows "Selections Submitted"
- No further changes are possible
- Once the booking advances to `delivered`, the same URL shows the download page instead. See `10_Booking_State_Machine.md`

## Photographer-Side Proofing Status

On the photographer's mobile app, the booking detail screen for a `proofing` status booking shows:

| Info | Source |
|------|--------|
| "Proofing link sent" with timestamp | `proofing.sentAt` |
| "Agent viewed gallery" with timestamp (or "Not yet viewed") | `proofing.viewedAt` |
| "Agent selected {X} of {Y} photos" (or "Selections pending") | `proofing.selectedCount` or subcollection count |

Real-time Firestore listener updates this view. When the agent completes selections, the photographer receives a push notification: "Agent completed photo selections for 123 Oak St." See `19_Notifications.md`.

## Performance

### Image Loading

- Thumbnails (400px wide, ~40 KB each) load in the grid. Fast even on slow connections.
- Watermarked full-size images (1600px, ~800 KB each) load only in the lightbox, on demand.
- Lazy loading: only thumbnails in the viewport and one screen-height ahead are fetched. Remaining load on scroll.
- Image URLs are signed Firebase Cloud Storage URLs generated by the `booking-getByToken` Cloud Function with 24-hour expiration. The page refreshes URLs if the agent keeps the tab open beyond expiration.

### Page Load

Gallery data is fetched via a single `booking-getByToken` Cloud Function call that returns:
- Booking metadata (property address, photographer name/logo/accent color)
- Array of photo objects with thumbnail and watermarked URLs, selection state, and sort order

No direct Firestore access from the agent's browser. All data mediated through Cloud Functions.

## Accessibility

Per User Red Team Issue #19, the gallery should meet WCAG 2.1 AA:

- Selection state does not rely solely on color (checkmark icon + border + opacity change)
- All interactive elements are keyboard accessible (Tab to navigate, Enter/Space to toggle)
- Lightbox supports keyboard navigation (arrow keys, Escape to close)
- Alt text on images: "Photo {number} of {total} for {property address}"
- Minimum contrast ratios met for all text and interactive elements

## Gaps & Assumptions

### Gaps

- **Revision requests** -- No mechanism for agents to request re-edits or flag specific photos for changes. The agent can only select or deselect. Revision communication happens outside the app for v1. See `21_Future_Features.md`.
- **Photo annotations** -- Agents cannot add comments to individual photos ("crop this tighter", "too dark"). Deferred to post-MVP.
- **Download from proofing** -- Agents cannot download watermarked proofs. The download link only appears after delivery with unwatermarked finals. This is intentional -- prevents agents from using watermarked images.

### Assumptions

- 25-50 photos is the typical gallery size. The grid layout and lazy loading handle this comfortably. If a luxury shoot has 100+ photos, performance is still acceptable with lazy loading.
- Agents complete proofing in a single session or across a few brief sessions. The auto-save and URL persistence support both patterns.
- One submission per booking. The agent cannot revise their selections after clicking "Approve." If they need changes, they contact the photographer, who can manually adjust `isSelected` flags and re-open proofing by reverting the `proofing.completedAt` field.
- The 500ms debounce on selection saves is sufficient. An agent rapidly tapping 10 photos in 2 seconds results in 2-3 Cloud Function calls rather than 10.  
