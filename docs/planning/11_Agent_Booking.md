▸ TodoWrite  
  ← result received  
▸ Extended thinking (1019 chars)  
## Overview

The agent booking form is a public web page where real estate agents submit shoot requests. It is the most critical agent-facing surface: the agent's first interaction with ShotReady, done without any account, login, or prior knowledge of the system. The form must be dead simple for agents with low tech comfort. It lives at `https://{domain}/book/{slug}` where the slug is the photographer's unique booking identifier. After submission, the agent receives a confirmation email and a booking URL that evolves through the job lifecycle. See `10_Booking_State_Machine.md` and `20_Agent_Web_Shell.md`.

## Dependencies

- `01_Auth.md` -- No agent auth required; form is public
- `02_Database_Schema.md` -- Booking document shape, agent and property nested objects
- `03_Cloud_Functions.md` -- `booking-create` callable function handles submission
- `07_Service_Packages.md` -- Package cards rendered on the form
- `09_Schedule_Calendar.md` -- Photographer availability determines bookable dates
- `20_Agent_Web_Shell.md` -- Page layout, photographer branding, responsive shell

## URL and Access

**Booking URL:** `https://{domain}/book/{photographerSlug}`

- Public, no authentication
- The slug maps to a photographer via `photographers` collection query on `bookingSlug`
- If the slug does not match any photographer, show a 404: "This booking link isn't valid. Please check with your photographer."
- The page loads the photographer's active packages and availability to populate the form

## Page Layout

The booking form renders inside the agent web shell (see `20_Agent_Web_Shell.md`) with the photographer's logo and accent color. Light mode only.

```
┌──────────────────────────────────────┐
│  [Photographer Logo]                 │
│  Book a Shoot with {Business Name}   │
│──────────────────────────────────────│
│                                      │
│  YOUR INFORMATION                    │
│  ┌────────────────────────────────┐  │
│  │ Your name*                     │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Email address*                 │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Phone number                   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Brokerage / Company            │  │
│  └────────────────────────────────┘  │
│                                      │
│  PROPERTY DETAILS                    │
│  ┌────────────────────────────────┐  │
│  │ Property address*              │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Access code (gate, lockbox)    │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Access notes                   │  │
│  └────────────────────────────────┘  │
│                                      │
│  PREFERRED DATE                      │
│  ┌────────────────────────────────┐  │
│  │ [Calendar date picker]         │  │
│  └────────────────────────────────┘  │
│                                      │
│  SELECT A PACKAGE                    │
│  ┌─────────┐ ┌─────────┐            │
│  │ Standard│ │ Premium │            │
│  │  $250   │ │  $400   │            │
│  │ ✓ 25... │ │ ✓ 40... │            │
│  └─────────┘ └─────────┘            │
│  Not sure? Your photographer can     │
│  adjust after booking.               │
│                                      │
│  ANYTHING ELSE?                      │
│  ┌────────────────────────────────┐  │
│  │ Notes for your photographer    │  │
│  └────────────────────────────────┘  │
│                                      │
│  [      Submit Booking Request     ] │
│                                      │
└──────────────────────────────────────┘
```

## Form Sections

### Section 1: Your Information

| Field | Type | Required | Validation | Max Length |
|-------|------|----------|-----------|-----------|
| Name | text | Yes | Non-empty | 100 |
| Email | email | Yes | Valid email format | 254 |
| Phone | tel | No | -- | 20 |
| Company | text | No | -- | 100 |

Name and email are required because they are used for all subsequent communication (proofing links, delivery, invoices). Phone and company are optional and shown only if the photographer finds them useful.

### Section 2: Property Details

| Field | Type | Required | Validation | Notes |
|-------|------|----------|-----------|-------|
| Address | text with autocomplete | Yes | Must resolve via Google Places Autocomplete | Full street address |
| Access code | text | No | -- | Gate code, lockbox combo, etc. |
| Access notes | textarea | No | -- | "Key under mat", "Call on arrival" |

**Address autocomplete:** Use Google Places Autocomplete (part of the Maps JavaScript API) to help agents enter valid, geocodable addresses. The autocomplete populates a structured address (street, city, state, zip). If the agent types an address that doesn't match any suggestion, they can submit it manually -- the Cloud Function will attempt geocoding and warn the photographer if it fails.

### Section 3: Preferred Date

A calendar date picker showing the next 60 days.

