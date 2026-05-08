▸ TodoWrite  
  ← result received  
▸ Extended thinking (1064 chars)  
## Overview

The web companion is a browser-based desktop interface where photographers upload edited photos from Lightroom to a specific booking. It exists because bulk photo upload from a desktop is far more practical than transferring files to a phone. The web companion is a lightweight React app -- not a full mirror of the mobile app. It shows only bookings in `editing` status (ready for uploads), handles batch uploads with per-file progress, and lets the photographer trigger proofing once uploads are processed. Authentication uses the same Firebase Auth credentials as the mobile app.

## Dependencies

- `01_Auth.md` -- Same Firebase Auth email/password, `SESSION` persistence default
- `02_Database_Schema.md` -- `bookings` collection (status, property address, agent), `photos` subcollection
- `03_Cloud_Functions.md` -- `media-onUpload` Storage trigger processes each uploaded file
- `15_Photo_Processing.md` -- Watermarking, thumbnail generation triggered by upload
- `10_Booking_State_Machine.md` -- Web companion operates on bookings in `editing` status

## Access

**URL:** `https://{domain}/upload` (or `/companion`)

Photographer-only. Requires Firebase Auth sign-in. Agent-facing pages use a different URL pattern (`/book/{slug}` and `/b/{token}`). No navigation between the two.

## Authentication

Direct email/password sign-in on the web companion. Same Firebase Auth account as the mobile app. See `01_Auth.md` for details.

- Default persistence: `SESSION` (cleared when tab closes)
- "Keep me signed in" checkbox: switches to `LOCAL` persistence
- Sign-in screen: minimal -- email input, password input, sign-in button, "Keep me signed in" checkbox. No registration (photographer registers on mobile app first)
- If sign-in fails: standard Firebase Auth error messages ("Invalid email or password", "Too many attempts")

## Post-Login: Booking Selector

After sign-in, the photographer sees a list of bookings in `editing` status -- these are the jobs ready for photo uploads.

### Layout

```
┌────────────────────────────────────────────────┐
│  ShotReady Upload          {photographer name} │
│────────────────────────────────────────────────│
│                                                │
│  Select a booking to upload photos:            │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  123 Oak St · Agent Smith · May 8        │  │
│  │  Standard Listing · 0 photos uploaded    │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  456 Elm Ave · Agent Jones · May 10      │  │
│  │  Premium Package · 12 photos uploaded    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Only bookings ready for editing are shown.    │
│                                                │
└────────────────────────────────────────────────┘
```

### Booking Card Content

| Element | Source |
|---------|--------|
| Property address (street) | `bookings.property.address` |
| Agent name | `bookings.agent.name` |
| Shoot date | `bookings.schedule.confirmedDate` |
| Package name | `bookings.package.name` |
| Upload count | Count of documents in `bookings/{id}/photos` subcollection |

### Query

`bookings` where `photographerId == uid` and `status == "editing"`, ordered by `schedule.confirmedDate` descending. Real-time listener for live updates.

**Empty state:** "No bookings are ready for uploads. Complete a shoot in the mobile app to start editing." The photographer must advance a booking to `editing` status from the mobile app before it appears here.

## Upload Screen

Clicking a booking card opens the upload interface for that specific booking.

### Layout

```
┌────────────────────────────────────────────────┐
│  ← Back    123 Oak St · Agent Smith            │
│────────────────────────────────────────────────│
│                                                │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │                                         │  │
│  │   Drag photos here or click to browse   │  │
│  │                                         │  │
│  │         JPEG files, max 30 MB each      │  │
│  │                                         │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                │
│  UPLOADED (12)                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │thumb │ │thumb │ │thumb │ │thumb │          │
│  │ ✓    │ │ ✓    │ │ ✓    │ │ ⟳    │          │
│  │name  │ │name  │ │name  │ │name  │          │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│  ┌──────┐ ┌──────┐ ...                        │
│  │thumb │ │thumb │                             │
│  └──────┘ └──────┘                             │
│                                                │
│            [Send to Proofing →]                │
│                                                │
└────────────────────────────────────────────────┘
```

## Upload Behavior

### File Selection

Two input methods:
- **Drag and drop** onto the drop zone
- **Click to browse** opens the system file picker (multi-select enabled)

### File Validation (Client-Side)

| Check | Rule | Error Message |
|-------|------|--------------|
| File type | JPEG only (`.jpg`, `.jpeg`) | "Only JPEG files are supported" |
| File size | Max 30 MB per file | "{filename} exceeds the 30 MB limit" |
| Batch size | Max 100 files per upload action | "Maximum 100 files at a time" |

Validation happens before upload begins. Invalid files are rejected with inline error messages. Valid files proceed.

### Upload Process

Files upload to Firebase Cloud Storage at path `uploads/{photographerId}/{bookingId}/{filename}`. Each file uploads independently and in parallel (up to 3 concurrent uploads to avoid browser throttling).

**Per-file progress:**

