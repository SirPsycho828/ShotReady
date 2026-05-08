▸ TodoWrite  
  ← result received  
▸ Extended thinking (1124 chars)  
## Overview

The agent web shell is the shared layout, branding, and routing layer that wraps all agent-facing web pages. Agents interact with ShotReady through two URL patterns: the booking form (`/book/{slug}`) and the evolving booking URL (`/b/{agentToken}`). Both render inside the same shell with the photographer's logo, accent color, and consistent responsive layout. The shell is a React SPA that determines which content to render based on the URL pattern and booking status. It is the photographer's public face -- agents should feel like they are interacting with the photographer's own professional system, not a generic platform.

## Dependencies

- `01_Auth.md` -- Agent token validation, no account required
- `02_Database_Schema.md` -- `photographers.branding` (logo, accent color), `bookings.status` for routing
- `03_Cloud_Functions.md` -- `booking-getByToken` returns booking data and photographer branding
- `04_UI_Design_System.md` -- Color tokens, typography scale, component patterns (light mode web adaptation)
- `11_Agent_Booking.md` -- Booking form content
- `16_Proofing_Gallery.md` -- Gallery content
- `17_Delivery_MLS_Export.md` -- Download page content
- `18_Invoicing_Payments.md` -- Invoice and payment content

## URL Routing

The agent web app handles two route patterns:

| Pattern | Content | Data Source |
|---------|---------|------------|
| `/book/{slug}` | Booking form | Cloud Function reads photographer profile and packages by slug |
| `/b/{agentToken}` | Evolving booking page | Cloud Function reads booking data by token, response varies by status |

### Evolving URL Content Routing

The `/b/{agentToken}` page calls `booking-getByToken` on load. The response includes the booking status, which determines the rendered content:

| Status | Component Rendered | Spec |
|--------|-------------------|------|
| `pending` | Pending confirmation | See `10_Booking_State_Machine.md` |
| `confirmed` | Booking confirmed | See `10_Booking_State_Machine.md` |
| `shooting`, `editing` | In-progress status | Brief waiting message |
| `proofing` | Proofing gallery | See `16_Proofing_Gallery.md` |
| `delivered` | Download page | See `17_Delivery_MLS_Export.md` |
| `invoiced`, `overdue` | Download + invoice + payment | See `17_Delivery_MLS_Export.md`, `18_Invoicing_Payments.md` |
| `paid` | Download + paid receipt | See `17_Delivery_MLS_Export.md` |
| `closed` | Archived notice (+ downloads if within retention) | See `15_Photo_Processing.md` retention |
| `declined` | Declined notice | No booking details shown |
| `cancelled` | Cancelled notice | Original date and address for reference |

The page does not auto-refresh or poll for status changes. If the agent keeps the tab open and the status changes server-side, they see the old state until they refresh. A subtle "Last updated {time}" label and manual refresh link at the bottom handles this.

## Shell Layout

### Structure

```
┌──────────────────────────────────────────────┐
│  [Logo]  {Business Name}                     │  <- Header
│──────────────────────────────────────────────│
│                                              │
│  {Property Address}                          │  <- Context bar
│  {Booking status indicator}                  │
│                                              │
│──────────────────────────────────────────────│
│                                              │
│                                              │
│              {Page Content}                  │  <- Varies by status
│              (form, gallery,                 │
│               download, payment)             │
│                                              │
│                                              │
│──────────────────────────────────────────────│
│  {Photographer Business Name}                │  <- Footer
│  Powered by ShotReady                        │
└──────────────────────────────────────────────┘
```

### Header

- **Logo:** Photographer's uploaded logo from `branding.logoUrl`. Max height: 40px. If no logo, show business name in the accent color as a text logo.
- **Business name:** Displayed next to the logo. `h3` equivalent weight.
- **Background:** White. No dark mode for agent pages.
- **Sticky:** Header stays fixed at the top on scroll.

### Context Bar

