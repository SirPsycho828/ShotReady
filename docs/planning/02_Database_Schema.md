▸ Extended thinking (3056 chars)  
## Overview

Firestore collections for ShotReady. The data model is designed around a single-photographer v1 with these structural decisions:

- Booking documents hold nested objects for agent, property, schedule, and proofing data (keeps reads simple for a typical shoot lifecycle)
- Photos are a subcollection under bookings (enables individual selection during proofing without touching the parent document)
- Route plans are standalone documents keyed by date (one document loads the entire shoot day)
- Invoices are top-level documents (enables independent queries like "all unpaid invoices")
- Agent data lives on booking documents only (no agent collection)

## Dependencies

- `01_Auth.md` -- UID scoping for security rules, agent token design
- `10_Booking_State_Machine.md` -- Valid values for `bookings.status`
- `07_Service_Packages.md` -- Package structure and pricing model

## Collections

### `photographers`

**Purpose:** Photographer profile, business settings, and configuration. Document ID equals Firebase Auth UID.

| Field | Type | Notes |
|-------|------|-------|
| businessName | string | |
| email | string | From Firebase Auth, denormalized for queries |
| phone | string | Optional |
| bookingSlug | string | Unique URL slug for public booking link |
| branding.logoUrl | string | Cloud Storage path. Optional |
| branding.accentColor | string | Hex color applied to agent-facing pages. Default: `#2563EB` |
| availability.windows | array | Recurring windows, see shape below |
| availability.blockedDates | array | ISO date strings (`YYYY-MM-DD`) |
| mlsConfig.name | string | e.g., "CRMLS" |
| mlsConfig.maxWidth | number | Pixels |
| mlsConfig.maxHeight | number | Pixels |
| mlsConfig.maxFileSize | number | Bytes |
| stripe.accountId | string | Basic Stripe account for v1 |
| stripe.isConnected | boolean | |
| notifications.pushEnabled | boolean | Default: true |
| notifications.emailDigest | string | `"instant"`, `"daily"`, `"off"`. Default: `"instant"` |
| onboardingComplete | boolean | True when minimum setup finished. See `06_Photographer_Onboarding.md` |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Availability window shape:**

```
{
  dayOfWeek: number,    // 0 = Sunday, 6 = Saturday
  startTime: string,    // "08:00" (24h format)
  endTime: string       // "17:00"
}
```

---

### `packages`

**Purpose:** Service packages the photographer offers. Top-level collection (not subcollection) for simpler querying from agent booking forms.

| Field | Type | Notes |
|-------|------|-------|
| photographerId | string | |
| name | string | e.g., "Standard Listing" |
| description | string | Shown to agents on booking form |
| price | number | Cents (e.g., 25000 = $250.00) |
| deliverables | array | Strings: `["25 edited photos", "Virtual tour"]` |
| shotListTemplate | array | Default shot list items for this package. See `13_Shoot_Day_Field_Mode.md` |
| estimatedDuration | number | Minutes. Used for route planning |
| isActive | boolean | Inactive packages hidden from booking, kept for historical bookings |
| sortOrder | number | Display order on booking form |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### `bookings`

**Purpose:** Central entity representing a single job from booking through payment. Nested objects keep related data together for efficient reads.

| Field | Type | Notes |
|-------|------|-------|
| photographerId | string | |
| status | string | See `10_Booking_State_Machine.md` for valid values and transitions |
| agentToken | string | 32+ char random string for agent URL access. Indexed, unique |
| agent.name | string | |
| agent.email | string | Used for SendGrid notifications |
| agent.phone | string | Optional |
| agent.company | string | Optional (brokerage name) |
| property.address | string | Full street address |
| property.city | string | |
| property.state | string | |
| property.zip | string | |
| property.lat | number | Geocoded from address via Google Maps |
| property.lng | number | |
| property.accessCode | string | Optional. Gate code, lockbox, etc. |
| property.accessNotes | string | Optional. "Key under mat," "call agent on arrival" |
| property.orientation | string | `"N"`, `"NE"`, `"E"`, etc. Auto-detected or manual. Used for lighting |
| schedule.requestedDate | timestamp | Date the agent requested |
| schedule.confirmedDate | timestamp | Date the photographer confirmed |
| schedule.startTime | string | "10:00" (24h). Set during route optimization |
| schedule.estimatedDuration | number | Minutes. Copied from package at booking |
| package.packageId | string | Reference to packages collection |
| package.name | string | Snapshot at booking time (package may change later) |
| package.price | number | Cents. Snapshot at booking time |
| package.deliverables | array | Snapshot at booking time |
| shotList | array | Shot list items. See shape below |
| proofing.sentAt | timestamp | When proofing link was activated |
| proofing.viewedAt | timestamp | When agent first opened gallery |
| proofing.completedAt | timestamp | When agent submitted selections |
| proofing.approvedAll | boolean | True if agent selected all photos |
| proofing.selectedCount | number | Denormalized count for dashboard display |
| delivery.deliveredAt | timestamp | |
| delivery.downloadToken | string | Separate token for download URL (not the same as agentToken) |
| invoiceId | string | Reference to invoices collection |
| photographerNotes | string | Internal notes, not visible to agent |
| agentNotes | string | Notes from booking form, visible to photographer |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Shot list item shape:**

```
{
  label: string,         // "Front exterior", "Kitchen", "Primary bedroom"
  isCompleted: boolean,   // Checked off during shoot
  completedAt: timestamp  // When marked complete
}
```

