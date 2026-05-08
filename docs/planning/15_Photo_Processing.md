▸ TodoWrite  
  ← result received  
▸ Extended thinking (878 chars)  
## Overview

When a photographer uploads edited JPEGs through the web companion, each file triggers a Cloud Functions pipeline that generates a watermarked copy for proofing and a thumbnail for gallery display. MLS-ready exports are a separate step triggered at delivery time (see `17_Delivery_MLS_Export.md`). All image processing uses Sharp running in Cloud Functions with 1 GB memory allocation. The pipeline is fully automated -- no photographer intervention between upload and gallery-ready.

## Dependencies

- `02_Database_Schema.md` -- `photos` subcollection document shape, `processingStatus` field
- `03_Cloud_Functions.md` -- `media-onUpload` Storage trigger, `media-generateMlsExport` callable
- `14_Web_Companion.md` -- Upload source, file validation, progress display
- `16_Proofing_Gallery.md` -- Consumes watermarked images and thumbnails
- `17_Delivery_MLS_Export.md` -- Consumes original images for final export

## Cloud Storage Structure

```
shotready-001.firebasestorage.app/
├── uploads/
│   └── {photographerId}/
│       └── {bookingId}/
│           ├── IMG_001.jpg          ← Original upload
│           ├── IMG_002.jpg
│           └── ...
├── processed/
│   └── {bookingId}/
│       ├── thumb_IMG_001.jpg        ← Thumbnail
│       ├── thumb_IMG_002.jpg
│       ├── wm_IMG_001.jpg           ← Watermarked
│       ├── wm_IMG_002.jpg
│       ├── mls_IMG_001.jpg          ← MLS export (generated at delivery)
│       ├── mls_IMG_002.jpg
│       └── ...
└── branding/
    └── {photographerId}/
        └── logo.png                 ← Photographer logo (uploaded during onboarding)
```

### Path Conventions

- Originals live under `uploads/{photographerId}/{bookingId}/` for security rule scoping by photographer UID
- Processed files live under `processed/{bookingId}/` with prefixed filenames (`thumb_`, `wm_`, `mls_`)
- Filenames are preserved from the original upload. If duplicates occur, the web companion handles renaming before upload (see `14_Web_Companion.md`)

## Processing Pipeline

### Trigger

Firebase Cloud Storage `onObjectFinalized` trigger on the `uploads/{photographerId}/{bookingId}/{filename}` path. Fires once per uploaded file.

### Pipeline Steps

For each uploaded file:

**1. Validate**

| Check | Action on Failure |
|-------|------------------|
| File is JPEG (check magic bytes, not just extension) | Delete the upload, set photo doc `processingStatus: "error"` |
| File size under 30 MB | Delete the upload, set photo doc `processingStatus: "error"` |
| Booking exists and is in `editing` status | Delete the upload, log warning |

**2. Read Metadata**

Using Sharp, extract:
- Width and height (pixels)
- File size (bytes, from Storage metadata)
- EXIF orientation (auto-rotate if needed)

**3. Generate Thumbnail**

| Parameter | Value |
|-----------|-------|
| Width | 400px |
| Height | proportional (maintain aspect ratio) |
| Format | JPEG |
| Quality | 80% |
| Auto-rotate | Yes (apply EXIF orientation) |
| Strip metadata | Yes (EXIF not needed on thumbnails) |

Write to `processed/{bookingId}/thumb_{filename}`.

**4. Generate Watermarked Copy**

| Parameter | Value |
|-----------|-------|
| Max dimension | 1600px on the long edge |
| Format | JPEG |
| Quality | 85% |
| Auto-rotate | Yes |
| Strip metadata | Yes |

The watermarked copy is a downsized version of the original with a text watermark overlay. It is large enough for agents to evaluate composition and quality but not large enough for print or MLS use.

**5. Update Photo Document**

Write or update the document in `bookings/{bookingId}/photos`:

| Field | Value |
|-------|-------|
| `filename` | Original filename |
| `storagePath` | `uploads/{photographerId}/{bookingId}/{filename}` |
| `watermarkedPath` | `processed/{bookingId}/wm_{filename}` |
| `thumbnailPath` | `processed/{bookingId}/thumb_{filename}` |
| `width` | Original width in pixels |
| `height` | Original height in pixels |
| `fileSize` | Original file size in bytes |
| `sortOrder` | Count of existing photos in subcollection (append to end) |
| `isSelected` | `true` (default: all selected, agent deselects unwanted) |
| `processingStatus` | `"ready"` |
| `uploadedAt` | From Storage metadata or current timestamp |
| `processedAt` | Current timestamp |

## Watermark Specification

### Text Watermark

The watermark is the photographer's business name rendered as semi-transparent text across the image.

| Parameter | Value |
|-----------|-------|
| Text | `photographers/{uid}.businessName` |
| Font | Sans-serif system font (Sharp uses built-in text rendering) |
| Size | Scaled to approximately 3% of image height |
| Color | White with 40% opacity |
| Rotation | -30 degrees (diagonal, bottom-left to top-right) |
| Repetition | Tiled across the image with ~200px spacing between instances |
| Position | Centered pattern covering the full image |

### Why Tiled

A single centered watermark can be cropped out. A tiled diagonal pattern across the entire image prevents unauthorized use while remaining unobtrusive enough for agents to evaluate the photo. The semi-transparent white works on both light and dark image regions.

