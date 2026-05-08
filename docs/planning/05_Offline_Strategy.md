▸ ToolSearch: select:Read  
  ← result received  
▸ Extended thinking (1364 chars)  
## Overview

ShotReady is a field tool. Photographers reference the app during shoots for shot lists, access codes, and property notes -- often inside homes with poor or no connectivity. The offline strategy ensures the app remains functional during shoots by pre-caching the day's data and handling writes that occur while disconnected. Firestore's built-in offline persistence is the foundation, supplemented by deliberate pre-fetching and a clear UI layer that communicates connectivity state.

## Dependencies

- `02_Database_Schema.md` -- Document shapes that determine cache size and structure
- `04_UI_Design_System.md` -- Offline indicator UI patterns
- `08_Dashboard_Job_List.md` -- Dashboard behavior during offline
- `13_Shoot_Day_Field_Mode.md` -- Field mode is the primary offline use case

## Data Tiers

Not all data needs to be available offline. Data is split into three tiers based on field criticality.

### Tier 1: Always Cached (Critical for Shoots)

This data must be available with zero connectivity. Pre-fetched before the photographer leaves for the day.

| Data | Source Collection | Trigger |
|------|------------------|---------|
| Today's route plan | `routePlans/{photographerId}_{date}` | App open, or manual "prep my day" action |
| All bookings scheduled today | `bookings/{id}` (confirmed, today's date) | Same trigger as route plan |
| Property details for today | Nested in booking documents | Included with booking fetch |
| Access codes for today | Nested in booking documents | Included with booking fetch |
| Shot lists for today | Nested in booking documents | Included with booking fetch |
| Photographer profile | `photographers/{id}` | App open |
| Service packages | `packages` (active only) | App open |

### Tier 2: Cached Opportunistically

Available if recently viewed. Useful but not critical during shoots.

| Data | Behavior |
|------|----------|
| Bookings for upcoming days | Cached when the calendar or job list is viewed |
| Route plans for upcoming days | Cached when generated or viewed |
| Job dashboard (all statuses) | Cached on last dashboard load |

### Tier 3: Online Only

Requires live connectivity. Not available during shoots.

| Data | Reason |
|------|--------|
| Photo uploads and processing | Requires Cloud Storage and Cloud Functions |
| Proofing gallery (agent-facing) | Web-only, always online |
| Invoice and payment operations | Requires Stripe API |
| Route optimization (generation) | Requires Google Maps API |
| Notification dispatch | Requires FCM and SendGrid |

## Firestore Offline Persistence

### Configuration

Enable Firestore offline persistence at app initialization. Firestore's SDK automatically caches all documents read by the client and serves them from the local cache when offline.

```
// Enable multi-tab persistence (needed for web companion compatibility)
// React Native: persistence is enabled by default in the RN Firestore SDK
```

Key Firestore offline behaviors:
- **Reads**: Served from cache when offline. Real-time listeners fire with cached data immediately, then update when connectivity returns.
- **Writes**: Queued locally and synced when connectivity returns. Writes appear to succeed immediately from the app's perspective.
- **Queries**: Work against cached data, but only return documents the client has previously fetched. New documents created by others (e.g., a new booking from an agent) will not appear until back online.

### Limitations to Design Around

**Firestore offline cache is not selective.** It caches everything the client reads. For a photographer with months of history, the cache could grow. Mitigation: query with limits and date filters so old bookings are not read into cache unnecessarily.

**Offline writes have no server validation.** Security rules and Cloud Function triggers do not run until the write syncs. For field use (marking shot list items complete), this is fine -- these are photographer-only writes to their own data. But booking status changes that trigger Cloud Functions (e.g., moving to `proofing`) should be blocked in the UI when offline.

**No offline support for Cloud Functions.** Any operation that calls a callable function (route optimization, invoice generation, photo processing) will fail offline. The UI must prevent or clearly disable these actions when offline.

## Pre-Fetch Strategy

### "Prep My Day" Flow

When the photographer opens the app in the morning (or manually triggers "Prep my day"), the app fetches and caches all Tier 1 data for today:

1. Query `bookings` where `photographerId == uid`, `status == confirmed`, `schedule.confirmedDate == today`. This reads all today's bookings into Firestore's local cache.
2. Read `routePlans/{photographerId}_{today}`. Caches the full route plan.
3. Confirm Tier 1 data is cached. Show a brief "Ready for today" confirmation.

This flow runs automatically on app open if today has scheduled shoots. It also runs as a background refresh every 30 minutes while the app is foregrounded and online, to pick up any last-minute booking changes.

### Cache Freshness

| Data | Refresh Interval | Refresh Method |
|------|-----------------|----------------|
| Today's bookings | 30 min (auto), pull-to-refresh (manual) | Firestore listener re-attach |
| Route plan | On optimization, pull-to-refresh | Single document read |
| Profile and packages | On app foreground | Firestore listener |

When the app transitions from background to foreground, it checks connectivity and refreshes Tier 1 data if online.

## Offline Writes

### Allowed Offline

These writes are safe to queue because they are photographer-only mutations with no server-side dependencies:

| Action | Write Target | Conflict Risk |
|--------|-------------|---------------|
| Mark shot list item complete | `bookings/{id}.shotList[n].isCompleted` | None -- single writer |
| Add photographer notes | `bookings/{id}.photographerNotes` | None -- single writer |
| Reorder shot list items | `bookings/{id}.shotList` | None -- single writer |

### Blocked Offline

These actions require server-side processing and must be disabled in the UI when offline:

| Action | Reason |
|--------|--------|
| Change booking status | Triggers Cloud Functions (notifications, invoice generation) |
| Upload photos | Requires Cloud Storage |
| Generate/regenerate route | Requires Google Maps API |
| Send proofing link | Triggers email via Cloud Function |
| Create or send invoice | Requires Stripe API |
| Accept/decline booking | Triggers agent notification |

**UI treatment for blocked actions:** Button appears in disabled state with a small "offline" indicator (cloud-off icon from Lucide, 16px, `textMuted`). No toast or modal -- the disabled state is self-explanatory.

## Connectivity Indicators

### Global Indicator

A thin bar (3px height) at the top of the screen, below the status bar:
- **Online:** Not visible (no indicator needed)
- **Offline:** `warning` color bar with subtle pulse animation. Persists until connectivity returns.
- **Syncing:** `accent` color bar with left-to-right progress animation. Appears when queued writes are syncing after reconnection.

### Per-Action Indicators

- Buttons for online-only actions show a small `cloud-off` icon (16px) when offline and are non-interactive
- Data that may be stale (last refreshed > 30 min ago) shows a subtle "Last updated X min ago" caption in `textMuted`

### Reconnection

When connectivity returns:
1. Firestore automatically syncs queued writes
2. Global bar changes from offline (yellow) to syncing (blue) to hidden
3. Tier 1 data refreshes automatically
4. Any Cloud Function triggers from synced writes execute server-side

No manual "sync" button. Reconnection is fully automatic.

## Conflict Resolution

### Why Conflicts Are Rare

For v1 (single photographer), true write conflicts are nearly impossible:
- Only the photographer writes to their own bookings, route plans, and profile
- Agents write only through Cloud Functions (token validation happens server-side on sync)
- No two users edit the same document simultaneously

### The One Realistic Conflict

An agent submits a booking or completes proofing while the photographer is offline. This is not a write conflict -- it is a new document or a Cloud Function updating a different field. When the photographer comes back online:
- New bookings appear in the job list after Firestore syncs
- Proofing completion updates appear on the booking card
- Push notifications for these events are delivered (possibly batched)

### Firestore's Default: Last Write Wins

Firestore uses last-write-wins at the field level. For the single-photographer v1, this is sufficient. No custom conflict resolution logic is needed.

## Storage Considerations

Firestore offline cache size on mobile:
- Default: unlimited (Firestore SDK manages its own cache)
- Estimated cache size for a busy photographer: 50 active bookings x ~2 KB each = ~100 KB of Firestore data. Negligible.
- Photos are NOT in Firestore (they are in Cloud Storage, which has no offline cache). Only photo metadata documents are cached.

No cache eviction strategy needed for v1. If the app is used for years without reinstall, Firestore's internal LRU eviction handles old data.

## Gaps & Assumptions

### Gaps

- **Offline photo capture queue** -- If the photographer wants to tag or annotate photos taken during a shoot for later upload, there is no specification for this. Currently, photos go from camera to Lightroom to web companion upload. No in-app photo capture for v1.
- **Background sync on mobile** -- React Native background task behavior varies by platform. iOS aggressively suspends background tasks. The app should sync on foreground resume, but true background sync (while the app is closed) is unreliable. Not a problem if the photographer opens the app between shoots.
- **Offline duration limit** -- No specification for how long the app should function offline. Practically, a shoot lasts 30-90 minutes. Firestore's cache has no time-based expiration, so the data remains available indefinitely.

### Assumptions

- Firestore's built-in offline persistence is enabled by default in the React Native Firebase SDK. No additional local database (SQLite, WatermelonDB) is needed for v1.
- The photographer opens the app at least once in the morning while connected (at home or office) before heading to shoots. This triggers the Tier 1 pre-fetch.
- All offline writes are to documents the photographer has already read (and therefore cached). No blind writes to uncached documents.
- Cloud Storage (photos) has no offline support and none is needed -- photo upload happens from the web companion on a desktop with stable connectivity. See `14_Web_Companion.md`.  
