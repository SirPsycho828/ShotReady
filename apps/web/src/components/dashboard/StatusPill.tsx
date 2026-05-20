import type { BookingStatus } from "@shotready/shared";

const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-warning/15", text: "text-warning" },
  confirmed: { label: "Confirmed", bg: "bg-success/15", text: "text-success" },
  shooting: { label: "Shooting", bg: "bg-accent/15", text: "text-accent" },
  editing: { label: "Editing", bg: "bg-accent/15", text: "text-accent" },
  proofing: { label: "Proofing", bg: "bg-muted", text: "text-muted-foreground" },
  delivered: { label: "Delivered", bg: "bg-success/15", text: "text-success" },
  invoiced: { label: "Invoiced", bg: "bg-muted", text: "text-muted-foreground" },
  overdue: { label: "Overdue", bg: "bg-destructive/15", text: "text-destructive" },
  paid: { label: "Paid", bg: "bg-success/15", text: "text-success" },
  closed: { label: "Closed", bg: "bg-muted", text: "text-muted-foreground" },
  declined: { label: "Declined", bg: "bg-destructive/15", text: "text-destructive" },
  cancelled: { label: "Cancelled", bg: "bg-muted", text: "text-muted-foreground" },
};

export function StatusPill({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide uppercase ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
