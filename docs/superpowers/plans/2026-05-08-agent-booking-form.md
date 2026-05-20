# Agent Booking Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public agent-facing booking form at `/book/:slug` where real estate agents submit shoot requests — the photographer's primary intake surface.

**Architecture:** A `usePhotographerBySlug` hook fetches photographer profile and active packages by booking slug. The `BookingForm` page renders a 5-section form (agent info, property, date, package, notes) with client-side validation. Submission writes directly to Firestore as a `pending` booking (Cloud Function replacement deferred to spec 03). `PackageCard` and `BookingDatePicker` are extracted as reusable components.

**Tech Stack:** React 19, react-router-dom v7, Firebase web SDK (modular), Tailwind CSS, lucide-react

---

## File Structure

```
apps/web/src/
├── hooks/
│   └── usePhotographerBySlug.ts    # Create — fetch photographer + packages by slug
├── components/
│   ├── PackageCard.tsx             # Create — selectable package card
│   └── BookingDatePicker.tsx       # Create — calendar with availability
├── pages/
│   └── BookingForm.tsx             # Modify — full booking form
```

## Parallelization Notes

Task 1 (hook) is independent.
Task 2 (components) is independent.
Task 3 (BookingForm) depends on Tasks 1–2.
Task 4 (typecheck + commit) depends on all.

---

### Task 1: usePhotographerBySlug Hook

**Files:**
- Create: `apps/web/src/hooks/usePhotographerBySlug.ts`

- [ ] **Step 1: Create the hook**

Queries Firestore for a photographer by `bookingSlug`, then fetches their active packages ordered by `sortOrder`. Returns `{ data, isLoading, error }`. Uses the web SDK modular API.

```tsx
// apps/web/src/hooks/usePhotographerBySlug.ts
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Photographer, ServicePackage } from "@shotready/shared";

export interface PackageWithId extends ServicePackage {
  id: string;
}

export interface PhotographerData {
  id: string;
  photographer: Photographer;
  packages: PackageWithId[];
}

export function usePhotographerBySlug(slug: string | undefined) {
  const [data, setData] = useState<PhotographerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setError("Invalid booking link");
      return;
    }

    async function load() {
      try {
        const photoQuery = query(
          collection(db, "photographers"),
          where("bookingSlug", "==", slug),
        );
        const photoSnap = await getDocs(photoQuery);

        if (photoSnap.empty) {
          setError("This booking link isn't valid. Please check with your photographer.");
          setIsLoading(false);
          return;
        }

        const photoDoc = photoSnap.docs[0];
        const photographer = photoDoc.data() as Photographer;

        const pkgQuery = query(
          collection(db, "packages"),
          where("photographerId", "==", photoDoc.id),
          where("isActive", "==", true),
          orderBy("sortOrder"),
        );
        const pkgSnap = await getDocs(pkgQuery);
        const packages = pkgSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PackageWithId[];

        setData({ id: photoDoc.id, photographer, packages });
      } catch {
        setError("Failed to load booking page. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [slug]);

  return { data, isLoading, error };
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/web/src/hooks/usePhotographerBySlug.ts`
Expected: file exists

---

### Task 2: PackageCard and BookingDatePicker Components

**Files:**
- Create: `apps/web/src/components/PackageCard.tsx`
- Create: `apps/web/src/components/BookingDatePicker.tsx`

- [ ] **Step 1: Create PackageCard component**

Renders a selectable package card with name, price, description, deliverables checklist, and estimated duration. Selected state shows accent border + tinted background.

```tsx
// apps/web/src/components/PackageCard.tsx
import { Check, Clock } from "lucide-react";

interface PackageCardProps {
  name: string;
  description: string;
  price: number;
  deliverables: string[];
  estimatedDuration: number;
  isSelected: boolean;
  onSelect: () => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

export function PackageCard({
  name,
  description,
  price,
  deliverables,
  estimatedDuration,
  isSelected,
  onSelect,
}: PackageCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
        isSelected
          ? "border-accent bg-accent/5"
          : "border-border bg-surface hover:border-text-muted"
      }`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{name}</h3>
        <span className="text-lg font-bold text-accent">{formatPrice(price)}</span>
      </div>
      {description && (
        <p className="text-sm text-text-secondary mt-1 line-clamp-2">{description}</p>
      )}
      <ul className="mt-3 space-y-1">
        {deliverables.map((d, i) => (
          <li key={i} className="flex items-center text-sm text-text-secondary">
            <Check size={14} className="text-success mr-2 shrink-0" />
            {d}
          </li>
        ))}
      </ul>
      <div className="flex items-center mt-3 text-xs text-text-muted">
        <Clock size={12} className="mr-1" />
        Approx. {formatDuration(estimatedDuration)}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create BookingDatePicker component**

