▸ TodoWrite  
  ← result received  
▸ Extended thinking (1339 chars)  
## Overview

Delivery is the moment the agent receives their final, unwatermarked, MLS-ready photos. When the photographer triggers delivery, a Cloud Function processes the selected photos into MLS-compliant exports (resized to the photographer's configured MLS dimensions, metadata stripped), bundles them into a downloadable ZIP, and sends the agent an email with a download link. The same evolving booking URL transitions from showing the proofing gallery to showing the download page. An invoice draft is auto-created at delivery time. See `18_Invoicing_Payments.md`.

## Dependencies

- `02_Database_Schema.md` -- `photographers.mlsConfig`, `bookings.delivery` fields, `photos` subcollection
- `03_Cloud_Functions.md` -- `media-generateMlsExport`, `media-generateDownloadUrl`, `booking-updateStatus`
- `10_Booking_State_Machine.md` -- `proofing` to `delivered` transition and side effects
- `15_Photo_Processing.md` -- Original uploads used as source for MLS export, storage paths
- `16_Proofing_Gallery.md` -- Agent's photo selections determine which photos are delivered
- `20_Agent_Web_Shell.md` -- Download page layout at the evolving URL

## MLS Configuration

### Photographer Setup

MLS export settings are configured once by the photographer (during the contextual prompt at first delivery, or in Settings). Stored on `photographers/{uid}.mlsConfig`. See `06_Photographer_Onboarding.md` for the contextual prompt.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `name` | string | `null` | MLS board name, e.g., "CRMLS". For display only |
| `maxWidth` | number | 2048 | Pixels. Long edge maximum |
| `maxHeight` | number | 1536 | Pixels. Short edge maximum |
| `maxFileSize` | number | 5242880 | Bytes (5 MB). Target max per photo |

### MLS Presets

The configuration form offers a dropdown of common MLS presets for quick setup:

| Preset Name | Max Width | Max Height | Max File Size |
|-------------|-----------|------------|---------------|
| CRMLS (California) | 2048 | 1536 | 5 MB |
| Bright MLS (Mid-Atlantic) | 2000 | 1500 | 10 MB |
| MLS PIN (Midwest) | 1600 | 1200 | 3 MB |
| Stellar MLS (Florida) | 2048 | 1536 | 5 MB |
| Custom | User-defined | User-defined | User-defined |

Selecting a preset fills the fields. The photographer can adjust individual values after preset selection. "Custom" starts with the defaults.

### No MLS Config

If the photographer has not configured MLS settings (field is `null`), delivery uses the defaults: 2048x1536, 5 MB max. A note on the delivery confirmation screen reminds them: "Using default MLS settings. Configure your local MLS requirements in Settings for best results."

## Delivery Flow

### Photographer Triggers Delivery

From the mobile app, on a booking in `proofing` status where the agent has completed selections:

1. Photographer opens the booking detail screen
2. Screen shows: "Agent selected {X} of {Y} photos"
3. Photographer taps "Deliver Finals"
4. Confirmation dialog: "Deliver {X} photos to {Agent Name}? This will also generate an invoice draft."
5. On confirm, calls `booking-updateStatus` to transition from `proofing` to `delivered`

### Server-Side Processing

The `proofing` to `delivered` transition triggers these side effects in the Cloud Function:

**Step 1: Generate MLS Exports**

For each photo in the `photos` subcollection where `isSelected == true`:

1. Read the original upload from `uploads/{photographerId}/{bookingId}/{filename}`
2. Process with Sharp:
   - Resize to fit within `mlsConfig.maxWidth` x `mlsConfig.maxHeight` (maintain aspect ratio, only downscale -- never upscale)
   - Auto-rotate based on EXIF orientation
   - Strip all EXIF metadata except:
     - Copyright (set to photographer's business name)
     - Software (set to "ShotReady")
   - Compress as JPEG, targeting `mlsConfig.maxFileSize`. Start at 92% quality, reduce in 5% steps until file size is under the limit (minimum quality: 70%)
3. Write to `processed/{bookingId}/mls_{filename}`

**Step 2: Generate Download Package**

After all MLS exports are generated:

1. Create a ZIP file containing all MLS-ready images
2. Name the ZIP: `{property-address-slugified}_photos.zip` (e.g., `123-oak-st_photos.zip`)
3. Upload the ZIP to `processed/{bookingId}/delivery.zip`
4. Generate a signed download URL with 7-day expiration
5. Write the URL to `bookings/{id}.delivery.downloadToken`

**Step 3: Update Booking**

- Set `delivery.deliveredAt` to current timestamp
- Set booking status to `delivered`

**Step 4: Auto-Create Invoice Draft**

- Create an invoice document in the `invoices` collection with status `draft`
- Copy line items from the booking's package snapshot
- See `18_Invoicing_Payments.md` for invoice details

**Step 5: Notify Agent**

- Send delivery email via SendGrid with the download link
- See `19_Notifications.md` for email content

## Agent Download Page

When the agent visits their booking URL (`/b/{agentToken}`) after delivery, the page shows the download experience instead of the proofing gallery.

### Layout

```
┌──────────────────────────────────────────────┐
│  [Photographer Logo]                         │
│  Your photos are ready!                      │
│──────────────────────────────────────────────│
│                                              │
│  123 Oak St · 18 photos                      │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │   📥  Download All Photos (42 MB)      │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Photos available for 90 days                │
│  (until August 6, 2026)                      │
│                                              │
│  ── PREVIEW ──────────────────────────────── │
│                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │  img   │ │  img   │ │  img   │           │
│  └────────┘ └────────┘ └────────┘           │
│  ...                                         │
│                                              │
└──────────────────────────────────────────────┘
```

### Download Button

Prominent, full-width, photographer's accent color. Shows total file size so the agent knows what to expect. Tapping it downloads the ZIP directly via the signed URL.

### Photo Preview Grid

Below the download button, a grid of thumbnail previews (same layout as the proofing gallery) showing the delivered photos. These are still the watermarked thumbnails -- the unwatermarked MLS-ready files are only in the ZIP download. This preview lets the agent confirm the right photos were delivered without downloading first.

### Retention Notice

Below the download button: "Photos available for 90 days (until {date})." The date is calculated from `delivery.deliveredAt` + 90 days. After expiration, the page shows: "Photos are no longer available for download. Contact your photographer for re-delivery."

### Download Link Expiration and Refresh

The signed URL expires after 7 days. If the agent returns after 7 days but within the 90-day retention window, the page auto-generates a fresh signed URL via the `media-generateDownloadUrl` Cloud Function.

## Individual Photo Downloads

In addition to the ZIP download, the preview grid allows downloading individual photos. Each thumbnail in the delivery preview has a small download icon overlay. Tapping it generates a signed URL for that single MLS-ready file and triggers the browser download.

This is useful when agents need one or two specific photos (e.g., for a social media post) without downloading the full package.

## Photographer Delivery Screen

On the mobile app, after delivery is triggered, the booking detail screen for `delivered` status shows:

| Element | Content |
|---------|---------|
| Status | "Delivered" with timestamp |
| Photo count | "{X} photos delivered" |
| Download link status | "Agent download link active (expires {date})" |
| Invoice section | Draft invoice preview with line items. See `18_Invoicing_Payments.md` |
| Primary action | "Send Invoice" button |

The photographer reviews the auto-generated invoice draft, adjusts line items if needed, then sends. See `18_Invoicing_Payments.md`.

## Processing Performance

### Time Estimates

| Operation | Per Photo | 20-Photo Batch |
|-----------|-----------|---------------|
| Read original from Storage | < 1s | -- |
| Resize + strip metadata | 2-4s | -- |
| Quality iteration (if over file size limit) | 1-3s (0-3 iterations) | -- |
| Write MLS export to Storage | 1-2s | -- |
| **Subtotal per photo** | **4-10s** | -- |
| ZIP generation | -- | 10-30s |
| **Total** | | **1.5-4 min** |

### Cloud Function Configuration

MLS export processing reuses the `media` function group configuration from `15_Photo_Processing.md`:
- Memory: 1 GB
- Timeout: 540 seconds (maximum, needed for ZIP generation of large batches)
- The export function processes photos sequentially within a single invocation (unlike upload processing which runs parallel per photo) to manage memory usage during ZIP creation

### ZIP Size Limits

50 selected photos at ~1.5 MB MLS export each = ~75 MB ZIP. Well within Cloud Functions' memory and response limits. For edge cases with 100+ photos at maximum file size, the ZIP could reach 500 MB. See Gaps section.

## Gaps & Assumptions

### Gaps

- **ZIP generation for very large shoots** -- 100 photos at 5 MB each would produce a ~500 MB ZIP. Cloud Functions has a 2 GB memory limit, so this is technically possible but slow. If processing exceeds the 540s timeout, the function fails. Mitigation for post-MVP: split into multiple ZIPs or generate the ZIP asynchronously and email the link when ready.
- **Social media crop exports** -- Agents may want social-media-optimized crops (1:1 for Instagram, 16:9 for Facebook cover). Not supported for v1. Agents crop manually from the delivered files.
- **Re-delivery** -- If the photographer uploaded wrong photos or the agent requests changes, there is no "undo delivery" action. The photographer would need to revert the booking status manually (not supported in the state machine for v1). Workaround: manually update photos in Storage and regenerate the download ZIP.
- **MLS preset accuracy** -- The preset values are approximations. MLS requirements change periodically. The photographer should verify against their actual board requirements.

### Assumptions

- MLS exports are generated from the original uploaded files, not from the watermarked copies. This ensures maximum quality in the final deliverable.
- JPEG quality iteration (92% down to 70% in 5% steps) produces files under the MLS size limit for typical real estate photos. Extremely high-resolution originals may require more iterations.
- The ZIP filename uses a slugified property address. Special characters and long addresses are truncated to keep filenames filesystem-friendly (max 100 characters).
- Agents download photos on desktop or tablet browsers. The ZIP file size is reasonable for these platforms. Phone downloads of large ZIPs may be problematic, but agents typically handle files on desktop.
- The 7-day signed URL expiration with auto-refresh on revisit means the agent always has a working download link within the 90-day retention window. No manual link management needed by the photographer.  