Below the header, a thin section showing booking context:
- **Property address:** Full street address from the booking
- **Status indicator:** A text label (not the photographer's status pills) describing the current phase in plain language

| Status | Indicator Text |
|--------|---------------|
| `pending` | "Booking request submitted" |
| `confirmed` | "Shoot confirmed" |
| `shooting`, `editing` | "Photos in progress" |
| `proofing` | "Ready for your review" |
| `delivered` | "Photos ready for download" |
| `invoiced` | "Photos ready -- invoice attached" |
| `overdue` | "Photos ready -- payment due" |
| `paid` | "Complete -- paid" |
| `closed` | "Archived" |
| `declined` | -- (no context bar) |
| `cancelled` | "Cancelled" |

The context bar is absent on the booking form page (`/book/{slug}`) since there is no booking yet.

### Content Area

Renders the status-specific content component. Padded with 24px horizontal on mobile, centered with max-width 800px on desktop. White background.

### Footer

- Photographer's business name
- "Powered by ShotReady" in `textMuted` size
- No navigation links (agents don't navigate between pages)
- Minimal height: 60px, `surface` background (light gray)

## Photographer Branding

### Accent Color

The photographer's `branding.accentColor` (default: `#2563EB`) is applied as a CSS custom property `--accent` on the page root. All interactive elements use this variable:

- Booking form submit button
- Package card selected border
- Proofing gallery selection checkboxes and approve button
- Download button
- Pay button
- Links and focus states

### Logo

Loaded from `branding.logoUrl` (Firebase Cloud Storage signed URL). Displayed in the header at max 40px height, proportional width. If the URL is invalid or the image fails to load, fall back to the business name as text.

### Branding Data Source

For the booking form (`/book/{slug}`), branding is fetched as part of the photographer profile lookup by slug.

For the evolving URL (`/b/{agentToken}`), branding is included in the `booking-getByToken` response. The Cloud Function reads the photographer's profile and includes `businessName`, `logoUrl`, and `accentColor` in every response.

## Responsive Design

All agent pages must work on phones (agents check links on their phones frequently), tablets, and desktops.

### Breakpoints

| Breakpoint | Width | Layout Adaptations |
|-----------|-------|-------------------|
| Mobile | < 640px | Single column. Full-width buttons. Photo grid 2 columns. |
| Tablet | 640-1024px | Single column, centered. Photo grid 3 columns. |
| Desktop | > 1024px | Max-width 800px, centered. Photo grid 4 columns. |

### Touch Targets

All interactive elements (buttons, package cards, photo selection checkboxes, links) have minimum 44x44px touch targets per WCAG guidelines. This matters more here than in the photographer app because agents may have less patience for fiddly interfaces.

### Typography

Uses the same type scale as `04_UI_Design_System.md` but rendered with web CSS (`font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). No custom font loading -- system fonts ensure fast rendering.

## Page Loading

### Loading State

On initial page load, show the shell (header with logo placeholder, footer) immediately and a skeleton screen in the content area. The skeleton matches the expected layout shape for the most common view (proofing gallery grid). Content fades in when the Cloud Function response arrives.

### Error States

| Error | Display |
|-------|---------|
| Invalid token (404 from Cloud Function) | "This link isn't valid. Please check the link from your photographer's email." No header branding (photographer unknown). |
| Network error | "Unable to load. Please check your connection and try again." Retry button. |
| Server error (500) | "Something went wrong. Please try again in a few minutes." |

### Performance Budget

Agent pages should load in under 3 seconds on a 4G connection:
- HTML shell: < 50 KB (gzipped)
- JavaScript bundle: < 150 KB (gzipped) -- the agent app is simple, no heavy libraries
- CSS: < 20 KB
- Images: lazy-loaded, thumbnails are ~40 KB each

Cloud Function cold start (3-5 seconds) is the primary latency risk. Acceptable for v1 given the $50/month budget constraint (no min instances). See `03_Cloud_Functions.md`.

## Shared Components

Components used across multiple agent pages:

### Status Message Card

A centered card with icon, heading, and body text. Used for waiting states, confirmations, and error messages.

```
┌──────────────────────────────────────┐
│            [icon, 48px]              │
│                                      │
│     Your booking request has         │
│        been submitted!               │
│                                      │
│  You'll receive an email when your   │
│  photographer responds.              │
└──────────────────────────────────────┘
```

Uses Lucide icons: `check-circle` (success/confirmation), `clock` (waiting), `camera` (in-progress), `download` (delivery), `alert-circle` (error).

### Property Summary Card

Compact card showing booking details. Used in confirmation, waiting, and download pages.

| Field | Shown |
|-------|-------|
| Property address | Always |
| Scheduled date | When confirmed |
| Package name | Always |
| Photo count | When available (proofing onward) |

### Action Button

Full-width, accent-colored, 48px height, 12px border radius. One primary action per page state. Text and icon vary by context.

## SEO and Meta

Agent pages should not be indexed by search engines:
- `<meta name="robots" content="noindex, nofollow">`
- No `sitemap.xml` entry for `/b/*` routes
- The booking form (`/book/{slug}`) is also noindexed -- it is shared privately, not discovered via search

### Open Graph Tags

When an agent shares the booking link (e.g., pastes in a text message), show a useful preview:
- `og:title`: "{Business Name} -- {Property Address}"
- `og:description`: Status-appropriate text (e.g., "Your photos are ready for review")
- `og:image`: Photographer's logo or a default ShotReady preview image

## Gaps & Assumptions

### Gaps

- **Accessibility audit** -- WCAG 2.1 AA is targeted (see `16_Proofing_Gallery.md`) but no formal audit is planned for v1. Manual testing against key criteria (contrast, keyboard nav, screen reader) during development.
- **Internationalization** -- All agent-facing text is English only for v1. No i18n framework. See `21_Future_Features.md`.
- **Print stylesheet** -- Agents may want to print invoice details or booking confirmations. No print-optimized CSS for v1.
- **Agent feedback mechanism** -- No way for agents to report issues or provide feedback on the web pages. They contact the photographer directly.

### Assumptions

- The booking form and evolving URL are separate routes in the same React SPA. A single build deploys both.
- Agent pages are server-side rendered (SSR) or statically generated with client-side data fetching for the dynamic content. The shell renders immediately; content loads via the Cloud Function call. If SSR adds too much complexity, client-side rendering with skeleton screens is acceptable for v1.
- The "Powered by ShotReady" footer text is required for v1 (brand awareness while free/low-cost). It will become removable as a paid feature in a future white-label tier.
- Photographer branding is limited to logo and accent color for v1. Full white-labeling (custom domain per photographer, custom email from address, removal of ShotReady branding) is post-MVP.
- All agent-facing pages are served from the same custom domain as the ShotReady marketing site (if one exists) or from Firebase Hosting directly.  
