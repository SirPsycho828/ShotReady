# Design System — ShotReady

> Single source of truth for all design decisions.

## Design Direction

**Direction:** Darkroom — cinematic intimacy, the UI recedes, photography commands
**Signature Element:** Enlarger glow — photos emerge from darkness with soft radial amber halos, content develops like prints in solution

---

## Typography

### Fonts
- **Heading:** Cormorant Garamond (400–700, italic 400) — refined classical serif
- **Body:** Outfit (300–700) — geometric contemporary sans

### Import
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Scale
| Level | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| h1 | Heading | 3.5rem (56px) | 500 | 1.1 | -0.02em |
| h2 | Heading | 2.5rem (40px) | 500 | 1.15 | -0.01em |
| h3 | Heading | 1.5rem (24px) | 600 | 1.3 | 0 |
| h4 | Heading | 1.25rem (20px) | 600 | 1.35 | 0 |
| body | Body | 1rem (16px) | 400 | 1.6 | 0 |
| body-sm | Body | 0.875rem (14px) | 400 | 1.5 | 0.01em |
| caption | Body | 0.75rem (12px) | 500 | 1.4 | 0.04em, uppercase |
| button | Body | 0.875rem (14px) | 600 | 1 | 0.05em, uppercase |

---

## Color Palette

### Core
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| --primary | 20 13% 9% | #1A1614 | Warm near-black, primary buttons |
| --primary-foreground | 36 43% 90% | #F0E8DC | Warm ivory text on primary |
| --secondary | 25 18% 12% | #252019 | Elevated surfaces, secondary buttons |
| --secondary-foreground | 30 28% 83% | #E0D5C8 | Text on secondary |
| --accent | 31 55% 64% | #D4A574 | Darkroom amber — links, focus, highlights |
| --accent-foreground | 20 25% 8% | #1A1210 | Dark text on accent |

### Surfaces
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| --background | 20 11% 5% | #0F0D0C | Deep warm black — page background |
| --foreground | 36 43% 90% | #F0E8DC | Warm ivory — primary text |
| --card | 26 13% 10% | #1E1A17 | Dark card surfaces |
| --card-foreground | 36 43% 90% | #F0E8DC | Text on cards |
| --muted | 24 14% 15% | #2A2420 | Disabled, subtle fills |
| --muted-foreground | 28 10% 49% | #8A7D70 | Secondary text, labels |

### Borders & Input
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| --border | 26 13% 17% | #322B25 | Subtle warm dividers |
| --input | 26 15% 20% | #3D342C | Form input borders |
| --ring | 31 55% 64% | #D4A574 | Focus ring (amber) |

### Semantic
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| --destructive | 8 55% 50% | #C44B3B | Error, delete, danger |
| --destructive-foreground | 0 0% 100% | #FFFFFF | Text on destructive |
| --success | 122 27% 48% | #5A9B5C | Success, complete, active |
| --warning | 38 65% 53% | #D4A03C | Caution, pending, attention |

