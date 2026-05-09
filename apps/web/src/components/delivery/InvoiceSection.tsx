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
    <div className="border-t border-gray-200">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {isOverdue && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-sm">
              This invoice is past due. Please complete payment at your earliest
              convenience.
            </p>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Invoice
          </h2>

          <div className="text-sm text-gray-600 space-y-1 mb-6">
            <p>
              <span className="text-gray-400">From:</span>{" "}
              {data.booking.photographerName}
            </p>
            <p>
              <span className="text-gray-400">For:</span> {address} —
              Photography
            </p>
            {sentDate && (
              <p>
                <span className="text-gray-400">Date:</span> {sentDate}
              </p>
            )}
            {dueDate && (
              <p>
                <span className="text-gray-400">Due:</span> {dueDate}
              </p>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            {invoice.lineItems.map((item, i) => (
              <div
                key={i}
                className="flex justify-between px-4 py-3 border-b border-gray-100 last:border-b-0"
              >
                <span className="text-gray-700">{item.description}</span>
                <span className="text-gray-900 font-medium">
                  {formatDollars(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-gray-100 font-semibold">
              <span className="text-gray-700">Total</span>
              <span className="text-gray-900">
                {formatDollars(invoice.total)}
              </span>
            </div>
          </div>

          {isPaid ? (
            <div className="flex items-center justify-center gap-2 w-full py-4 rounded-lg bg-green-50 border border-green-200 text-green-700 font-semibold text-lg">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Paid{paidDate ? ` on ${paidDate}` : ""}
            </div>
          ) : invoice.paymentUrl ? (
            <a
              href={invoice.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-lg text-white font-semibold text-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              Pay {formatDollars(invoice.total)} Now
            </a>
          ) : null}
        </div>
      </main>
    </div>
  );
}
