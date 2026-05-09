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
              onSelectDate={(date) => updateField("selectedDate", date)}
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
                onSelect={() => updateField("selectedPackageId", pkg.id)}
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