| State | Visual |
|-------|--------|
| Queued | Gray overlay on thumbnail, "Waiting..." |
| Uploading | Blue progress bar overlay, percentage text |
| Processing | Spinner overlay, "Processing..." (server-side watermark/thumbnail generation) |
| Ready | Green checkmark badge, thumbnail from processed version |
| Error | Red exclamation badge, "Retry" button |

### Retry on Failure

If an upload fails (network error, timeout):
- The file shows an error state with a "Retry" button
- Tapping retry re-uploads that single file
- No automatic retry -- manual only, so the photographer is aware of failures
- Failed files do not block other uploads

### Duplicate Detection

Before uploading, check if a photo document with the same `filename` already exists in the booking's `photos` subcollection. If it does:
- Show a warning: "{filename} already uploaded. Replace?"
- "Replace" overwrites the existing file in Cloud Storage and re-triggers processing
- "Skip" leaves the existing file untouched

## Uploaded Photos Grid

Below the drop zone, a grid displays all photos already uploaded to this booking.

### Grid Layout

Responsive grid: 4 columns on desktop (>1200px), 3 columns on tablet (768-1200px). Each cell shows:

- Thumbnail image (from processed thumbnail, or a loading placeholder if still processing)
- Filename below the thumbnail (truncated with ellipsis if long)
- Processing status badge (checkmark for ready, spinner for processing, exclamation for error)

### Photo Actions

Hover (or click on mobile) reveals:
- **Delete** -- removes the photo document and all associated files from Cloud Storage. Confirmation prompt: "Delete {filename}?" This is permanent.
- **Preview** -- opens the full watermarked image in a lightbox overlay

### Sort Order

Photos display in upload order (by `uploadedAt` timestamp). Drag-to-reorder for controlling gallery display order is not supported on the web companion for v1. The photographer can reorder in the proofing gallery management on the mobile app if needed. Default gallery order matches upload order.

## Send to Proofing

### Button

"Send to Proofing" button appears below the photo grid. Enabled only when:
- At least 1 photo has `processingStatus: "ready"`
- No photos are currently uploading or processing

If photos are still processing, the button shows as disabled: "Waiting for {X} photos to finish processing..."

### Behavior

Tapping "Send to Proofing":
1. Confirmation dialog: "Send {X} photos to {Agent Name} for review? They'll receive an email with a proofing link."
2. On confirm, calls `booking-updateStatus` to transition from `editing` to `proofing`
3. Cloud Function handles the transition: sets `proofing.sentAt`, sends proofing email to agent. See `03_Cloud_Functions.md`
4. The booking disappears from the web companion list (no longer in `editing` status)
5. Success message: "Photos sent to {Agent Name}! You'll be notified when they finish selecting."

### Partial Upload Warning

If the photographer has photos with error status when clicking "Send to Proofing", show a warning: "{X} photos failed to upload. Send the {Y} successful photos anyway, or retry the failed uploads first?" with "Send Anyway" and "Go Back" options.

## Processing Status Sync

After upload, the `media-onUpload` Cloud Function processes each photo (watermark, thumbnail). See `15_Photo_Processing.md`. The web companion uses a Firestore real-time listener on the `bookings/{id}/photos` subcollection to show processing status updates live. When a photo document's `processingStatus` changes from `"processing"` to `"ready"`, the thumbnail updates and the checkmark appears without page refresh.

## Browser Compatibility

The web companion targets modern desktop browsers:
- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

Mobile browser access is technically possible but not optimized. The drop zone works as a file picker on mobile, but the primary upload workflow is desktop Lightroom export to browser.

## Design

The web companion uses the same color tokens as the mobile app (see `04_UI_Design_System.md`) but rendered as CSS custom properties, not NativeWind. Dark mode is the default (matches the photographer's editing environment -- most photo editors use dark UIs). No light mode toggle for the web companion.

Typography and spacing follow the same scale from the design system, adapted to web CSS.

## Gaps & Assumptions

### Gaps

- **Upload resume after browser crash** -- If the browser closes mid-upload, partially uploaded files may be orphaned in Cloud Storage. No cleanup mechanism for v1. Orphaned files in the `uploads/` path consume storage but are not linked to photo documents.
- **Lightroom plugin** -- A direct Lightroom export plugin would eliminate the browser step entirely. Not in scope for v1. See `21_Future_Features.md`.
- **RAW file support** -- Only JPEG is accepted for v1. Some photographers may want to upload and store RAW files alongside. Deferred due to file size (40-80 MB each) and processing complexity.
- **Reorder photos** -- No drag-to-reorder in the web companion. Sort order is upload order. Reordering support could be added post-MVP.

### Assumptions

- Photographers export from Lightroom as optimized JPEGs (3-10 MB each). This is standard practice for real estate delivery.
- Desktop upload on a stable connection (home/office WiFi). No offline considerations for the web companion.
- 3 concurrent uploads is a safe default for browser performance. Adjustable if testing shows higher throughput is reliable.
- The `media-onUpload` Cloud Function processes each photo in under 30 seconds. The photographer sees thumbnails appear within a minute of uploading.
- The web companion is a simple React SPA. It does not use React Native for Web or share components with the mobile app. Shared code is limited to Firestore types and utility functions.  
