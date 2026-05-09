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