---

### `bookings/{bookingId}/photos`

**Purpose:** Individual photo documents. Subcollection enables per-photo operations (agent selection, watermark status) without reading/writing the parent booking.

| Field | Type | Notes |
|-------|------|-------|
| filename | string | Original filename from upload |
| storagePath | string | Cloud Storage path to original |
| watermarkedPath | string | Set by Cloud Function after processing |
| thumbnailPath | string | Set by Cloud Function after processing |
| width | number | Pixels, original dimensions |
| height | number | Pixels, original dimensions |
| fileSize | number | Bytes, original |
| sortOrder | number | Display order in gallery |
| isSelected | boolean | Agent's selection during proofing. Default: true ("select all" default) |
| processingStatus | string | `"uploading"`, `"processing"`, `"ready"`, `"error"` |
| uploadedAt | timestamp | |
| processedAt | timestamp | |

---

### `routePlans`

**Purpose:** One document per shoot day. Contains the ordered list of stops with timing and lighting data. Document ID format: `{photographerId}_{YYYY-MM-DD}`.

| Field | Type | Notes |
|-------|------|-------|
| photographerId | string | |
| date | string | ISO date `YYYY-MM-DD` |
| stops | array | Ordered list. See shape below |
| totalDistanceMeters | number | Sum of all legs |
| totalDurationMinutes | number | Drive time + shoot time |
| isOptimized | boolean | True if route optimization has run |
| optimizedAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Stop shape:**

```
{
  bookingId: string,
  address: string,           // Denormalized from booking
  lat: number,
  lng: number,
  sortOrder: number,         // Position in route
  estimatedArrival: string,  // "09:30" (24h)
  estimatedDuration: number, // Minutes
  lightingWindow: {
    ideal: string,           // "09:00-11:00"
    reason: string           // "East-facing front, morning light"
  },
  driveFromPrevious: number  // Minutes
}
```

---

### `invoices`

**Purpose:** Payment tracking. Top-level collection for independent querying (e.g., all unpaid invoices).

| Field | Type | Notes |
|-------|------|-------|
| bookingId | string | |
| photographerId | string | |
| agentEmail | string | Denormalized for SendGrid |
| agentName | string | Denormalized for display |
| lineItems | array | See shape below |
| subtotal | number | Cents |
| total | number | Cents. Same as subtotal for v1 (no tax calc) |
| status | string | `"draft"`, `"sent"`, `"paid"`, `"overdue"`, `"void"` |
| stripe.paymentIntentId | string | |
| stripe.paymentUrl | string | Stripe-hosted payment link |
| dueDate | timestamp | Default: 7 days from sent date |
| sentAt | timestamp | |
| paidAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Line item shape:**

```
{
  description: string,  // "Standard Listing Package" or "Virtual staging add-on"
  amount: number         // Cents
}
```

## Composite Indexes

| Collection | Fields | Query Purpose |
|-----------|--------|---------------|
| bookings | `photographerId` ASC, `status` ASC | Dashboard filtering by status |
| bookings | `photographerId` ASC, `schedule.confirmedDate` ASC | Calendar view |
| bookings | `agentToken` ASC | Agent URL lookup (single-field, auto-created) |
| packages | `photographerId` ASC, `isActive` ASC, `sortOrder` ASC | Active packages for booking form |
| invoices | `photographerId` ASC, `status` ASC | Unpaid invoice queries |
| routePlans | `photographerId` ASC, `date` ASC | Daily route lookup (single-field on ID covers this) |

## Firestore Cost Considerations

Typical daily operations for a photographer with 5 shoots:

| Operation | Estimated Reads | Estimated Writes |
|-----------|----------------|-----------------|
| Open dashboard (job list) | 15-20 reads | 0 |
| Load route plan | 1 read | 0 |
| Complete a shoot (shot list updates) | 0 | 5-10 writes |
| Upload 30 photos | 0 | 30 writes |
| Agent proofs gallery (30 photos) | 31 reads | 5-15 writes |
| Generate invoice | 1 read | 2 writes |

At 5 shoots/day, roughly 200-400 Firestore operations daily. Well within free tier (50K reads, 20K writes/day).

## Gaps & Assumptions

### Gaps

- **No `agents` collection by design.** If future features need agent history across multiple bookings (e.g., "show me all bookings from Agent Smith"), queries must scan all bookings by `agent.email`. Add an agent collection if this becomes a real need.
- **Property orientation** -- Source for auto-detection is unspecified. Could use Google Maps Street View metadata or property listing data. Default: manual entry by photographer, with auto-detection as post-MVP enhancement.
- **Tax calculation** -- `invoice.total` equals `invoice.subtotal` for v1. Tax handling deferred. See `21_Future_Features.md`.
- **Photo sort order** -- No specification for default ordering. Default: upload order (timestamp-based `sortOrder`).

### Assumptions

- All monetary values stored in cents (integer) to avoid floating-point issues.
- Timestamps use Firestore's native `Timestamp` type, not ISO strings.
- Booking document size stays well under Firestore's 1 MB limit. At ~2 KB per booking with 20 shot list items, this is not a concern.
- Photo subcollection documents average ~500 bytes each. A 50-photo shoot adds ~25 KB of Firestore data (the actual images are in Cloud Storage).
- Route plan `stops` array is capped at ~20 shoots per day (realistic maximum). Array size is not a concern.  
