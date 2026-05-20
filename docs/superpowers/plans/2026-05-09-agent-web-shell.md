# Agent Web Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap all agent-facing web pages in a shared branded shell with sticky header, context bar, footer, and add missing status-specific views for all 12 booking statuses.

**Architecture:** A `ShellLayout` component wraps both `/book/:slug` and `/b/:token` routes. BookingView is refactored to route all 12 booking statuses through the shell. Existing page components (ProofingGallery, DownloadPage) have their inline headers removed since the shell provides them. New `StatusMessageCard` and `PropertySummaryCard` shared components handle simple status pages.

**Tech Stack:** React, Tailwind CSS, Lucide icons, react-router-dom

---

### Task 1: ShellLayout, StatusMessageCard, PropertySummaryCard, and Status Text Helper

**Files:**
- Create: `apps/web/src/components/shell/ShellLayout.tsx`
- Create: `apps/web/src/components/shell/StatusMessageCard.tsx`
- Create: `apps/web/src/components/shell/PropertySummaryCard.tsx`
- Create: `apps/web/src/components/shell/statusText.ts`

- [ ] **Step 1: Create `apps/web/src/components/shell/ShellLayout.tsx`**

```tsx
import { useState } from "react";

interface ShellBranding {
  businessName: string;
  logoUrl: string | null;
  accentColor: string;
}

interface ShellContext {
  address: string;
  statusText: string;
}

interface ShellLayoutProps {
  branding: ShellBranding | null;
  context?: ShellContext;
  children: React.ReactNode;
}

export function ShellLayout({ branding, context, children }: ShellLayoutProps) {
  const [logoError, setLogoError] = useState(false);
  const accentColor = branding?.accentColor ?? "#2563EB";

  return (
    <div
      className="min-h-screen flex flex-col bg-white"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-[800px] mx-auto flex items-center gap-3">
          {branding?.logoUrl && !logoError ? (
            <>
              <img
                src={branding.logoUrl}
                alt={branding.businessName}
                className="h-10 max-h-10 w-auto"
                onError={() => setLogoError(true)}
              />
              <span className="text-base font-semibold text-gray-900">
                {branding.businessName}
              </span>
            </>
          ) : branding ? (
            <span
              className="text-lg font-bold"
              style={{ color: accentColor }}
            >
              {branding.businessName}
            </span>
          ) : null}
        </div>
      </header>

      {/* Context Bar */}
      {context && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-2.5">
          <div className="max-w-[800px] mx-auto">
            <p className="text-sm font-medium text-gray-900">
              {context.address}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {context.statusText}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-[800px] mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 px-6 py-4" style={{ minHeight: "60px" }}>
        <div className="max-w-[800px] mx-auto text-center">
          {branding && (
            <p className="text-sm text-gray-600">{branding.businessName}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Powered by ShotReady</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/shell/StatusMessageCard.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

interface StatusMessageCardProps {
  icon: LucideIcon;
  iconColor?: string;
  heading: string;
  body: string;
}

export function StatusMessageCard({
  icon: Icon,
  iconColor = "#6B7280",
  heading,
  body,
}: StatusMessageCardProps) {
  return (
    <div className="text-center py-12">
      <Icon size={48} color={iconColor} className="mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">{heading}</h2>
      <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/shell/PropertySummaryCard.tsx`**

```tsx
interface PropertySummaryCardProps {
  address: string;
  scheduledDate?: string | null;
  packageName: string;
  photoCount?: number | null;
}

export function PropertySummaryCard({
  address,
  scheduledDate,
  packageName,
  photoCount,
}: PropertySummaryCardProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 mt-6">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Property</dt>
          <dd className="text-gray-900 font-medium text-right">{address}</dd>
        </div>
        {scheduledDate && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Scheduled</dt>
            <dd className="text-gray-900 font-medium">{scheduledDate}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-gray-500">Package</dt>
          <dd className="text-gray-900 font-medium">{packageName}</dd>
        </div>
        {photoCount != null && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Photos</dt>
            <dd className="text-gray-900 font-medium">{photoCount}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/components/shell/statusText.ts`**

```ts
const STATUS_TEXT: Record<string, string> = {
  pending: "Booking request submitted",
  confirmed: "Shoot confirmed",
  shooting: "Photos in progress",
  editing: "Photos in progress",
  proofing: "Ready for your review",
  delivered: "Photos ready for download",
  invoiced: "Photos ready \u2014 invoice attached",
  overdue: "Photos ready \u2014 payment due",
  paid: "Complete \u2014 paid",
  closed: "Archived",
  cancelled: "Cancelled",
};

export function getStatusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd apps/web && rtk pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/src/components/shell/ && rtk git commit -m "feat: add shell components (ShellLayout, StatusMessageCard, PropertySummaryCard, statusText)"
```

