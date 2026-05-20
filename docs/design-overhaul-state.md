# Design Overhaul State

## Current Phase: 11 (Deploy)
## Completed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

## Project
- **Name:** ShotReady
- **Domain:** Real estate photography workflow
- **Framework:** React 19 + Vite 6
- **CSS:** Tailwind CSS 3.4 with CSS custom properties
- **Component Library:** None (custom components, lucide-react icons)
- **Animation Library:** None (CSS-only — enlarger glow, develop, slide-fade)
- **Build Tool:** Vite 6
- **Package Manager:** pnpm monorepo

## Page Inventory
| Page | Route | File | Status |
|------|-------|------|--------|
| LandingPage | `/` | `src/pages/LandingPage.tsx` | complete |
| DashboardPage | `/dashboard` | `src/pages/DashboardPage.tsx` | complete |
| BookingForm | `/book/:slug` | `src/pages/BookingForm.tsx` | complete |
| BookingView | `/b/:token` | `src/pages/BookingView.tsx` | complete |
| WebCompanion | `/upload` | `src/pages/WebCompanion.tsx` | complete |
| SettingsPage | `/settings` | `src/pages/SettingsPage.tsx` | complete |

## Key Components
- ShellLayout (header, context bar, content, footer)
- StatusMessageCard (icon + heading + body)
- PropertySummaryCard
- ProofingGallery (photo grid, lightbox, selection, approve)
- DownloadPage (ZIP download, photo preview grid)
- InvoiceSection
- BookingDatePicker
- PackageCard
- SignIn, BookingSelector, DropZone, UploadScreen
- AuthLayout
- Dashboard: StatusPill, FilterChipBar, BookingCard

## Design Direction
**Chosen:** Darkroom
**Typography:** Cormorant Garamond (headings) + Outfit (body/UI)
**Primary:** #1A1614 (warm near-black)
**Accent:** #D4A574 (darkroom amber)
**Background:** #0F0D0C (deep warm black)
**Surface:** #1E1A17 (dark card)
**Foreground:** #F0E8DC (warm ivory)
**Distinguishing:** #8B6B4A (bronze)
**Signature:** Enlarger glow — radial amber halos behind photos, develop animation, hover metadata
**Layout:** Full-bleed photography, dark framing, minimal chrome, gallery-wall aesthetic
**Favicon:** Viewfinder frame (corner brackets + center focus dot)

## Design System
docs/design-system.md
