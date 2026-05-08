## Overview

ShotReady has two distinct user types with fundamentally different auth models. Photographers authenticate with Firebase Auth and maintain persistent sessions on their mobile app. Agents never create accounts -- they access booking, proofing, delivery, and payment pages via tokenized web links with no login required.

## Dependencies

- `02_Database_Schema.md` -- User document shape, booking tokens
- `03_Cloud_Functions.md` -- Token generation, link creation
- `14_Web_Companion.md` -- Web companion session linking
- `20_Agent_Web_Shell.md` -- Agent-facing page auth context

## Photographer Authentication

### Method

Email/password via Firebase Auth. Social login (Google, Apple) deferred to post-MVP. See `21_Future_Features.md`.

### Registration Flow

Self-service sign-up from the mobile app. No invite codes or approval gates for v1 (single-photographer system).

Required at registration:
- Email address
- Password (Firebase default rules: 6+ characters)
- Display name (business name)

Registration creates both a Firebase Auth user and a photographer profile document in Firestore. See `02_Database_Schema.md` for the `photographers` collection.

### Login

Standard Firebase Auth email/password sign-in. Session persists via Firebase Auth's default token refresh (1-hour ID tokens, auto-refreshed with refresh token). The photographer stays logged in until explicit sign-out.

### Password Reset

Firebase Auth's built-in password reset email flow. No custom UI beyond the trigger button.

### Session Persistence

- Mobile app: `LOCAL` persistence (survives app restarts)
- Web companion: `SESSION` persistence (cleared when browser tab closes) unless the photographer explicitly chooses "Keep me signed in," which switches to `LOCAL`

### Multi-Device

A photographer can be signed in on their phone and the web companion simultaneously. Firestore real-time listeners on both surfaces reflect the same data. No active session limit for v1.

## Agent Access (Tokenized Links)

### Core Principle

Agents do not create accounts, install apps, or sign in. Every agent interaction happens through a unique URL containing a secure token. One booking generates one token, and that token grants access to all agent-facing pages for that booking throughout its lifecycle.

### Token Design

| Field | Value |
|-------|-------|
| Format | URL-safe random string |
| Length | 32 characters minimum |
| Generation | Cloud Function on booking creation |
| Storage | `bookings/{id}.agentToken` field |
| Expiration | None for v1 (valid until booking reaches `closed` state) |

### URL Structure

```
https://{custom-domain}/b/{agentToken}
```

This single URL serves all agent-facing phases. The page rendered depends on the booking's current state. See `10_Booking_State_Machine.md` for state definitions and `20_Agent_Web_Shell.md` for the evolving page behavior.

| Booking State | What the Agent Sees |
|---------------|-------------------|
| `pending` | "Your booking request has been submitted" confirmation |
| `confirmed` | Booking confirmation with date, time, package details |
| `shooting`, `editing` | "Your photos are being prepared" status |
| `proofing` | Photo gallery with selection capability |
| `delivered` | Final photos with download links |
| `invoiced` | Download links + payment interface |
| `paid`, `closed` | Receipt + download links (downloads available until retention expires) |

### Token Security

- Tokens are unguessable (cryptographically random, 32+ chars)
- Token lookup is a single Firestore query on the `agentToken` field
- No rate limiting on token lookups for v1 (low traffic) -- add if abuse detected
- Tokens cannot be used to access other bookings or photographer data
- Agent-facing pages expose only data relevant to that specific booking
- No PII beyond what the agent already provided (their name, email, property address)

### Agent Identification

Agents are identified within a booking by the email address they provide on the booking form. This email is stored on the booking document, not in Firebase Auth. It is used for:
- Sending proofing links, delivery notifications, and invoices via SendGrid
- Displaying the agent's name on photographer-facing screens

No agent collection exists in Firestore. Agent data lives only on the bookings they create.

## Web Companion Auth

The web companion is a browser-based interface for uploading photos from a desktop. It shares the same Firebase Auth account as the mobile app.

### Linking Options

Two approaches, pick one during implementation:

**Option A -- Direct login (recommended for v1):** Photographer signs in with email/password on the web companion directly. Same Firebase Auth credentials, separate session.

**Option B -- QR code linking:** Mobile app generates a short-lived auth token displayed as a QR code. Web companion scans it to establish a session. More seamless but adds implementation complexity.

Default to Option A for v1. Option B is a UX improvement for post-MVP.

## Firebase Auth Configuration

### Enabled Providers

- Email/Password: **enabled**
- Anonymous: **disabled** (agents use token-based access, not Firebase Anonymous Auth)
- Google: **disabled for v1** (post-MVP)
- Apple: **disabled for v1** (post-MVP)

### Security Rules Context

Firestore security rules use the Firebase Auth UID to scope photographer data:

```
// Photographer can only read/write their own data
match /photographers/{photographerId} {
  allow read, write: if request.auth.uid == photographerId;
}

// Photographer can only access their own bookings
match /bookings/{bookingId} {
  allow read, write: if request.auth.uid == resource.data.photographerId;
}
```

Agent access to booking data bypasses Firestore security rules entirely -- agents read data through Cloud Functions that validate the agent token server-side, not through direct Firestore client access. This is critical: agent-facing pages call Cloud Functions, not Firestore directly.

### Cloud Function Auth Patterns

| Function Type | Auth Check |
|--------------|------------|
| Photographer-initiated | Verify Firebase Auth ID token from request header |
| Agent-initiated | Validate `agentToken` from URL/request param against booking document |
| Webhook (Stripe) | Verify Stripe webhook signature |
| Triggered (Firestore) | No auth check needed (trusted server environment) |

## Roles & Permissions

### Photographer (authenticated)

| Permission | Scope |
|-----------|-------|
| Create, read, update bookings | Own bookings only |
| Read, update photographer profile | Own profile only |
| Create, read, update, delete packages | Own packages only |
| Upload, read, delete photos | Own bookings only |
| Read, update route plans | Own route plans only |
| Create, read invoices | Own bookings only |
| Manage availability | Own schedule only |

No delete permission on bookings for v1. Bookings move to `closed` or `cancelled` state.

### Agent (token-based, no account)

| Permission | Scope |
|-----------|-------|
| Submit booking request | Via public booking link |
| View booking status | Single booking via token |
| View proofing gallery | Single booking via token, only during `proofing` state |
| Select/deselect photos | Single booking via token, only during `proofing` state |
| Submit photo selections | Single booking via token, one-time action |
| Download final photos | Single booking via token, after delivery |
| View and pay invoice | Single booking via token |

All agent actions are mediated by Cloud Functions that validate the token and enforce state-appropriate access.

### Admin

No admin role for v1. The single photographer is the sole user. Admin tooling deferred to `21_Future_Features.md`.

## Gaps & Assumptions

### Gaps

- **Account deletion flow** -- No specification for how a photographer deletes their account and associated data (GDPR/CCPA consideration). Defer to post-MVP but flag for legal review.
- **Brute-force protection on token lookups** -- v1 has no rate limiting. The 32-char token space makes guessing infeasible, but monitoring should be added if the app scales.
- **Email verification** -- Firebase Auth supports email verification but the PRD does not specify whether it is required before the photographer can use the app. Default: not required for v1, prompt but do not block.

### Assumptions

- Single photographer means no role-based access control complexity. All Firestore rules are UID-scoped.
- Agent tokens do not expire based on time. They become inaccessible only when the booking reaches `closed` state and the agent-facing page returns a "this booking has been archived" message.
- Web companion and mobile app share the same Firebase Auth user. No separate accounts or linking needed.
- Firebase Auth's default rate limiting on sign-in attempts is sufficient for v1.  
