const STATUS_TEXT: Record<string, string> = {
  pending: "Booking request submitted",
  confirmed: "Shoot confirmed",
  shooting: "Photos in progress",
  editing: "Photos in progress",
  proofing: "Ready for your review",
  delivered: "Photos ready for download",
  invoiced: "Photos ready — invoice attached",
  overdue: "Photos ready — payment due",
  paid: "Complete — paid",
  closed: "Archived",
  cancelled: "Cancelled",
};

export function getStatusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}