---

### Task 2: Add packageName and scheduledDate to ProofingBookingInfo and Cloud Function

**Files:**
- Modify: `apps/web/src/hooks/useProofingGallery.ts`
- Modify: `functions/src/booking.ts`

- [ ] **Step 1: Add fields to ProofingBookingInfo interface**

In `apps/web/src/hooks/useProofingGallery.ts`, add two fields to the `ProofingBookingInfo` interface after `agentEmail`:

```typescript
export interface ProofingBookingInfo {
  id: string;
  status: string;
  address: string;
  photographerName: string;
  photographerLogo: string | null;
  accentColor: string;
  agentEmail: string;
  packageName: string | null;
  scheduledDate: string | null;
}
```

- [ ] **Step 2: Add packageName and scheduledDate to bookingGetByToken response**

In `functions/src/booking.ts`, find where the booking response object is built (the object returned with `booking:` fields). Add these two fields to the booking section of the response:

```typescript
packageName: booking.package?.name ?? null,
scheduledDate: booking.schedule?.confirmedDate?.toDate?.()?.toISOString() ?? booking.schedule?.requestedDate?.toDate?.()?.toISOString() ?? null,
```

- [ ] **Step 3: Verify it compiles**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/src/hooks/useProofingGallery.ts functions/src/booking.ts && rtk git commit -m "feat: add packageName and scheduledDate to booking token response"
```

---

### Task 3: Refactor BookingView with Shell and All Status Pages

**Files:**
- Modify: `apps/web/src/pages/BookingView.tsx`

- [ ] **Step 1: Rewrite BookingView**

Replace the entire file with:

```tsx
import { useParams } from "react-router-dom";
import {
  CheckCircle, Clock, Camera, XCircle, Archive,
  AlertCircle, WifiOff, Download,
} from "lucide-react";
import { useProofingGallery } from "../hooks/useProofingGallery";
import { ShellLayout } from "../components/shell/ShellLayout";
import { StatusMessageCard } from "../components/shell/StatusMessageCard";
import { PropertySummaryCard } from "../components/shell/PropertySummaryCard";
import { getStatusText } from "../components/shell/statusText";
import { ProofingGallery } from "../components/proofing/ProofingGallery";
import { DownloadPage } from "../components/delivery/DownloadPage";
import { InvoiceSection } from "../components/delivery/InvoiceSection";

export default function BookingView() {
  const { token } = useParams<{ token: string }>();
  const gallery = useProofingGallery(token);

  if (gallery.loading) {
    return (
      <ShellLayout branding={null}>
        <div className="animate-pulse space-y-4 py-12">
          <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          <div className="grid grid-cols-3 gap-2 mt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </ShellLayout>
    );
  }

  if (gallery.error || !gallery.data) {
    const errorMsg = gallery.error ?? "";
    const isNotFound = errorMsg.includes("not found") || errorMsg.includes("invalid") || errorMsg.includes("Invalid");
    const isNetwork = errorMsg.includes("network") || errorMsg.includes("Failed to fetch") || errorMsg.includes("INTERNAL");

    if (isNetwork) {
      return (
        <ShellLayout branding={null}>
          <StatusMessageCard
            icon={WifiOff}
            iconColor="#EF4444"
            heading="Unable to load"
            body="Please check your connection and try again."
          />
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </ShellLayout>
      );
    }

    return (
      <ShellLayout branding={null}>
        <StatusMessageCard
          icon={AlertCircle}
          iconColor="#EF4444"
          heading={isNotFound ? "This link isn't valid" : "Something went wrong"}
          body={
            isNotFound
              ? "Please check the link from your photographer's email."
              : "Please try again in a few minutes."
          }
        />
      </ShellLayout>
    );
  }

  const { data } = gallery;
  const branding = {
    businessName: data.booking.photographerName,
    logoUrl: data.booking.photographerLogo,
    accentColor: data.booking.accentColor,
  };
  const status = data.booking.status;
  const context =
    status !== "declined"
      ? { address: data.booking.address, statusText: getStatusText(status) }
      : undefined;

  return (
    <ShellLayout branding={branding} context={context}>
      <BookingContent gallery={gallery} />
    </ShellLayout>
  );
}

