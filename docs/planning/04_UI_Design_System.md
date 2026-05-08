▸ ToolSearch: select:Write  
  ← result received  
▸ Extended thinking (1512 chars)  
## Overview

ShotReady's design system is built for two contexts: a photographer's daily tool (mobile app, mostly indoor use for editing/scheduling) and an active field instrument (used during shoots, often in bright light with one hand). Dark mode is the default. A high-contrast light mode activates during shoots or by manual toggle. Agent-facing web pages share the color system but use standard web CSS, not NativeWind.

Implemented with NativeWind (Tailwind for React Native), Gluestack UI (headless components), Lucide Icons, and React Native Reanimated.

## Dependencies

- `20_Agent_Web_Shell.md` -- Agent-facing pages reference this system's colors and type scale but render with web CSS
- `13_Shoot_Day_Field_Mode.md` -- Field mode UI constraints (one-handed use, bottom-60% tap targets)

## Color System

### Dark Mode (Default)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0F1117` | App background |
| `surface` | `#1A1D27` | Cards, modals, sheets |
| `surfaceRaised` | `#242836` | Elevated cards, active states |
| `border` | `#2E3347` | Card borders, dividers |
| `borderFocus` | `#2563EB` | Focused input borders |
| `textPrimary` | `#F1F3F9` | Headings, body text |
| `textSecondary` | `#9BA3BF` | Labels, captions, timestamps |
| `textMuted` | `#5E6687` | Placeholders, disabled text |
| `accent` | `#2563EB` | Primary actions, links, active indicators |
| `accentHover` | `#3B82F6` | Pressed/hovered accent |
| `success` | `#22C55E` | Confirmed, paid, delivered states |
| `warning` | `#F59E0B` | Pending, needs attention |
| `error` | `#EF4444` | Errors, declined, overdue |
| `info` | `#3B82F6` | Informational badges |

### Light Mode (Field/Shoot)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FFFFFF` | |
| `surface` | `#F8F9FB` | |
| `surfaceRaised` | `#F1F3F7` | |
| `border` | `#D1D5E0` | |
| `borderFocus` | `#1D4ED8` | Darker blue for sunlight contrast |
| `textPrimary` | `#111827` | |
| `textSecondary` | `#4B5563` | |
| `textMuted` | `#9CA3AF` | |
| `accent` | `#1D4ED8` | Slightly darker for outdoor legibility |

Success, warning, error, and info remain the same across modes.

### Mode Switching

- Default: dark mode
- Manual toggle in settings and quick-access pull-down
- Auto-switch: when a booking's status is `shooting` and the photographer opens that booking, prompt to switch to light mode if currently in dark
- No ambient light sensor for v1 (unreliable across devices). See `21_Future_Features.md`

## Typography

**Font family:** System default (`-apple-system` / Roboto). No custom fonts for v1 -- keeps bundle size down and rendering fast.

| Scale | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `h1` | 28px | 700 | 34px | Screen titles |
| `h2` | 22px | 600 | 28px | Section headings |
| `h3` | 18px | 600 | 24px | Card titles, group headers |
| `body` | 16px | 400 | 22px | Body text, descriptions |
| `bodyMedium` | 16px | 500 | 22px | Emphasized body text |
| `caption` | 14px | 400 | 18px | Labels, timestamps, metadata |
| `small` | 12px | 500 | 16px | Badges, status pills, fine print |
| `tabular` | 16px | 400 | 22px | Prices, counts (monospace variant) |

## Spacing & Layout

**Grid:** 8px base unit. All spacing, padding, and margins use multiples of 8.

| Token | Value | Common Use |
|-------|-------|------------|
| `xs` | 4px | Icon-to-text gap, tight inline spacing |
| `sm` | 8px | Minimum padding, list item gap |
| `md` | 16px | Card padding, section gap |
| `lg` | 24px | Screen padding horizontal, group gap |
| `xl` | 32px | Section separation |
| `2xl` | 48px | Major section breaks |

**Card pattern:** `md` (16px) internal padding, `border` + subtle shadow (`0 1px 3px rgba(0,0,0,0.3)` dark, `0 1px 3px rgba(0,0,0,0.08)` light). Border radius: 12px.

**Screen padding:** `lg` (24px) horizontal padding on all screens.

**Safe areas:** Respect device safe area insets. Bottom navigation clears the home indicator.

## Components

### Buttons

**Primary:** Solid `accent` fill, white text, 48px height, 12px border radius, `bodyMedium` weight. Full-width on mobile forms, inline elsewhere.

**Secondary:** Transparent background, `accent` border, `accent` text. Same dimensions as primary.

**Destructive:** `error` fill, white text. Used sparingly (decline booking, delete).

**Ghost:** No border, no fill, `accent` text. Used for tertiary actions and navigation.

**Disabled state:** 40% opacity on all variants. No press interaction.

### Inputs