### Implementation with Sharp

Sharp does not have native text rendering. The watermark is generated as a separate SVG overlay composited onto the image:

1. Create an SVG with the tiled text pattern at the target image dimensions
2. Use Sharp's `composite` method to overlay the SVG onto the resized image
3. The SVG is generated once per business name and cached in memory for the duration of the Cloud Function invocation (all photos in a batch reuse it)

## Error Handling

| Failure | Behavior |
|---------|----------|
| Sharp processing fails | Set `processingStatus: "error"` on the photo document. Original upload preserved. Photographer sees error in web companion and can retry (re-upload). |
| Cloud Storage write fails | Retry up to 3 times with exponential backoff. If still fails, set `processingStatus: "error"`. |
| Booking not found | Delete the uploaded file. Log error. This should not happen under normal operation. |
| Out of memory | Cloud Function crashes and auto-retries (Firebase default). The 1 GB allocation handles images up to ~30 MB comfortably. |

### Idempotency

The Storage trigger may fire more than once for the same upload (Firebase at-least-once delivery). The function must be idempotent:

- Check if a photo document with this filename already exists with `processingStatus: "ready"`. If so, skip processing.
- Use `set` with merge rather than `create` when writing the photo document, so re-processing overwrites rather than duplicates.

## Photo Deletion

When a photographer deletes a photo from the web companion or mobile app:

1. Delete the photo document from `bookings/{bookingId}/photos`
2. Delete all associated files from Cloud Storage:
   - `uploads/{photographerId}/{bookingId}/{filename}`
   - `processed/{bookingId}/thumb_{filename}`
   - `processed/{bookingId}/wm_{filename}`
   - `processed/{bookingId}/mls_{filename}` (if exists)

Deletion is handled by a Firestore `onDelete` trigger on the photos subcollection, ensuring Storage cleanup happens automatically.

## Photo Retention

Photos are retained for 90 days after delivery (`delivery.deliveredAt` + 90 days). After that, a scheduled Cloud Function runs daily and:

1. Queries bookings where `delivery.deliveredAt` is older than 90 days and `status` is `closed`
2. For each expired booking, deletes all files under `uploads/{photographerId}/{bookingId}/` and `processed/{bookingId}/`
3. Deletes all photo documents from the subcollection
4. Optionally marks the booking with a `photosExpired: true` flag

**Agent communication:** The agent-facing download page shows "Photos are available for 90 days after delivery" from the start. After expiration, the download link shows "Photos are no longer available for download. Contact your photographer for re-delivery." See `10_Booking_State_Machine.md` for the `closed` state agent view.

## Performance and Cost

### Processing Time

| Operation | Estimated Time |
|-----------|---------------|
| Read + validate | < 1 second |
| Generate thumbnail | 1-3 seconds |
| Generate watermarked copy | 2-5 seconds |
| Write to Storage | 1-2 seconds |
| Update Firestore | < 1 second |
| **Total per photo** | **5-12 seconds** |

A 30-photo batch completes in roughly 2-5 minutes (photos process in parallel as separate function invocations).

### Cloud Function Configuration

| Setting | Value |
|---------|-------|
| Memory | 1 GB |
| Timeout | 120 seconds |
| Max instances | 30 (one per photo, limits concurrent processing) |
| Min instances | 0 |

### Storage Cost Estimates

Per shoot (30 photos, average 5 MB original):

| Variant | Size per Photo | Total |
|---------|---------------|-------|
| Original | 5 MB | 150 MB |
| Watermarked | ~800 KB | 24 MB |
| Thumbnail | ~40 KB | 1.2 MB |
| MLS export | ~1.5 MB | 45 MB |
| **Per shoot total** | | **~220 MB** |

At 20 shoots/month retained for 90 days: ~60 shoots stored = ~13 GB. Firebase Storage cost at $0.026/GB/month = ~$0.35/month. Well within the $50/month budget.

## Gaps & Assumptions

### Gaps

- **Image orientation edge cases** -- Some cameras/editors produce images with non-standard EXIF orientation. Sharp's `rotate()` with no arguments auto-rotates based on EXIF. This handles most cases, but images with stripped EXIF that are physically rotated will appear wrong. No manual rotation tool for v1.
- **Watermark customization** -- Photographers may want to use their logo as a watermark instead of text, or customize opacity/size. Default: text-only watermark with business name for v1. Logo watermark deferred.
- **Color profile handling** -- Lightroom exports may include embedded ICC profiles (sRGB, Adobe RGB). Sharp preserves the profile by default during resize. No color space conversion for v1 -- assume sRGB is standard for web delivery.

### Assumptions

- All uploads are Lightroom-exported JPEGs. No RAW, PNG, TIFF, or HEIC support for v1.
- Sharp is available in the Cloud Functions Node.js runtime without additional system dependencies.
- 1 GB Cloud Function memory is sufficient for processing images up to 30 MB. Sharp's streaming pipeline keeps memory usage well below the image file size.
- The 30 max instances limit prevents a large batch upload from exhausting the Cloud Functions quota or creating a cost spike. At 30 concurrent invocations with 1 GB each, peak memory usage is 30 GB -- within default Cloud Functions limits.
- The 90-day retention period starts from `delivery.deliveredAt`, not from upload or booking creation. Photos for bookings that never reach delivery are retained indefinitely until the booking is manually closed or cancelled.  