function BookingContent({
  gallery,
}: {
  gallery: ReturnType<typeof useProofingGallery>;
}) {
  const data = gallery.data!;
  const status = data.booking.status;
  const address = data.booking.address;
  const packageName = data.booking.packageName ?? "Photo Package";
  const scheduledDate = data.booking.scheduledDate
    ? new Date(data.booking.scheduledDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  switch (status) {
    case "pending":
      return (
        <>
          <StatusMessageCard
            icon={Clock}
            iconColor="#F59E0B"
            heading="Your booking request has been submitted!"
            body={`You'll receive an email when ${data.booking.photographerName} responds.`}
          />
          <PropertySummaryCard address={address} packageName={packageName} />
        </>
      );

    case "confirmed":
      return (
        <>
          <StatusMessageCard
            icon={CheckCircle}
            iconColor="#22C55E"
            heading="Shoot confirmed!"
            body={`${data.booking.photographerName} has confirmed your booking.`}
          />
          <PropertySummaryCard
            address={address}
            scheduledDate={scheduledDate}
            packageName={packageName}
          />
        </>
      );

    case "shooting":
    case "editing":
      return (
        <>
          <StatusMessageCard
            icon={Camera}
            iconColor="#3B82F6"
            heading="Photos in progress"
            body="Your photographer is working on your photos. You'll receive an email when they're ready for review."
          />
          <PropertySummaryCard address={address} packageName={packageName} />
        </>
      );

    case "proofing":
      return (
        <ProofingGallery
          data={data}
          selections={gallery.selections}
          selectedCount={gallery.selectedCount}
          totalCount={gallery.totalCount}
          isSubmitted={gallery.isSubmitted}
          submitting={gallery.submitting}
          toggleSelection={gallery.toggleSelection}
          selectAll={gallery.selectAll}
          deselectAll={gallery.deselectAll}
          submitSelections={gallery.submitSelections}
        />
      );

    case "delivered":
      return <DownloadPage data={data} />;

    case "invoiced":
    case "overdue":
    case "paid":
      return (
        <>
          <DownloadPage data={data} />
          <InvoiceSection data={data} />
        </>
      );

    case "declined":
      return (
        <StatusMessageCard
          icon={XCircle}
          iconColor="#EF4444"
          heading="Booking declined"
          body="This booking was not accepted. Please contact your photographer directly for more information."
        />
      );

    case "cancelled":
      return (
        <>
          <StatusMessageCard
            icon={XCircle}
            iconColor="#6B7280"
            heading="Booking cancelled"
            body="This booking has been cancelled."
          />
          <PropertySummaryCard address={address} packageName={packageName} />
        </>
      );

    case "closed":
      return (
        <>
          <StatusMessageCard
            icon={Archive}
            iconColor="#6B7280"
            heading="Booking archived"
            body="This booking has been archived."
          />
          {data.delivery?.downloadUrl && <DownloadPage data={data} />}
        </>
      );

    default:
      return (
        <StatusMessageCard
          icon={Clock}
          iconColor="#6B7280"
          heading="Your Booking"
          body={`Current status: ${status}`}
        />
      );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add apps/web/src/pages/BookingView.tsx && rtk git commit -m "feat: refactor BookingView with shell layout and all status pages"
```

---

### Task 4: Remove Inline Headers from ProofingGallery and DownloadPage

**Files:**
- Modify: `apps/web/src/components/proofing/ProofingGallery.tsx`
- Modify: `apps/web/src/components/delivery/DownloadPage.tsx`

- [ ] **Step 1: Remove header and min-h-screen from ProofingGallery**

In `apps/web/src/components/proofing/ProofingGallery.tsx`:

Replace the outer structure:
```tsx
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        {data.booking.photographerLogo && (
          <img
            src={data.booking.photographerLogo}
            alt={data.booking.photographerName}
            className="h-8 mb-2"
          />
        )}
        <h1 className="text-lg font-bold text-gray-900">
          Photos for {address}
        </h1>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
```

With:
```tsx
    <div>
      <div className="pb-24">
```

Replace the closing `</main>` (before the sticky button div) with `</div>`.

- [ ] **Step 2: Remove header and main wrapper from DownloadPage**

In `apps/web/src/components/delivery/DownloadPage.tsx`:

Replace the entire component body with a version that removes the `<header>` and `<main>` wrapper, keeping just the content:

```tsx
export function DownloadPage({ data }: DownloadPageProps) {
  const delivery = data.delivery;
  const address = data.booking.address.split(",")[0];
  const accentColor = data.booking.accentColor;

  if (!delivery) return null;

  const sizeMB = (delivery.zipSize / (1024 * 1024)).toFixed(1);
  const retentionDate = delivery.retentionExpires
    ? new Date(delivery.retentionExpires).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div>
      <p className="text-gray-700 mb-6">
        {address} &middot; {delivery.photoCount} photos
      </p>

      {delivery.downloadUrl ? (
        <a
          href={delivery.downloadUrl}
          download
          className="flex items-center justify-center gap-3 w-full py-4 rounded-lg text-white font-semibold text-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          <Download size={22} />
          Download All Photos ({sizeMB} MB)
        </a>
      ) : (
        <div className="w-full py-4 rounded-lg bg-gray-200 text-gray-500 font-semibold text-lg text-center">
          Download unavailable
        </div>
      )}

      {retentionDate && (
        <p className="text-gray-500 text-sm text-center mt-3">
          Photos available for 90 days (until {retentionDate})
        </p>
      )}

      {data.photos.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Preview
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {data.photos.map((photo, i) => (
              <img
                key={photo.id}
                src={photo.thumbnailUrl}
                alt={`Photo ${i + 1}`}
                className="w-full aspect-[4/3] object-cover rounded-lg"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: Add `import { Download } from "lucide-react";` at the top if not already present (it already is).

- [ ] **Step 3: Verify it compiles**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/src/components/proofing/ProofingGallery.tsx apps/web/src/components/delivery/DownloadPage.tsx && rtk git commit -m "refactor: remove inline headers from ProofingGallery and DownloadPage"
```

---

### Task 5: Wrap BookingForm in ShellLayout

**Files:**
- Modify: `apps/web/src/pages/BookingForm.tsx`

- [ ] **Step 1: Add imports and wrap BookingForm in ShellLayout**

Add imports at top:
```tsx
import { ShellLayout } from "../components/shell/ShellLayout";
import { StatusMessageCard } from "../components/shell/StatusMessageCard";
```

Replace the loading state (line 158-164):
```tsx
  if (isLoading) {
    return (
      <ShellLayout branding={null}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      </ShellLayout>
    );
  }
```

Replace the error state (line 166-177):
```tsx
  if (loadError || !data) {
    return (
      <ShellLayout branding={null}>
        <StatusMessageCard
          icon={AlertCircle}
          iconColor="#EF4444"
          heading={loadError ?? "Something went wrong"}
          body="Please check the link from your photographer."
        />
      </ShellLayout>
    );
  }
```

Replace the submitted state (line 179-197):
```tsx
  if (submitted) {
    const branding = {
      businessName: data.photographer.businessName,
      logoUrl: data.photographer.branding.logoUrl,
      accentColor: data.photographer.branding.accentColor,
    };
    return (
      <ShellLayout branding={branding}>
        <StatusMessageCard
          icon={CheckCircle2}
          iconColor="#22C55E"
          heading="Your booking request has been submitted!"
          body={`You'll receive an email at ${form.email} when ${data.photographer.businessName} responds.`}
        />
      </ShellLayout>
    );
  }
```

Wrap the main form (line 199-408). Extract branding, wrap in ShellLayout, remove the old `min-h-screen bg-background py-8 px-4` div and the old header div:

```tsx
  const { photographer, packages } = data;
  const branding = {
    businessName: photographer.businessName,
    logoUrl: photographer.branding.logoUrl,
    accentColor: photographer.branding.accentColor,
  };

  return (
    <ShellLayout branding={branding}>
      <form
        onSubmit={handleSubmit}
        className="space-y-8"
        noValidate
      >
        {/* Remove the old text-center header div with "Book a Shoot" */}

        {/* Section 1: Your Information */}
        ...rest of form sections unchanged...

        {/* Submit button */}
        ...unchanged...
      </form>
    </ShellLayout>
  );
```

Remove the old header div inside the form:
```tsx
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            Book a Shoot with {photographer.businessName}
          </h1>
        </div>
```

And remove `mx-auto max-w-[600px]` from the `<form>` element since the shell provides max-width centering.

- [ ] **Step 2: Verify it compiles**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add apps/web/src/pages/BookingForm.tsx && rtk git commit -m "feat: wrap BookingForm in ShellLayout with photographer branding"
```

---

### Task 6: Align CSS Accent Variable and Final Typecheck

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Update accent CSS variable**

In `apps/web/src/index.css`, change:
```css
  --color-accent: var(--photographer-accent, #2563EB);
```
to:
```css
  --color-accent: var(--accent, #2563EB);
```

This aligns with the `--accent` property that ShellLayout sets via inline style.

- [ ] **Step 2: Run full monorepo typecheck**

Run: `rtk pnpm typecheck`
Expected: PASS across shared, functions, web, mobile

- [ ] **Step 3: Commit**

```bash
rtk git add apps/web/src/index.css && rtk git commit -m "fix: align accent color CSS variable with ShellLayout"
```

---

### Task 7: Final Integration Verification

- [ ] **Step 1: Verify no leftover imports or references**

Check that removed components/props aren't still imported anywhere. Run typecheck one final time.

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Fix any remaining issues and commit if needed**

```bash
rtk git add -A && rtk git commit -m "fix: resolve any remaining typecheck issues from shell integration"
```
