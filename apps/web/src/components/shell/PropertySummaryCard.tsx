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
    <div className="bg-card border border-border rounded-lg p-5 mt-6 shadow-glow-sm">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground text-xs font-500 tracking-[0.04em] uppercase">
            Property
          </dt>
          <dd className="text-card-foreground font-500 text-right">
            {address}
          </dd>
        </div>
        {scheduledDate && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground text-xs font-500 tracking-[0.04em] uppercase">
              Scheduled
            </dt>
            <dd className="text-card-foreground font-500">{scheduledDate}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground text-xs font-500 tracking-[0.04em] uppercase">
            Package
          </dt>
          <dd className="text-card-foreground font-500">{packageName}</dd>
        </div>
        {photoCount != null && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground text-xs font-500 tracking-[0.04em] uppercase">
              Photos
            </dt>
            <dd className="text-card-foreground font-500">{photoCount}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
