import { Check } from "lucide-react";
import type { ProofingData } from "../../hooks/useProofingGallery";

interface InvoiceSectionProps {
  data: ProofingData;
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function InvoiceSection({ data }: InvoiceSectionProps) {
  const invoice = data.invoice;
  if (!invoice) return null;

  const accentColor = data.booking.accentColor;
  const address = data.booking.address.split(",")[0];
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const sentDate = invoice.sentAt
    ? new Date(invoice.sentAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="border-t border-border mt-8 pt-8 animate-slide-in">
      {isOverdue && (
        <div className="bg-warning/10 border border-warning/30 rounded-md p-4 mb-6">
          <p className="text-warning text-sm font-500">
            This invoice is past due. Please complete payment at your earliest
            convenience.
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6 shadow-glow-sm">
        <h2 className="text-xs font-body font-500 tracking-[0.1em] uppercase text-muted-foreground mb-5">
          Invoice
        </h2>

        <div className="text-sm space-y-1.5 mb-6">
          <p>
            <span className="text-muted-foreground">From:</span>{" "}
            <span className="text-card-foreground font-500">
              {data.booking.photographerName}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">For:</span>{" "}
            <span className="text-card-foreground font-500">
              {address} — Photography
            </span>
          </p>
          {sentDate && (
            <p>
              <span className="text-muted-foreground">Date:</span>{" "}
              <span className="text-card-foreground">{sentDate}</span>
            </p>
          )}
          {dueDate && (
            <p>
              <span className="text-muted-foreground">Due:</span>{" "}
              <span className="text-card-foreground">{dueDate}</span>
            </p>
          )}
        </div>

        <div className="border border-border rounded-md overflow-hidden mb-6">
          {invoice.lineItems.map((item, i) => (
            <div
              key={i}
              className="flex justify-between px-4 py-3 border-b border-border/50 last:border-b-0"
            >
              <span className="text-card-foreground text-sm">
                {item.description}
              </span>
              <span className="text-card-foreground text-sm font-500 tabular-nums">
                {formatDollars(item.amount)}
              </span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 bg-secondary">
            <span className="text-secondary-foreground font-600 text-sm">
              Total
            </span>
            <span className="text-secondary-foreground font-600 text-sm tabular-nums">
              {formatDollars(invoice.total)}
            </span>
          </div>
        </div>

        {isPaid ? (
          <div className="flex items-center justify-center gap-2 w-full py-3.5 rounded-md bg-success/10 border border-success/30 text-success font-body text-sm font-600 tracking-[0.05em] uppercase">
            <Check size={18} />
            Paid{paidDate ? ` on ${paidDate}` : ""}
          </div>
        ) : invoice.paymentUrl ? (
          <a
            href={invoice.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-md text-white font-body text-sm font-600 tracking-[0.05em] uppercase transition-opacity hover:opacity-90 shadow-md"
            style={{ backgroundColor: accentColor }}
          >
            Pay {formatDollars(invoice.total)} Now
          </a>
        ) : null}
      </div>
    </div>
  );
}