A 60-day calendar grid starting from today. Shows month navigation, Monday-start week, grays out unavailable dates (outside photographer's availability windows or blocked), highlights selected date with accent.

```tsx
// apps/web/src/components/BookingDatePicker.tsx
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailabilityWindow } from "@shotready/shared";

interface BookingDatePickerProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  availabilityWindows: AvailabilityWindow[];
  blockedDates: string[];
}

function getDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDateAvailable(
  date: Date,
  today: Date,
  maxDate: Date,
  windows: AvailabilityWindow[],
  blocked: string[],
): boolean {
  if (date < today || date > maxDate) return false;
  if (blocked.includes(getDateStr(date))) return false;
  const day = date.getDay();
  return windows.some((w) => w.dayOfWeek === day);
}

export function BookingDatePicker({
  selectedDate,
  onSelectDate,
  availabilityWindows,
  blockedDates,
}: BookingDatePickerProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 60);
    return d;
  }, [today]);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const todayStr = getDateStr(today);

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const result: { date: Date; dateStr: string; inMonth: boolean; available: boolean }[] = [];

    for (let i = 0; i < startOffset; i++) {
      const d = new Date(viewYear, viewMonth, 1 - startOffset + i);
      result.push({ date: d, dateStr: getDateStr(d), inMonth: false, available: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      const available = isDateAvailable(d, today, maxDate, availabilityWindows, blockedDates);
      result.push({ date: d, dateStr: getDateStr(d), inMonth: true, available });
    }

    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewYear, viewMonth + 1, i);
        result.push({ date: d, dateStr: getDateStr(d), inMonth: false, available: false });
      }
    }

    return result;
  }, [viewYear, viewMonth, availabilityWindows, blockedDates, today, maxDate]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  function handlePrev() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function handleNext() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={handlePrev} disabled={!canGoPrev} className="p-1 rounded hover:bg-surface-raised disabled:opacity-30">
          <ChevronLeft size={20} className="text-text-secondary" />
        </button>
        <span className="text-sm font-medium text-text-primary">{monthLabel}</span>
        <button type="button" onClick={handleNext} disabled={!canGoNext} className="p-1 rounded hover:bg-surface-raised disabled:opacity-30">
          <ChevronRight size={20} className="text-text-secondary" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          return (
            <button
              type="button"
              key={i}
              disabled={!cell.available}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`h-9 rounded-lg text-sm transition-colors
                ${!cell.inMonth ? "text-text-muted/30" : ""}
                ${cell.inMonth && !cell.available ? "text-text-muted" : ""}
                ${cell.available && !isSelected ? "text-text-primary hover:bg-surface-raised" : ""}
                ${isSelected ? "bg-accent text-white font-semibold" : ""}
                ${isToday && !isSelected ? "ring-1 ring-accent" : ""}
              `}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify both files exist**

Run: `ls apps/web/src/components/PackageCard.tsx apps/web/src/components/BookingDatePicker.tsx`
Expected: both files exist

---

### Task 3: BookingForm Page

**Files:**
- Modify: `apps/web/src/pages/BookingForm.tsx`

**Depends on:** Tasks 1–2

- [ ] **Step 1: Read existing BookingForm**

Read: `apps/web/src/pages/BookingForm.tsx`

Current: placeholder with slug display.

- [ ] **Step 2: Rewrite BookingForm with full implementation**

Replace the entire file. The form has 5 sections matching the spec, client-side validation, and direct Firestore write for submission (temporary until Cloud Functions). On success, shows an inline confirmation.

```tsx
// apps/web/src/pages/BookingForm.tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { usePhotographerBySlug } from "../hooks/usePhotographerBySlug";
import { PackageCard } from "../components/PackageCard";
import { BookingDatePicker } from "../components/BookingDatePicker";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-white text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus";

export default function BookingForm() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error: loadError } = usePhotographerBySlug(slug);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    accessCode: "",
    accessNotes: "",
    selectedDate: null as string | null,
    selectedPackageId: null as string | null,
    agentNotes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "This field is required";
    if (!form.email.trim()) errs.email = "This field is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Please enter a valid email address";
    if (!form.address.trim()) errs.address = "This field is required";
    if (!form.city.trim()) errs.city = "This field is required";
    if (!form.state.trim()) errs.state = "This field is required";
    if (!form.zip.trim()) errs.zip = "This field is required";
    if (!form.selectedDate) errs.selectedDate = "Please select a date";
    if (!form.selectedPackageId) errs.selectedPackageId = "Please select a package";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!data) return;

    setSubmitting(true);
    setErrors({});

    try {
      const selectedPkg = data.packages.find((p) => p.id === form.selectedPackageId)!;
      const agentToken = crypto.randomUUID();

      await addDoc(collection(db, "bookings"), {
        photographerId: data.id,
        status: "pending",
        agentToken,
        agent: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
        },
        property: {
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          lat: 0,
          lng: 0,
          accessCode: form.accessCode.trim() || null,
          accessNotes: form.accessNotes.trim() || null,
          orientation: null,
        },
        schedule: {
          requestedDate: Timestamp.fromDate(new Date(form.selectedDate + "T12:00:00")),
          confirmedDate: null,
          startTime: null,
          estimatedDuration: selectedPkg.estimatedDuration,
        },
        package: {
          packageId: form.selectedPackageId,
          name: selectedPkg.name,
          price: selectedPkg.price,
          deliverables: selectedPkg.deliverables,
        },
        shotList: selectedPkg.shotListTemplate.map((label) => ({
          label,
          isCompleted: false,
          completedAt: null,
        })),
        shooting: { startedAt: null, completedAt: null },
        proofing: {
          sentAt: null,
          viewedAt: null,
          completedAt: null,
          approvedAll: null,
          selectedCount: null,
        },
        delivery: { deliveredAt: null, downloadToken: null },
        invoiceId: null,
        photographerNotes: null,
        agentNotes: form.agentNotes.trim() || null,
        reminderSentAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle size={48} className="text-error mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-text-primary">
            {loadError ?? "Something went wrong"}
          </h1>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 size={56} className="text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary">
            Your booking request has been submitted!
          </h1>
          <p className="text-text-secondary mt-3">
            You'll receive an email at <strong>{form.email}</strong> when{" "}
            {data.photographer.businessName} responds.
          </p>
          <p className="text-sm text-text-muted mt-2">
            {data.photographer.businessName} typically responds within a few hours.
          </p>
        </div>
      </div>
    );
  }

  const { photographer, packages } = data;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-[600px] space-y-8"
        noValidate
      >
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            Book a Shoot with {photographer.businessName}
          </h1>
        </div>

        {/* Section 1: Your Information */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Your Information
          </h2>
          <FormField label="Your name" required error={errors.name}>
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              maxLength={100}
            />
          </FormField>
          <FormField label="Email address" required error={errors.email}>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              maxLength={254}
            />
          </FormField>
          <FormField label="Phone number" error={errors.phone}>
            <input
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              maxLength={20}
            />
          </FormField>
          <FormField label="Brokerage / Company" error={errors.company}>
            <input
              type="text"
              className={inputClass}
              value={form.company}
              onChange={(e) => updateField("company", e.target.value)}
              maxLength={100}
            />
          </FormField>
        </section>

        {/* Section 2: Property Details */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Property Details
          </h2>
          <FormField label="Property address" required error={errors.address}>
            <input
              type="text"
              className={inputClass}
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="123 Main St"
            />
          </FormField>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3">
              <FormField label="City" required error={errors.city}>
                <input
                  type="text"
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </FormField>
            </div>
            <div className="col-span-1">
              <FormField label="State" required error={errors.state}>
                <input
                  type="text"
                  className={inputClass}
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  maxLength={2}
                  placeholder="TX"
                />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="ZIP" required error={errors.zip}>
                <input
                  type="text"
                  className={inputClass}
                  value={form.zip}
                  onChange={(e) => updateField("zip", e.target.value)}
                  maxLength={10}
                />
              </FormField>
            </div>
          </div>
          <FormField label="Access code (gate, lockbox)">
            <input
              type="text"
              className={inputClass}
              value={form.accessCode}
              onChange={(e) => updateField("accessCode", e.target.value)}
            />
          </FormField>
          <FormField label="Access notes">
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={form.accessNotes}
              onChange={(e) => updateField("accessNotes", e.target.value)}
              placeholder="Key under mat, call on arrival, etc."
            />
          </FormField>
        </section>

        {/* Section 3: Preferred Date */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Preferred Date
          </h2>
          <div className="bg-surface rounded-xl p-4 border border-border">
            <BookingDatePicker
              selectedDate={form.selectedDate}
              onSelectDate={(date) => { updateField("selectedDate", date); setForm((prev) => ({ ...prev, selectedDate: date })); }}
              availabilityWindows={photographer.availability.windows}
              blockedDates={photographer.availability.blockedDates}
            />
          </div>
          {errors.selectedDate && (
            <p className="text-xs text-error">{errors.selectedDate}</p>
          )}
        </section>

        {/* Section 4: Select a Package */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Select a Package
          </h2>
          <div className={`grid gap-3 ${packages.length >= 2 ? "sm:grid-cols-2" : ""}`}>
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                name={pkg.name}
                description={pkg.description}
                price={pkg.price}
                deliverables={pkg.deliverables}
                estimatedDuration={pkg.estimatedDuration}
                isSelected={form.selectedPackageId === pkg.id}
                onSelect={() => { updateField("selectedPackageId", pkg.id); setForm((prev) => ({ ...prev, selectedPackageId: pkg.id })); }}
              />
            ))}
          </div>
          <p className="text-xs text-text-muted">
            Not sure which to pick? Choose the closest option — your photographer can adjust after booking.
          </p>
          {errors.selectedPackageId && (
            <p className="text-xs text-error">{errors.selectedPackageId}</p>
          )}
        </section>

        {/* Section 5: Additional Notes */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Anything Else?
          </h2>
          <FormField label="Notes for your photographer">
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={form.agentNotes}
              onChange={(e) => updateField("agentNotes", e.target.value)}
              maxLength={500}
              placeholder="Anything your photographer should know? Special requests, specific rooms to highlight, staging details..."
            />
          </FormField>
        </section>

        {/* Submit */}
        {errors.submit && (
          <div className="flex items-center gap-2 text-sm text-error bg-error/10 rounded-lg p-3">
            <AlertCircle size={16} />
            {errors.submit}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-base hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={20} className="animate-spin mx-auto" />
          ) : (
            "Submit Booking Request"
          )}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify changes**

Run: `grep -c "usePhotographerBySlug\|PackageCard\|BookingDatePicker" apps/web/src/pages/BookingForm.tsx`
Expected: multiple matches

---

### Task 4: Typecheck + Commit

**Depends on:** All previous tasks

- [ ] **Step 1: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors. Fix any type issues before committing.

- [ ] **Step 2: Stage and commit**

```bash
git add apps/web/src/hooks/usePhotographerBySlug.ts apps/web/src/components/PackageCard.tsx apps/web/src/components/BookingDatePicker.tsx apps/web/src/pages/BookingForm.tsx docs/superpowers/plans/2026-05-08-agent-booking-form.md
git commit -m "feat: add agent booking form with package selection and date picker

- usePhotographerBySlug hook fetches photographer + active packages by slug
- PackageCard component with selectable radio-style cards
- BookingDatePicker with 60-day window and availability-aware date grid
- Full 5-section booking form with client-side validation
- Direct Firestore write for submission (Cloud Function replacement deferred)
- Success confirmation page with email notification messaging"
```

- [ ] **Step 3: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible

---

## Deferred Features

| Feature | Spec Section | Reason |
|---------|-------------|--------|
| Cloud Function `booking-create` | 11 — Submission Flow | Requires spec 03 (Cloud Functions) |
| Google Places Autocomplete | 11 — Address field | Requires API key + JS SDK setup |
| Confirmation email via SendGrid | 11 — Confirmation Email | Requires spec 19 (Notifications) |
| Agent token redirect to `/b/:token` | 11 — Success Page | Success shown inline for now |
| Photographer logo in header | 11 — Page Layout | Requires Cloud Storage URL + branding setup |
| Duplicate prevention | 11 — Duplicate Prevention | Button disables on click (sufficient for v1) |
| Address geocoding | 11 — Server-Side validation | Requires Google Geocoding API in Cloud Function |
