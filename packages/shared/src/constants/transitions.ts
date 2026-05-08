import type { BookingStatus } from "./booking-status";

export const VALID_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "declined", "cancelled"],
  confirmed: ["shooting", "cancelled"],
  shooting: ["editing"],
  editing: ["proofing"],
  proofing: ["delivered"],
  delivered: ["invoiced"],
  invoiced: ["overdue", "paid"],
  overdue: ["paid"],
  paid: ["closed"],
  closed: [],
  declined: [],
  cancelled: [],
};

export function isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Status priority for dashboard "Needs Your Action" sort order.
 * Lower number = higher priority (shown first).
 */
export const STATUS_PRIORITY: Record<BookingStatus, number> = {
  pending: 0,
  overdue: 1,
  shooting: 2,
  editing: 3,
  delivered: 4,
  confirmed: 5,
  proofing: 6,
  invoiced: 7,
  paid: 8,
  closed: 9,
  declined: 10,
  cancelled: 11,
};
