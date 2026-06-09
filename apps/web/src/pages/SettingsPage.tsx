import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePhotographer } from "../hooks/usePhotographer";
import { usePackages, type PackageWithId } from "../hooks/usePackages";
import { AuthLayout } from "../components/AuthLayout";
import {
  Save, Plus, Trash2, Edit2, X, Check, Copy, ExternalLink,
  CheckCircle2, Circle, AlertTriangle, RotateCcw,
} from "lucide-react";
import { NextStepCard } from "../components/ux/NextStepCard";
import { useTour } from "../components/ux/AppTour";
import type { Photographer, AvailabilityWindow } from "@shotready/shared";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function parsePriceToCents(value: string): number {
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <AuthLayout activePage="settings">
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-heading text-3xl font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Manage your profile, packages, and availability.
        </p>

        {user && <SettingsContent uid={user.uid} />}
      </main>
    </AuthLayout>
  );
}

function SettingsContent({ uid }: { uid: string }) {
  const { photographer, loading: profLoading, updatePhotographer } = usePhotographer(uid);
  const { packages, loading: pkgLoading, addPackage, updatePackage, removePackage } = usePackages(uid);

  if (profLoading || pkgLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-shimmer h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  const hasProfile = !!(photographer?.businessName && photographer?.bookingSlug);
  const hasPackages = packages.some((p) => p.isActive);
  const hasAvailability = (photographer?.availability?.windows?.length ?? 0) > 0;
  const allComplete = hasProfile && hasPackages && hasAvailability;

  const steps = [
    { label: "Business Profile", done: hasProfile },
    { label: "Service Package", done: hasPackages },
    { label: "Availability", done: hasAvailability },
  ];
  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-10">
      {/* Setup Checklist — UX-001, UX-002, UX-004 */}
      {!allComplete ? (
        <div className="bg-card border border-border rounded-lg p-5 animate-slide-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Setup Checklist
            </h2>
            <span className="text-xs text-muted-foreground">
              {completedCount} of {steps.length} complete
            </span>
          </div>
          <div className="space-y-2.5">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-2.5">
                {step.done ? (
                  <CheckCircle2 size={16} className="text-success shrink-0" />
                ) : (
                  <Circle size={16} className="text-muted-foreground shrink-0" />
                )}
                <span className={`text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            Complete all three to activate your booking link for agents.
          </p>
        </div>
      ) : (
        <NextStepCard
          title="You're all set!"
          description="Your booking link is live. Copy it from your Dashboard and share it with agents to start receiving bookings."
          href="/dashboard"
          actionLabel="Go to Dashboard"
          icon={<CheckCircle2 size={20} className="text-success" />}
        />
      )}

      <ProfileSection photographer={photographer} uid={uid} onSave={updatePhotographer} />
      <BookingLinkSection photographer={photographer} hasPackages={hasPackages} hasAvailability={hasAvailability} />
      <PackagesSection packages={packages} uid={uid} onAdd={addPackage} onUpdate={updatePackage} onRemove={removePackage} />
      <AvailabilitySection photographer={photographer} uid={uid} onSave={updatePhotographer} />
      <ReplayTourSection />
    </div>
  );
}

/* ── Profile Section ── */

function ProfileSection({
  photographer, uid, onSave,
}: {
  photographer: Photographer | null;
  uid: string;
  onSave: (uid: string, updates: Partial<Photographer>) => Promise<void>;
}) {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingSlug, setBookingSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (photographer) {
      setBusinessName(photographer.businessName || "");
      setEmail(photographer.email || "");
      setPhone(photographer.phone || "");
      setBookingSlug(photographer.bookingSlug || "");
    }
  }, [photographer]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const slug = bookingSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    await onSave(uid, {
      businessName,
      email,
      phone: phone || null,
      bookingSlug: slug,
      onboardingComplete: true,
    });
    setBookingSlug(slug);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-card border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors";

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Business Profile
      </h2>
      <form onSubmit={handleSave} className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              placeholder="Your Photography Business"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Booking Slug
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground shrink-0">/book/</span>
              <input
                type="text"
                value={bookingSlug}
                onChange={(e) => setBookingSlug(e.target.value)}
                required
                placeholder="your-name"
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="text-sm text-success flex items-center gap-1">
              <Check size={14} /> Saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ── Booking Link Section ── */

function BookingLinkSection({ photographer, hasPackages, hasAvailability }: { photographer: Photographer | null; hasPackages: boolean; hasAvailability: boolean }) {
  const [copied, setCopied] = useState(false);
  const slug = photographer?.bookingSlug;
  const bookingUrl = slug ? `https://shotready-001.web.app/book/${slug}` : null;

  function handleCopy() {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Booking Link
      </h2>
      <div className="bg-card border border-border rounded-lg p-5">
        {bookingUrl ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-secondary rounded-md px-3 py-2.5 text-sm text-foreground truncate font-mono">
              {bookingUrl}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2.5 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:opacity-90 transition-opacity shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set a booking slug in your profile above to generate your booking link.
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Share this link with real estate agents. They'll be able to pick a package, choose a date, and submit a booking request.
        </p>

        {/* Prerequisite warnings — UX-002 */}
        {bookingUrl && (!hasPackages || !hasAvailability) && (
          <div className="flex items-start gap-2.5 mt-3 p-3 rounded-md bg-warning/8 border border-warning/20">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Your booking link is set, but agents also need{" "}
              {!hasPackages && !hasAvailability
                ? "at least one active package and your availability configured"
                : !hasPackages
                  ? "at least one active package"
                  : "your availability configured"}{" "}
              before they can book.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Packages Section ── */

function PackagesSection({
  packages, uid, onAdd, onUpdate, onRemove,
}: {
  packages: PackageWithId[];
  uid: string;
  onAdd: (uid: string, pkg: any) => Promise<void>;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Service Packages ({packages.length})
        </h2>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
        >
          <Plus size={14} /> Add Package
        </button>
      </div>

      {showForm && (
        <PackageForm
          uid={uid}
          existing={editingId ? packages.find((p) => p.id === editingId) : undefined}
          sortOrder={packages.length}
          onSave={async (data) => {
            if (editingId) {
              await onUpdate(editingId, data);
            } else {
              await onAdd(uid, data);
            }
            setShowForm(false);
            setEditingId(null);
          }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}

      {packages.length === 0 && !showForm && (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No packages yet. Create packages that agents can choose from when booking.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Create Your First Package
          </button>
        </div>
      )}

      <div className="space-y-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-card border border-border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">{pkg.name}</h3>
                <span className="text-sm font-semibold text-accent">{formatPrice(pkg.price)}</span>
                {!pkg.isActive && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{pkg.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{pkg.estimatedDuration} min</span>
                <span>{pkg.deliverables.length} deliverables</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setEditingId(pkg.id); setShowForm(true); }}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${pkg.name}"?`)) onRemove(pkg.id);
                }}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PackageForm({
  uid, existing, sortOrder, onSave, onCancel,
}: {
  uid: string;
  existing?: PackageWithId;
  sortOrder: number;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState(existing ? (existing.price / 100).toString() : "");
  const [duration, setDuration] = useState(existing?.estimatedDuration?.toString() ?? "60");
  const [deliverables, setDeliverables] = useState(existing?.deliverables?.join("\n") ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full px-3 py-2.5 bg-card border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name,
      description,
      price: parsePriceToCents(price),
      estimatedDuration: parseInt(duration, 10) || 60,
      deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
      shotListTemplate: [],
      isActive,
      sortOrder: existing?.sortOrder ?? sortOrder,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-accent/30 rounded-lg p-5 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {existing ? "Edit Package" : "New Package"}
        </h3>
        <button type="button" onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Package Name
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Standard Package" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Price ($)
            </label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0" step="1" placeholder="250" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Duration (min)
            </label>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required min="15" step="15" className={inputClass} />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          Description
        </label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Brief description of what's included" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          Deliverables (one per line)
        </label>
        <textarea
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          rows={3}
          placeholder={"25 edited photos\nVirtual tour\nFloor plan"}
          className={inputClass + " resize-none"}
        />
      </div>
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-border accent-accent" />
          Active (visible to agents)
        </label>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving..." : existing ? "Update Package" : "Create Package"}
        </button>
      </div>
    </form>
  );
}

/* ── Replay Tour Section ── */

function ReplayTourSection() {
  const { startTour } = useTour();

  function handleReplay() {
    startTour();
    window.location.href = "/dashboard";
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Onboarding
      </h2>
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-xs text-muted-foreground mb-3">
          Re-run the guided tour to see what each section of the app does.
        </p>
        <button
          onClick={handleReplay}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors"
        >
          <RotateCcw size={14} />
          Replay App Tour
        </button>
      </div>
    </section>
  );
}

/* ── Availability Section ── */

function AvailabilitySection({
  photographer, uid, onSave,
}: {
  photographer: Photographer | null;
  uid: string;
  onSave: (uid: string, updates: Partial<Photographer>) => Promise<void>;
}) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (photographer?.availability?.windows) {
      setWindows(photographer.availability.windows);
    }
  }, [photographer]);

  function toggleDay(dayOfWeek: number) {
    const exists = windows.find((w) => w.dayOfWeek === dayOfWeek);
    if (exists) {
      setWindows(windows.filter((w) => w.dayOfWeek !== dayOfWeek));
    } else {
      setWindows([...windows, { dayOfWeek, startTime: "09:00", endTime: "17:00" }]
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    }
  }

  function updateWindow(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    setWindows(windows.map((w) => w.dayOfWeek === dayOfWeek ? { ...w, [field]: value } : w));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(uid, {
      availability: {
        windows,
        blockedDates: photographer?.availability?.blockedDates ?? [],
      },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Availability
      </h2>
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-xs text-muted-foreground mb-4">
          Select which days you're available and set your working hours. Agents will only be able to book within these windows.
        </p>

        {/* Day toggles */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {DAYS.map((day, i) => {
            const active = windows.some((w) => w.dayOfWeek === i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {DAYS_SHORT[i]}
              </button>
            );
          })}
        </div>

        {/* Time windows */}
        {windows.length > 0 && (
          <div className="space-y-3">
            {windows.map((w) => (
              <div key={w.dayOfWeek} className="flex items-center gap-3">
                <span className="text-sm text-foreground w-24 shrink-0">{DAYS[w.dayOfWeek]}</span>
                <input
                  type="time"
                  value={w.startTime}
                  onChange={(e) => updateWindow(w.dayOfWeek, "startTime", e.target.value)}
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md text-sm text-foreground"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="time"
                  value={w.endTime}
                  onChange={(e) => updateWindow(w.dayOfWeek, "endTime", e.target.value)}
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md text-sm text-foreground"
                />
              </div>
            ))}
          </div>
        )}

        {windows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No days selected. Click the days above to set your availability.
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-border">
          {saved && (
            <span className="text-sm text-success flex items-center gap-1">
              <Check size={14} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>
    </section>
  );
}