**Availability indicators:**
- Available dates: normal, selectable
- Unavailable dates (outside photographer's availability windows or blocked): grayed out, not selectable, no tooltip needed -- just visually distinct
- Dates with existing bookings: still selectable (the photographer may be able to fit another shoot). No booking count shown to agents.

**Data source:** The form fetches the photographer's `availability.windows` and `availability.blockedDates` on page load to determine which dates to gray out. This is a read of the photographer's public availability, not their full profile.

**No time selection.** The agent picks a date only. The photographer assigns a specific time during route optimization. See `12_Route_Optimization.md`.

### Section 4: Select a Package

Active packages rendered as selectable cards, ordered by `sortOrder`. See `07_Service_Packages.md` for card layout details.

**Card content per package:**
- Package name (`h3` equivalent in web CSS)
- Price (formatted: "$250")
- Description (body text, max 2 lines)
- Deliverables (checkmark list)
- Estimated duration (caption: "Approx. 1 hour")

**Selection:** Radio-select behavior. Tap/click a card to select. Selected card gets the photographer's accent color as border (3px) and a subtle background tint. Only one package can be selected.

**"Not sure?" message:** Below the package cards, in muted text: "Not sure which to pick? Choose the closest option -- your photographer can adjust after booking."

**Edge case:** If the photographer has only one active package, still show it as a card but pre-select it. The agent confirms by scrolling past.

### Section 5: Additional Notes

| Field | Type | Required | Max Length |
|-------|------|----------|-----------|
| Notes | textarea | No | 500 |

Placeholder: "Anything your photographer should know? Special requests, specific rooms to highlight, staging details..."

Stored as `agentNotes` on the booking document.

## Submission

### Submit Button

Full-width button at the bottom: "Submit Booking Request". Uses the photographer's accent color. Disabled until all required fields are filled.

On press, the button shows a spinner (replaces text) and all form fields become read-only.

### Submission Flow

1. Client validates all required fields
2. Calls `booking-create` Cloud Function with form data
3. Cloud Function validates, geocodes address, creates booking, generates `agentToken`
4. On success: redirect to `https://{domain}/b/{agentToken}` which shows the pending confirmation page
5. On error: show inline error message above the submit button, re-enable form

### Success Page

After redirect, the agent sees the booking's evolving URL in `pending` state:

- "Your booking request has been submitted!"
- Summary of what they submitted (date, address, package)
- "You'll receive an email at {email} when {photographer name} responds."
- "{Photographer name} typically responds within a few hours."
- Bookmark prompt: "Save this link -- you'll use it to view proofs and download your final photos."

### Confirmation Email

Sent by the `booking-create` Cloud Function via SendGrid immediately after creation:

- From: photographer's email (or no-reply fallback)
- Subject: "Booking request received -- {property address}"
- Body: submitted details summary, booking URL, "Your photographer will review and confirm shortly."

## Validation and Errors

### Client-Side

- Required fields show inline error on blur if empty: "This field is required"
- Email format validation on blur: "Please enter a valid email address"
- Date must be in the future and within 60 days
- Package must be selected

### Server-Side (Cloud Function)

| Error | Response | User Message |
|-------|----------|-------------|
| Invalid/missing required fields | 400 | "Please check all required fields and try again." |
| Address cannot be geocoded | 200 (warning, still creates) | Booking created, photographer sees a geocoding warning |
| Package ID invalid or inactive | 400 | "The selected package is no longer available. Please refresh and try again." |
| Photographer not found | 404 | "This booking link isn't valid." |

### Duplicate Prevention

No duplicate booking prevention for v1. If an agent submits twice (double-click, back-button resubmit), two bookings are created. The photographer declines the duplicate. The submit button disables on first click to reduce accidental doubles.

## Responsive Design

The booking form must work well on both desktop and mobile browsers. Agents may open the booking link on their phone.

- **Mobile (< 640px):** Single column, full-width inputs and package cards. Package cards stack vertically.
- **Tablet/Desktop (>= 640px):** Single column, max-width 600px, centered. Package cards in a 2-column grid if 2+ packages exist.

## Performance

- Page load must be fast. No heavy JavaScript framework hydration delays.
- Data fetched on load: photographer profile (name, logo, accent color), active packages, availability. Three lightweight Firestore reads via Cloud Function (agent does not read Firestore directly).
- Google Places Autocomplete script loaded after initial render (defer).

## Gaps & Assumptions

### Gaps

- **Double-booking same time slot** -- Two agents can book the same date. The photographer resolves conflicts during approval. No automated conflict warning to agents on the booking form for v1.
- **Returning agents** -- No "remember me" or pre-fill for agents who have booked before. Every booking is a fresh form. See `21_Future_Features.md`.
- **Package comparison** -- No side-by-side comparison view for packages. Cards are self-explanatory. If the photographer has 4+ packages, scrolling may be needed.
- **Booking link sharing** -- The photographer's booking slug is public. Anyone with the link can submit a booking. No CAPTCHA or bot protection for v1. Add if spam becomes an issue.

### Assumptions

- Agents are comfortable submitting web forms. The form follows standard web conventions (labeled inputs, clear required indicators, submit button at the bottom).
- Google Places Autocomplete covers the photographer's service area. No manual address entry fallback UI is needed beyond typing a full address when autocomplete doesn't match.
- 60-day booking window is sufficient. Agents rarely book more than 2 months ahead.
- The photographer's availability and packages are loaded via a single Cloud Function endpoint that returns all data needed to render the form. Agents never read Firestore directly. See `01_Auth.md`.  
