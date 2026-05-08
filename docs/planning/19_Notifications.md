▸ TodoWrite  
  ← result received  
▸ Extended thinking (1114 chars)  
## Overview

ShotReady sends notifications to two audiences through different channels. Photographers receive push notifications (Firebase Cloud Messaging), in-app badges, and optional email digests through their mobile app. Agents receive transactional emails (SendGrid) at key moments -- they have no app and no push capability. Notifications are tiered to prevent overload: "needs your action" events get immediate push, status updates get in-app badges, and email digests consolidate lower-priority updates.

## Dependencies

- `02_Database_Schema.md` -- `photographers.notifications` preferences
- `03_Cloud_Functions.md` -- `notifications-onBookingChange` trigger, `notifications-sendEmail` helper
- `06_Photographer_Onboarding.md` -- Notification preferences contextual prompt at 3rd booking
- `10_Booking_State_Machine.md` -- Transitions that trigger notifications
- `20_Agent_Web_Shell.md` -- Email links point to the agent's evolving URL

## Notification Channels

| Channel | Audience | Technology | Purpose |
|---------|----------|-----------|---------|
| Push | Photographer | Firebase Cloud Messaging (FCM) | Immediate alerts for action-required events |
| In-app | Photographer | Firestore collection + badge | Persistent record, visible on app open |
| Email | Agent | SendGrid transactional API | All agent communication (no app) |
| Email digest | Photographer | SendGrid (optional) | Daily summary of activity |

## Photographer Notifications

### Tier 1: Immediate Push + In-App

Events that require the photographer's attention now. Push notification sent immediately. Also written to the in-app notification list.

| Event | Push Title | Push Body |
|-------|-----------|----------|
| New booking request | "New Booking Request" | "{Agent Name} wants to book {address} on {date}" |
| Agent completed proofing | "Photos Selected" | "{Agent Name} selected {X} photos for {address}" |
| Payment received | "Payment Received" | "${amount} received for {address}" |
| Invoice overdue | "Invoice Overdue" | "Invoice for {address} is past due ({X} days)" |
| Booking approval reminder | "Pending Booking" | "Booking request from {Agent Name} is waiting ({X}hrs)" |

### Tier 2: In-App Only

Status updates the photographer should know about but don't need immediate interruption.

| Event | In-App Message |
|-------|---------------|
| Agent viewed proofing gallery | "{Agent Name} is reviewing photos for {address}" |
| Booking auto-closed (paid to closed) | "Job for {address} has been archived" |
| Photo processing complete | "All photos processed for {address}" |

### Tier 3: Email Digest (Optional)

A daily summary email sent at 8:00 AM if any of these occurred in the previous 24 hours:

- New bookings received
- Proofing completions
- Payments received
- Overdue invoices

**Format:** Simple list grouped by event type. Each item links to the booking in the mobile app (deep link).

**Default:** Disabled. Enabled via notification preferences. See Preferences section.

### Push Notification Behavior

- Tapping a push notification deep-links to the relevant booking detail screen in the mobile app
- Badge count on the app icon updates with the count of unread in-app notifications
- Push notifications respect the device's Do Not Disturb settings (standard OS behavior)

### In-App Notification List

Accessed via the bell icon on the dashboard header. See `08_Dashboard_Job_List.md`.

**Data model:** A `notifications` subcollection under `photographers/{uid}`:

| Field | Type | Notes |
|-------|------|-------|
| `type` | string | Event type identifier (e.g., `booking_new`, `proofing_complete`, `payment_received`) |
| `title` | string | Notification title |
| `body` | string | Notification body text |
| `bookingId` | string | Links to the relevant booking |
| `isRead` | boolean | Default: false |
| `createdAt` | timestamp | |

**UI:** Scrollable list sorted by `createdAt` descending. Unread items have a dot indicator (accent color) on the left edge. Tapping a notification marks it as read and navigates to the booking. "Mark all as read" action in the header.

**Retention:** Keep the last 100 notifications. Older entries are deleted by a scheduled cleanup function (weekly).

### Unread Badge

The bell icon on the dashboard shows a red badge with the count of unread notifications (`isRead == false`). Query: `notifications` subcollection where `isRead == false`, count only. Updated via Firestore real-time listener.

## Agent Notifications (Email Only)

All agent communication is via SendGrid transactional email. Agents have no app, no push, no in-app notifications.

### Email Catalog

| Trigger | Subject Line | Key Content |
|---------|-------------|-------------|
| Booking submitted | "Booking request received -- {address}" | Submitted details summary, "Your photographer will review and confirm shortly" |
| Booking confirmed | "Booking confirmed -- {address}" | Confirmed date, time (if assigned), package details, booking URL |
| Booking declined | "Booking update -- {address}" | "Your photographer is not available for this date. Please reach out directly to reschedule." |
| Booking cancelled | "Booking cancelled -- {address}" | Brief notice with original date for reference |
| Proofing ready | "Your photos are ready for review -- {address}" | Photo count, proofing link (booking URL), "Tap photos to select your favorites" |
| Photos delivered | "Your photos are ready -- {address}" | Photo count, download link (booking URL), "Photos available for 90 days" |
| Invoice sent | "Invoice from {Business Name} -- {address}" | Line items, total, due date, "Pay Now" link (booking URL) |
| Invoice reminder (overdue) | "Payment reminder -- {address}" | Same as invoice sent, with "This invoice is past due" note |
| Payment receipt | "Payment received -- {address}" | Amount, date, "Thank you" |

