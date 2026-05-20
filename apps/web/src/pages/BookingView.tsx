import { useParams } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  Camera,
  XCircle,
  Archive,
  AlertCircle,
  WifiOff,
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
        <div className="space-y-4 py-12">
          <div className="h-6 rounded-md w-3/4 mx-auto animate-shimmer" />
          <div className="h-4 rounded-md w-1/2 mx-auto animate-shimmer" />
          <div className="grid grid-cols-3 gap-2 mt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-md animate-shimmer"
              />
            ))}
          </div>
        </div>
      </ShellLayout>
    );
  }

  if (gallery.error || !gallery.data) {
    const errorMsg = gallery.error ?? "";
    const isNotFound =
      errorMsg.includes("not found") ||
      errorMsg.includes("invalid") ||
      errorMsg.includes("Invalid");
    const isNetwork =
      errorMsg.includes("network") ||
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("INTERNAL");

    if (isNetwork) {
      return (
        <ShellLayout branding={null}>
          <StatusMessageCard
            icon={WifiOff}
            iconColor="hsl(var(--destructive))"
            heading="Unable to load"
            body="Please check your connection and try again."
          />
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-600 tracking-[0.05em] uppercase hover:opacity-90 transition-opacity"
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
          iconColor="hsl(var(--destructive))"
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
            iconColor="hsl(var(--warning))"
            heading="Your booking request has been submitted!"
            body={`You'll receive an email when ${data.booking.photographerName} responds.`}
            imageUrl="/images/feature-exterior.jpg"
            imageAlt="Modern home with pool"
          />
          <PropertySummaryCard address={address} packageName={packageName} />
        </>
      );

    case "confirmed":
      return (
        <>
          <StatusMessageCard
            icon={CheckCircle}
            iconColor="hsl(var(--success))"
            heading="Shoot confirmed!"
            body={`${data.booking.photographerName} has confirmed your booking.`}
            imageUrl="/images/hero-twilight.jpg"
            imageAlt="Luxury home at twilight"
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
            iconColor="hsl(var(--accent))"
            heading="Photos in progress"
            body="Your photographer is working on your photos. You'll receive an email when they're ready for review."
            imageUrl="/images/feature-interior.jpg"
            imageAlt="Bright modern kitchen"
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
          iconColor="hsl(var(--destructive))"
          heading="Booking declined"
          body="This booking was not accepted. Please contact your photographer directly for more information."
        />
      );

    case "cancelled":
      return (
        <>
          <StatusMessageCard
            icon={XCircle}
            iconColor="hsl(var(--muted-foreground))"
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
            iconColor="hsl(var(--muted-foreground))"
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
          iconColor="hsl(var(--muted-foreground))"
          heading="Your Booking"
          body={`Current status: ${status}`}
        />
      );
  }
}
