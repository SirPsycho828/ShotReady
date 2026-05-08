▸ ToolSearch: select:Skill  
  ← result received  
▸ Extended thinking (1068 chars)  
## Overview

Service packages define what a photographer offers and at what price. Agents select a package when booking a shoot. Packages appear as visual cards on the agent booking form with name, description, price, and included deliverables. When a booking is created, the selected package is snapshotted onto the booking document so that future package edits do not affect existing jobs. Each package also carries a default shot list template that seeds the booking's shot list.

## Dependencies

- `02_Database_Schema.md` -- `packages` collection schema, booking `package` snapshot shape
- `06_Photographer_Onboarding.md` -- First package created during onboarding Step 2
- `11_Agent_Booking.md` -- How packages are displayed on the agent booking form
- `13_Shoot_Day_Field_Mode.md` -- Shot list templates tied to packages

## Package Data

Full schema in `02_Database_Schema.md`. Key fields:

| Field | Type | Constraints |
|-------|------|------------|
| `name` | string | Required, max 60 characters |
| `description` | string | Required, max 200 characters |
| `price` | number | Required, stored in cents, minimum 0 (free packages allowed) |
| `deliverables` | string[] | Required, at least 1 item, max 10 items, max 80 chars each |
| `shotListTemplate` | string[] | Optional, max 30 items |
| `estimatedDuration` | number | Required, minutes, 15-minute increments, range 30-480 |
| `isActive` | boolean | Default: true |
| `sortOrder` | number | Determines display order on booking form |

## CRUD Operations

### Create Package

**Where:** Settings > Packages > "Add Package" button.

**Form fields:** Same as onboarding Step 2 (see `06_Photographer_Onboarding.md`), plus:
- Shot list template -- optional section below the core fields. Add/remove/reorder list of shot descriptions. Placeholders suggest common shots: "Front exterior", "Kitchen", "Living room", "Primary bedroom", "Primary bathroom", "Backyard".
- Estimated duration -- picker in 15-minute increments. Default: 1 hour.

**Validation:**
- Name must be unique among the photographer's active packages (case-insensitive)
- Price accepts dollar input (e.g., "250.00"), converts to cents on save (25000)
- At least one deliverable is required
- Shot list template items are optional but if provided, each must be non-empty

**On save:** Creates document in `packages` collection. `sortOrder` is set to one higher than the current maximum (new packages appear last).

### Edit Package

**Where:** Settings > Packages > tap a package card.

**Behavior:** Same form as create, pre-filled with current values. All fields editable.

**Important:** Editing a package does not affect existing bookings. Bookings carry a snapshot of the package at booking time. Only future bookings use the updated package values.

**UI note:** If the package has active bookings (status not `closed` or `cancelled`), show an informational banner: "Changes apply to future bookings only. X active bookings use the previous version."

### Deactivate Package

**Where:** Settings > Packages > tap package card > "Deactivate" option.

Deactivation sets `isActive: false`. The package disappears from the agent booking form but remains in the database for historical reference (existing bookings still show the snapshotted package name and price).

**Guard:** If this is the photographer's only active package, block deactivation with a message: "You need at least one active package for agents to book." This is a hard rule -- the booking form cannot render with zero packages.

### Reactivate Package

Deactivated packages appear in a "Deactivated" section at the bottom of the packages list. Tap to open, then "Reactivate" sets `isActive: true`.

### Delete Package

**Not supported for v1.** Packages can only be deactivated. Deletion would break historical booking references. If the photographer wants to clean up, they deactivate old packages and they stay hidden.

### Reorder Packages

**Where:** Settings > Packages. Drag handles on each package card allow reordering.

**Behavior:** Drag-and-drop reorder updates the `sortOrder` field on each affected package. The order determines display sequence on the agent booking form (lowest `sortOrder` first).

**Implementation:** On drop, batch-write updated `sortOrder` values for all affected packages.

## Agent-Facing Display

Packages appear as selectable cards on the agent booking form. See `11_Agent_Booking.md` for the full booking form spec.

### Card Layout

Each package card shows:
- **Package name** -- `h3` weight
- **Price** -- formatted as currency (e.g., "$250"), prominent, right-aligned or below name
- **Description** -- `body` text, max 2 lines with truncation
- **Deliverables** -- bulleted list, each with a checkmark icon (Lucide `check` icon, `success` color)
- **Estimated duration** -- `caption` text, shown as "Approx. X hr Y min"

### Selection Behavior

- Cards are radio-select (one package per booking)
- Selected card gets `accent` border (3px) and subtle `accent` background tint (5% opacity)
- Unselected cards have standard `border` color
- Touch feedback per `04_UI_Design_System.md` (scale 0.97 on press)