Outlined style with visible `border` color. Border changes to `borderFocus` (accent) on focus. Background matches `surface`. Height: 48px. Border radius: 10px. Padding: `md` horizontal.

**Label:** `caption` size, `textSecondary`, positioned above the input with `xs` gap.

**Error state:** Border changes to `error`. Error message in `small` size, `error` color below the input.

### Status Pills

Small rounded badges for booking status. Height: 24px. Padding: 4px 10px. Border radius: 12px (fully rounded). `small` text weight.

| Status | Background | Text |
|--------|-----------|------|
| Pending | `warning` at 15% opacity | `warning` |
| Confirmed | `accent` at 15% opacity | `accent` |
| Shooting | `accent` solid | white |
| Editing | `info` at 15% opacity | `info` |
| Proofing | `warning` at 15% opacity | `warning` |
| Delivered | `success` at 15% opacity | `success` |
| Paid | `success` solid | white |
| Overdue | `error` at 15% opacity | `error` |

### Cards

**Job card (dashboard):** Property address as `h3`, agent name as `caption`, status pill right-aligned, scheduled date below address. Chevron right icon for navigation. Entire card is tappable.

**Photo card (gallery):** Square aspect ratio, thumbnail fill, selection checkbox overlay (top-right corner, 32x32px tap target). Selected state: `accent` border (3px), checkbox filled.

### Bottom Navigation

4 tabs: **Jobs** (briefcase icon), **Calendar** (calendar icon), **Route** (map-pin icon), **Settings** (settings icon). Active tab: `accent` color icon + label. Inactive: `textMuted`. Height: 56px plus safe area.

### Skeleton Screens

Used for list and card loading. Gray shimmer animation on `surfaceRaised` blocks matching the layout shape. Shimmer runs left-to-right, 1.5s duration, infinite loop. Built with Reanimated for native thread performance.

### Spinners

Used for button actions (submit, save) and quick operations. Replace button text with a 20px spinner on press. Accent color on dark backgrounds, white on accent backgrounds.

## Interactions

### Touch Feedback

All tappable elements use Reanimated for a subtle scale + opacity shift on press:
- Scale to 0.97
- Opacity to 0.85
- Duration: 100ms in, 150ms out
- Easing: ease-out

### Pull to Refresh

Standard pull-to-refresh on job list and calendar views. Uses platform-native indicator.

### Swipe Actions

Job cards support swipe-right to reveal a quick-action (e.g., "Call Agent" or "Navigate"). Single action per swipe direction. `accent` background with white icon.

## Icons

Lucide Icons throughout (`lucide-react-native`). Consistent 24px size for navigation and inline use, 20px for compact contexts (inside inputs, small buttons), 32px for empty states and feature callouts.

Stroke width: 1.75px (Lucide default is 2, slightly thinner feels more refined).

## Field Mode Constraints

When a booking is in `shooting` state and the photographer is viewing that booking:

- All interactive elements must sit within the bottom 60% of the screen (thumb reach zone for one-handed use)
- Tap targets: minimum 48x48px, recommended 56x56px
- Shot list items: large checkboxes (32x32px visual, 56x56px tap target)
- Access code and property notes: displayed in `h2` size for quick glance readability
- No complex gestures -- taps only during field mode

See `13_Shoot_Day_Field_Mode.md` for full field mode UX.

## Agent-Facing Web Styling

Agent web pages use the same color tokens but rendered as CSS custom properties, not NativeWind. The agent experience adapts to the photographer's branding:

- Photographer's `branding.accentColor` replaces the default `accent` token
- Photographer's `branding.logoUrl` appears in the page header
- All other tokens remain unchanged

Light mode only for agent-facing pages (agents view on varied devices and contexts -- dark mode adds unnecessary complexity). See `20_Agent_Web_Shell.md`.

## Gaps & Assumptions

### Gaps

- **Animation specs for screen transitions** -- No specification for navigation transitions (slide, fade, etc.). Default: React Navigation's default platform transitions (slide from right on iOS, fade on Android).
- **Empty state illustrations** -- No spec for what users see on empty screens (no bookings yet, no packages created). Default: Lucide icon (64px, `textMuted`) + short message. No custom illustrations for v1.
- **Toast/snackbar design** -- Success and error feedback after actions (save, delete) is unspecified. Default: brief toast at bottom of screen, auto-dismiss after 3 seconds, `surface` background with appropriate status color left border.

### Assumptions

- System fonts are acceptable for v1. Custom fonts (e.g., Inter, Plus Jakarta Sans) are a post-MVP design upgrade.
- Agent-facing pages are light mode only. Photographer branding does not include a dark mode option.
- NativeWind's Tailwind config will be customized with the token values above as the theme. Gluestack UI components will be wrapped with these theme tokens.
- All color tokens are defined once in the Tailwind config and referenced by token name, never by raw hex value in component code.  