### WCAG Contrast
- Foreground (#F0E8DC) on Background (#0F0D0C): ~14:1 (AAA)
- Accent (#D4A574) on Background (#0F0D0C): ~7:1 (AA)
- Muted FG (#8A7D70) on Background (#0F0D0C): ~4.5:1 (AA)
- Foreground on Card (#1E1A17): ~12:1 (AAA)

---

## Spacing

Base unit: 4px. Cinematic scale (generous whitespace around photos).

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 0.25rem (4px) | Tight gaps |
| --space-2 | 0.5rem (8px) | Component internal padding |
| --space-3 | 0.75rem (12px) | Between related elements |
| --space-4 | 1rem (16px) | Standard gap |
| --space-6 | 1.5rem (24px) | Section padding |
| --space-8 | 2rem (32px) | Section margins |
| --space-12 | 3rem (48px) | Large section gaps |
| --space-16 | 4rem (64px) | Page section separation |
| --space-24 | 6rem (96px) | Hero/major section gaps |

---

## Border Radius

Gallery-sharp with minimal softening.

| Token | Value | Usage |
|-------|-------|-------|
| --radius-sm | 3px | Small elements (badges, chips) |
| --radius-md | 5px | Buttons, inputs |
| --radius-lg | 8px | Cards, panels |
| --radius-xl | 12px | Modals, large containers |
| --radius-full | 9999px | Pills, avatars |

---

## Shadows

Luminous warm glows — on dark surfaces, shadows become light sources.

| Token | Value | Usage |
|-------|-------|-------|
| --shadow-sm | 0 1px 3px rgba(15,13,12,0.4) | Subtle depth (cards at rest) |
| --shadow-md | 0 4px 12px rgba(15,13,12,0.5) | Interactive hover states |
| --shadow-lg | 0 8px 24px rgba(15,13,12,0.6) | Elevated elements (dropdowns) |
| --shadow-xl | 0 20px 48px rgba(15,13,12,0.7) | Prominent elements |
| --glow-sm | 0 0 20px rgba(212,165,116,0.08) | Subtle amber photo glow |
| --glow-md | 0 0 40px rgba(212,165,116,0.12) | Hover photo glow |
| --glow-lg | 0 0 60px rgba(212,165,116,0.18) | Hero photo glow |

---

## Animation

| Token | Value | Usage |
|-------|-------|-------|
| --duration-fast | 150ms | Micro-interactions (hover, focus) |
| --duration-normal | 250ms | State transitions |
| --duration-slow | 400ms | Page transitions, reveals |
| --duration-develop | 600ms | Photo "developing" entrance |
| --easing-default | cubic-bezier(0.4, 0, 0.2, 1) | General motion |
| --easing-spring | cubic-bezier(0.34, 1.56, 0.64, 1) | Bouncy entrances |
| --easing-out | cubic-bezier(0, 0, 0.2, 1) | Exit animations |

**Signature Animation — Enlarger Glow:**
Photos enter with simultaneous scale (0.98 → 1.0) and opacity (0 → 1) over 600ms with easing-out, accompanied by a radial amber glow that pulses softly from behind the image. On hover, the glow intensifies (--glow-sm → --glow-md) and the photo lifts slightly (translateY -2px). Metadata overlays slide up from below with a 150ms delay.

---

## CSS Custom Properties

```css
:root {
  /* Typography */
  --font-heading: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'Outfit', system-ui, sans-serif;

  /* Core Colors */
  --primary: 20 13% 9%;
  --primary-foreground: 36 43% 90%;
  --secondary: 25 18% 12%;
  --secondary-foreground: 30 28% 83%;
  --accent: 31 55% 64%;
  --accent-foreground: 20 25% 8%;

  /* Surfaces */
  --background: 20 11% 5%;
  --foreground: 36 43% 90%;
  --card: 26 13% 10%;
  --card-foreground: 36 43% 90%;
  --muted: 24 14% 15%;
  --muted-foreground: 28 10% 49%;

  /* Borders & Input */
  --border: 26 13% 17%;
  --input: 26 15% 20%;
  --ring: 31 55% 64%;

  /* Semantic */
  --destructive: 8 55% 50%;
  --destructive-foreground: 0 0% 100%;
  --success: 122 27% 48%;
  --warning: 38 65% 53%;

  /* Radius */
  --radius-sm: 3px;
  --radius-md: 5px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Shadows (dark surface) */
  --shadow-sm: 0 1px 3px rgba(15,13,12,0.4);
  --shadow-md: 0 4px 12px rgba(15,13,12,0.5);
  --shadow-lg: 0 8px 24px rgba(15,13,12,0.6);
  --shadow-xl: 0 20px 48px rgba(15,13,12,0.7);

  /* Glow (signature) */
  --glow-sm: 0 0 20px rgba(212,165,116,0.08);
  --glow-md: 0 0 40px rgba(212,165,116,0.12);
  --glow-lg: 0 0 60px rgba(212,165,116,0.18);

  /* Animation */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-develop: 600ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --easing-out: cubic-bezier(0, 0, 0.2, 1);

  /* Photographer accent override (agent pages set via JS) */
  --photographer-accent: var(--accent);
}
```

### Note on Photographer Accent Override

Agent-facing pages allow the photographer's custom accent color to override `--accent` via the `--photographer-accent` CSS variable set by ShellLayout. The darkroom amber is ShotReady's brand default; individual photographer branding takes precedence on booking/proofing/delivery pages.