### "Not sure?" Safety Net

Below the package cards, a `caption`-sized message: "Not sure which to pick? Choose the closest option -- your photographer can adjust after booking." This reduces booking abandonment from agents who are uncertain. See User Red Team Issue #5.

## Shot List Templates

### Purpose

Each package can define a default shot list. When a booking is created with that package, the template seeds the booking's `shotList` array. The photographer can then customize the list per job (add, remove, reorder items) before the shoot. See `13_Shoot_Day_Field_Mode.md` for how shot lists are used during shoots.

### Template Structure

A shot list template is a simple array of strings. Each string is a shot description.

Example for a "Standard Listing" package:
```
[
  "Front exterior - straight on",
  "Front exterior - angled",
  "Rear exterior",
  "Kitchen - wide",
  "Kitchen - detail",
  "Living room",
  "Dining room",
  "Primary bedroom",
  "Primary bathroom",
  "Bedroom 2",
  "Bedroom 3",
  "Bathroom 2",
  "Laundry room",
  "Backyard / patio",
  "Garage"
]
```

### Template Management

Templates are edited within the package edit form. The template section uses a simple add/remove/reorder list:
- Each item is a text input with a drag handle (left) and delete button (right)
- "Add shot" button appends a new empty field at the bottom
- Reorder via drag-and-drop
- Maximum 30 items per template

### Template to Booking

When `booking-create` Cloud Function creates a booking (see `03_Cloud_Functions.md`), it reads the selected package's `shotListTemplate` and writes it to the booking's `shotList` array, transforming each string into the shot list item shape:

```
Template item: "Front exterior - straight on"

Booking shot list item:
{
  label: "Front exterior - straight on",
  isCompleted: false,
  completedAt: null
}
```

## Package Snapshot on Booking

When a booking is created, the selected package's key fields are copied onto the booking document under `booking.package`:

| Booking Field | Source |
|---------------|--------|
| `package.packageId` | Package document ID |
| `package.name` | `packages/{id}.name` |
| `package.price` | `packages/{id}.price` |
| `package.deliverables` | `packages/{id}.deliverables` |

This snapshot is immutable for the life of the booking. If the photographer later changes the package price from $250 to $300, existing bookings at $250 remain at $250.

### Price Adjustment Per Booking

The snapshotted price is the default for invoicing. However, the photographer can adjust line items on the invoice before sending. See `18_Invoicing_Payments.md`. The booking's `package.price` itself is not editable -- adjustments happen at the invoice level.

## Business Rules

| Rule | Enforcement |
|------|-------------|
| Minimum 1 active package | Block deactivation of last active package |
| Package names unique among active | Validate on create and edit (case-insensitive) |
| Price stored in cents | UI shows dollars, converts on save/load |
| Deliverables non-empty | At least 1 deliverable required |
| Sort order sequential | Re-calculated on reorder, no gaps |
| No deletion | Only deactivation. Deactivated packages kept for history |

## Settings Screen Layout

**Packages section in Settings:**

```
[Header: "Service Packages"]
[+ Add Package button, right-aligned]

[Active Packages]
  [Package Card 1 - drag handle, name, price, tap to edit]
  [Package Card 2 - drag handle, name, price, tap to edit]
  [Package Card 3 - drag handle, name, price, tap to edit]

[Deactivated (collapsed by default)]
  [Package Card 4 - grayed out, tap to view/reactivate]
```

Each card in the settings list is a compact view: name (left), price (right), deliverable count as caption ("5 deliverables"). Tap opens the full edit form.

## Gaps & Assumptions

### Gaps

- **Add-on services** -- The PRD mentions photographers selling add-ons (virtual staging, floor plans, drone footage) but defers the implementation. For v1, add-ons can be represented as separate packages or as deliverable line items within a package. No dedicated add-on system. See `21_Future_Features.md`.
- **Package duplication** -- No "duplicate package" action specified. Would be useful for creating variations (e.g., "Standard" cloned to "Standard + Drone" with a higher price). Default: not implemented for v1, simple enough to create manually.
- **Currency** -- USD assumed. No multi-currency support. See `21_Future_Features.md`.

### Assumptions

- A photographer will have 2-5 active packages. The UI does not need to handle pagination or search for packages.
- Free packages (price = 0) are allowed for cases like follow-up shoots or promotional offers. Invoice generation still runs but shows a $0 total.
- Shot list templates are optional. If a package has no template, the booking's `shotList` starts empty and the photographer adds items manually.
- Package `estimatedDuration` is used for route planning time calculations. See `12_Route_Optimization.md`. Accurate duration estimates improve route quality.  
