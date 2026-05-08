import { View, Text } from "react-native";
import type { BookingStatus } from "@shotready/shared";

const STATUS_CONFIG: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: "bg-warning/15",       text: "text-warning",        label: "Pending" },
  confirmed: { bg: "bg-accent/15",        text: "text-accent",         label: "Confirmed" },
  shooting:  { bg: "bg-accent",           text: "text-white",          label: "Shooting" },
  editing:   { bg: "bg-info/15",          text: "text-info",           label: "Editing" },
  proofing:  { bg: "bg-warning/15",       text: "text-warning",        label: "Proofing" },
  delivered: { bg: "bg-success/15",       text: "text-success",        label: "Delivered" },
  invoiced:  { bg: "bg-accent/15",        text: "text-accent",         label: "Invoiced" },
  overdue:   { bg: "bg-error/15",         text: "text-error",          label: "Overdue" },
  paid:      { bg: "bg-success",          text: "text-white",          label: "Paid" },
  closed:    { bg: "bg-surface-raised",   text: "text-text-secondary", label: "Closed" },
  declined:  { bg: "bg-error/15",         text: "text-error",          label: "Declined" },
  cancelled: { bg: "bg-surface-raised",   text: "text-text-secondary", label: "Cancelled" },
};

interface StatusPillProps {
  status: BookingStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View className={`h-[24px] px-[10px] rounded-pill items-center justify-center ${config.bg}`}>
      <Text className={`text-small ${config.text}`}>{config.label}</Text>
    </View>
  );
}