### Email Design

All agent emails follow a consistent template:

- **From name:** Photographer's business name
- **From address:** `noreply@{custom-domain}` (SendGrid authenticated domain). Reply-to set to photographer's email so agents can respond directly.
- **Header:** Photographer's logo (if uploaded) and business name
- **Body:** Clean, minimal design. Single-column, max-width 600px. Light background. No dark mode email template (email client dark mode handles inversion).
- **CTA button:** Photographer's accent color. Links to the booking URL (`/b/{agentToken}`). Button text varies by email type ("View Booking", "Review Photos", "Download Photos", "Pay Invoice").
- **Footer:** Photographer's business name, "Powered by ShotReady" in small muted text (required for v1, removable post-MVP with white-label upgrade).

### SendGrid Configuration

| Setting | Value |
|---------|-------|
| API authentication | API key stored in Firebase Functions secrets |
| Sender domain | Custom domain, authenticated via SendGrid DNS records |
| Templates | Dynamic templates with Handlebars variables |
| Rate limit | SendGrid free tier: 100 emails/day. Sufficient for launch |

### Template Variables

All email templates receive a standard set of variables:

| Variable | Source |
|----------|--------|
| `{{photographerName}}` | `photographers.businessName` |
| `{{photographerLogo}}` | `photographers.branding.logoUrl` (or placeholder) |
| `{{accentColor}}` | `photographers.branding.accentColor` |
| `{{agentName}}` | `bookings.agent.name` |
| `{{propertyAddress}}` | `bookings.property.address` |
| `{{bookingUrl}}` | `https://{domain}/b/{agentToken}` |
| `{{packageName}}` | `bookings.package.name` |
| `{{amount}}` | Formatted total (e.g., "$250.00") |

## Notification Preferences

Photographer configures in Settings > Notifications, or via the contextual prompt at the 3rd booking (see `06_Photographer_Onboarding.md`).

### Configurable Settings

| Setting | Options | Default |
|---------|---------|---------|
| Push notifications | On / Off | On |
| New booking push | On / Off | On |
| Payment received push | On / Off | On |
| Proofing complete push | On / Off | On |
| Overdue invoice push | On / Off | On |
| Daily email digest | On / Off | Off |
| Digest time | Time picker (hour only) | 8:00 AM |

### Non-Configurable

These always fire regardless of preferences:
- Booking approval reminder (2-hour timeout) -- always pushed, critical for agent experience
- In-app notifications -- always written, never suppressed (the photographer can ignore them)
- All agent emails -- not configurable by the photographer (agents expect these communications)

### Storage

Notification preferences stored on `photographers/{uid}.notifications`:

```
{
  pushEnabled: true,
  pushBookingNew: true,
  pushPaymentReceived: true,
  pushProofingComplete: true,
  pushOverdue: true,
  emailDigest: false,
  emailDigestHour: 8
}
```

## Notification Dispatch Flow

The `notifications-onBookingChange` Firestore trigger handles most notifications:

1. Detect which field(s) changed on the booking document
2. Determine the notification event type
3. Check photographer's preferences (skip push if disabled for this event type)
4. Write in-app notification document to `photographers/{uid}/notifications`
5. Send FCM push notification (if enabled)
6. Send agent email (if applicable for this event)

All three channels (in-app, push, email) are dispatched from the same trigger function for consistency. If one channel fails, the others still proceed.

## FCM Token Management

- The mobile app registers for push notifications on first launch and stores the FCM device token on `photographers/{uid}.fcmToken`
- Token refreshes are handled by the FCM SDK and updated on the photographer document
- If the token is invalid (app uninstalled, token expired), FCM returns an error. Remove the stale token from the document. The next app launch will re-register.

## Gaps & Assumptions

### Gaps

- **SMS notifications** -- The PRD considered SMS for delivery notification ("agents live on their phones") but it was not selected. SMS could be added post-MVP for critical agent notifications (delivery, overdue). See `21_Future_Features.md`.
- **Notification history for agents** -- Agents have no way to see past notifications. If they lose an email, they can only revisit the booking URL (if they saved it). No agent notification log exists.
- **Quiet hours** -- No time-based suppression of push notifications for the photographer. The photographer manages this via device-level Do Not Disturb.
- **Email bounce handling** -- If an agent's email bounces (invalid address), SendGrid reports it but ShotReady does not surface this to the photographer for v1. The booking sits waiting for a response that will never come.

### Assumptions

- SendGrid free tier (100 emails/day) is sufficient at launch. A 5-shoot day generates roughly 15-20 agent emails. The photographer's digest is 1 additional email.
- FCM delivery is best-effort. Push notifications are not guaranteed (device offline, app killed, etc.). The in-app notification list serves as the reliable backup.
- The photographer has one mobile device. FCM token management handles a single token per photographer. Multi-device push (phone + tablet) would require storing an array of tokens. Deferred.
- Agent email addresses provided at booking are valid. No email verification step for agents.
- All email timestamps and "daily digest at 8:00 AM" use the Cloud Function's deployed region time zone as an approximation of the photographer's local time.  
