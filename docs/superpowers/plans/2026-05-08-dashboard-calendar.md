# Dashboard + Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Jobs dashboard (three-bucket booking list with status grouping) and the Calendar tab (monthly grid with day detail panel).

**Architecture:** A shared `useBookings` hook provides a real-time Firestore listener on the photographer's bookings (limit 50, ordered by `updatedAt`). The dashboard groups these into three buckets (Needs Action, Waiting, Completed) using existing status constants. The calendar filters the same data by month and renders a custom monthly grid with booking dot indicators plus a day detail panel showing that day's shoots. A reusable `BookingCard` component is shared between dashboard and calendar day detail.

**Tech Stack:** Expo Router, NativeWind, @react-native-firebase/firestore, react-native-reanimated (existing), lucide-react-native (existing)

---

## File Structure

```
apps/mobile/src/
├── hooks/
│   └── useBookings.ts              # Create — real-time subscription to bookings
├── components/
│   ├── BookingCard.tsx              # Create — tappable card for a single booking
│   ├── MonthlyGrid.tsx             # Create — calendar month grid with dot indicators
│   └── DayDetail.tsx               # Create — selected day's shoots panel
├── app/
│   └── (tabs)/
│       ├── _layout.tsx             # Modify — add headerShown:false to Jobs/Calendar
│       ├── index.tsx               # Modify — full dashboard with three-bucket layout
│       └── calendar.tsx            # Modify — calendar grid + day detail
```

## Parallelization Notes

Tasks 1–2 (hook + BookingCard) are independent — dispatch in parallel or sequentially.
Task 3 (dashboard) depends on Tasks 1–2.
Tasks 4–5 (MonthlyGrid + DayDetail) depend on Task 2 (BookingCard for DayDetail).
Task 6 (calendar screen) depends on Tasks 1, 4, 5.
Task 7 (tab layout + typecheck + commit) depends on all.

---

### Task 1: useBookings Hook

**Files:**
- Create: `apps/mobile/src/hooks/useBookings.ts`

- [ ] **Step 1: Create useBookings hook**

Real-time Firestore listener on the photographer's bookings. Returns all bookings (limit 50) with document IDs attached. Client-side consumers do their own filtering/grouping.

```tsx
// apps/mobile/src/hooks/useBookings.ts
import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Booking } from "@shotready/shared";

export interface BookingWithId extends Booking {
  id: string;
}

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("bookings")
      .where("photographerId", "==", user.uid)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          setBookings(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingWithId),
          );
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user]);

  return { bookings, isLoading };
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/hooks/useBookings.ts`
Expected: file exists

---

### Task 2: BookingCard Component

**Files:**
- Create: `apps/mobile/src/components/BookingCard.tsx`

- [ ] **Step 1: Create BookingCard component**

Tappable card displaying a booking's key info: property address, status pill, agent name, date, and a chevron. Used by both the dashboard and calendar day detail. The `compact` prop renders a smaller variant for the calendar (no chevron, tighter spacing).

```tsx
// apps/mobile/src/components/BookingCard.tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Card, StatusPill } from "@/components/ui";
import { ChevronRight } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import type { BookingWithId } from "@/hooks/useBookings";

function formatDate(ts: { seconds: number }): string {
  const d = new Date(ts.seconds * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

interface BookingCardProps {
  booking: BookingWithId;
  compact?: boolean;
}

export function BookingCard({ booking, compact = false }: BookingCardProps) {
  const router = useRouter();

  const date = booking.schedule.confirmedDate ?? booking.schedule.requestedDate;
  const street = getStreetAddress(booking.property.address);

  return (
    <Pressable
      onPress={() => router.push(`/booking/${booking.id}`)}
      className="active:opacity-85"
    >
      <Card className={compact ? "py-sm px-md" : ""}>
        <View className="flex-row items-start justify-between">
          <Text
            className={`${compact ? "text-body" : "text-h3"} text-text-primary flex-1 mr-sm`}
            numberOfLines={1}
          >
            {street}
          </Text>
          <StatusPill status={booking.status} />
        </View>
        <View className="flex-row items-center justify-between mt-xs">
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            {booking.agent.name}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-caption text-text-secondary">
              {formatDate(date)}
            </Text>
            {!compact && (
              <ChevronRight
                size={18}
                color={darkColors.textMuted}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/components/BookingCard.tsx`
Expected: file exists

---

### Task 3: Dashboard Screen (Jobs Tab)

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`

**Depends on:** Tasks 1–2 (useBookings, BookingCard)

- [ ] **Step 1: Replace placeholder Jobs screen with full dashboard**

Read the current `index.tsx` first, then replace with the three-bucket dashboard. Uses SectionList for the bucket layout. Groups bookings client-side using the status constants from `@shotready/shared`. Includes empty states (no bookings, all caught up) and pull-to-refresh.

```tsx
// apps/mobile/src/app/(tabs)/index.tsx
import { View, Text, SectionList, RefreshControl, Pressable } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { useBookings, type BookingWithId } from "@/hooks/useBookings";
import { usePhotographer } from "@/hooks/usePhotographer";
import { BookingCard } from "@/components/BookingCard";
import { SkeletonLoader, Card, Button } from "@/components/ui";
import { darkColors } from "@/theme/colors";
import { Briefcase, ChevronDown, ChevronRight, Copy } from "lucide-react-native";
import {
  PHOTOGRAPHER_ACTION_STATUSES,
  WAITING_ON_OTHERS_STATUSES,
  COMPLETED_STATUSES,
} from "@shotready/shared/src/constants/booking-status";
import * as Clipboard from "expo-clipboard";

type BookingStatus = BookingWithId["status"];

const ACTION_PRIORITY: Record<string, number> = {
  pending: 0,
  overdue: 1,
  shooting: 2,
  editing: 3,
  delivered: 4,
  confirmed: 5,
};

function sortActionBucket(a: BookingWithId, b: BookingWithId): number {
  const pa = ACTION_PRIORITY[a.status] ?? 99;
  const pb = ACTION_PRIORITY[b.status] ?? 99;
  if (pa !== pb) return pa - pb;
  // Within same status, oldest first (ascending by updatedAt)
  return a.updatedAt.seconds - b.updatedAt.seconds;
}

function sortWaitingBucket(a: BookingWithId, b: BookingWithId): number {
  // Most recently updated first
  return b.updatedAt.seconds - a.updatedAt.seconds;
}

function sortCompletedBucket(a: BookingWithId, b: BookingWithId): number {
  // Most recently completed first
  return b.updatedAt.seconds - a.updatedAt.seconds;
}

interface Section {
  title: string;
  count: number;
  data: BookingWithId[];
  collapsed?: boolean;
}

export default function JobsScreen() {
  const { bookings, isLoading } = useBookings();
  const { photographer } = usePhotographer();
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  const { actionItems, waitingItems, completedItems } = useMemo(() => {
    const action: BookingWithId[] = [];
    const waiting: BookingWithId[] = [];
    const completed: BookingWithId[] = [];

    for (const b of bookings) {
      if ((PHOTOGRAPHER_ACTION_STATUSES as readonly string[]).includes(b.status)) {
        action.push(b);
      } else if ((WAITING_ON_OTHERS_STATUSES as readonly string[]).includes(b.status)) {
        waiting.push(b);
      } else if ((COMPLETED_STATUSES as readonly string[]).includes(b.status)) {
        completed.push(b);
      }
    }

    action.sort(sortActionBucket);
    waiting.sort(sortWaitingBucket);
    completed.sort(sortCompletedBucket);

    return {
      actionItems: action,
      waitingItems: waiting,
      completedItems: completed.slice(0, 30),
    };
  }, [bookings]);

  const sections: Section[] = useMemo(() => {
    const s: Section[] = [
      { title: "Needs Your Action", count: actionItems.length, data: actionItems },
      { title: "Waiting on Others", count: waitingItems.length, data: waitingItems },
    ];
    if (completedItems.length > 0) {
      s.push({
        title: "Completed",
        count: completedItems.length,
        data: showCompleted ? completedItems : [],
        collapsed: !showCompleted,
      });
    }
    return s;
  }, [actionItems, waitingItems, completedItems, showCompleted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Firestore listener auto-refreshes; brief delay for UX feedback
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  async function handleCopyLink() {
    if (!photographer?.bookingSlug) return;
    await Clipboard.setStringAsync(`https://shotready.app/book/${photographer.bookingSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-lg pt-lg">
        <View className="flex-row items-center justify-between mb-lg">
          <Text className="text-h2 text-text-primary">Jobs</Text>
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} className="mb-md">
            <SkeletonLoader height={80} borderRadius={12} />
          </View>
        ))}
      </View>
    );
  }

  // Empty state: no bookings at all
  if (bookings.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-lg">
        <Briefcase size={64} color={darkColors.textMuted} strokeWidth={1.25} />
        <Text className="text-h2 text-text-primary mt-lg">No bookings yet</Text>
        <Text className="text-body text-text-secondary mt-sm text-center">
          Share your booking link with agents to get started
        </Text>
        <View className="mt-lg w-full">
          <Button
            title={copied ? "Copied!" : "Copy Booking Link"}
            variant={copied ? "secondary" : "primary"}
            onPress={handleCopyLink}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-lg pb-2xl"
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={darkColors.accent}
            colors={[darkColors.accent]}
          />
        }
        ListHeaderComponent={
          <View className="flex-row items-center justify-between pt-lg mb-md">
            <Text className="text-h2 text-text-primary">Jobs</Text>
          </View>
        }
        renderSectionHeader={({ section }) => {
          if (section.title === "Completed") {
            return (
              <Pressable
                className="flex-row items-center mt-lg mb-sm"
                onPress={() => setShowCompleted(!showCompleted)}
              >
                <Text className="text-h3 text-text-secondary">
                  {section.title} ({section.count})
                </Text>
                {showCompleted ? (
                  <ChevronDown size={18} color={darkColors.textSecondary} style={{ marginLeft: 4 }} />
                ) : (
                  <ChevronRight size={18} color={darkColors.textSecondary} style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            );
          }
          return (
            <View className="mt-lg mb-sm">
              <Text className="text-h3 text-text-primary">
                {section.title} ({section.count})
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <View className="mb-sm">
            <BookingCard booking={item} />
          </View>
        )}
        renderSectionFooter={({ section }) => {
          if (section.title === "Needs Your Action" && section.data.length === 0) {
            return (
              <Text className="text-body text-text-secondary py-md text-center">
                You're all caught up
              </Text>
            );
          }
          if (section.title === "Waiting on Others" && section.data.length === 0) {
            return (
              <Text className="text-body text-text-muted py-md text-center">
                No jobs waiting
              </Text>
            );
          }
          return null;
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verify file updated**

Run: `head -5 apps/mobile/src/app/\(tabs\)/index.tsx`
Expected: includes SectionList import

---

### Task 4: MonthlyGrid Component

**Files:**
- Create: `apps/mobile/src/components/MonthlyGrid.tsx`

- [ ] **Step 1: Create MonthlyGrid component**

Custom calendar grid. 7 columns, Monday-start. Swipe or tap arrows to change month. Shows booking dot indicators (blue for confirmed, yellow for pending). Today gets an accent circle. Selected day gets a raised background. Blocked dates get a gray background.

```tsx
// apps/mobile/src/components/MonthlyGrid.tsx
import { View, Text, Pressable } from "react-native";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { darkColors, statusColors } from "@/theme/colors";
import type { BookingWithId } from "@/hooks/useBookings";
import type { BookingStatus } from "@shotready/shared/src/constants/booking-status";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthlyGridProps {
  year: number;
  month: number; // 0-indexed
  selectedDate: string | null; // "YYYY-MM-DD"
  bookings: BookingWithId[];
  blockedDates: string[];
  onSelectDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

interface DayDots {
  blue: number;
  yellow: number;
}

function buildDotMap(bookings: BookingWithId[], year: number, month: number): Map<string, DayDots> {
  const map = new Map<string, DayDots>();
  for (const b of bookings) {
    const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
    const d = new Date(ts.seconds * 1000);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const key = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    const dots = map.get(key) ?? { blue: 0, yellow: 0 };
    if (b.status === "pending") {
      dots.yellow++;
    } else {
      dots.blue++;
    }
    map.set(key, dots);
  }
  return map;
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-start: Mon=0, Tue=1, ..., Sun=6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete the last week
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MonthlyGrid({
  year,
  month,
  selectedDate,
  bookings,
  blockedDates,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: MonthlyGridProps) {
  const todayStr = getTodayStr();
  const cells = useMemo(() => getCalendarDays(year, month), [year, month]);
  const dotMap = useMemo(() => buildDotMap(bookings, year, month), [bookings, year, month]);
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);

  return (
    <View>
      {/* Month header */}
      <View className="flex-row items-center justify-between px-lg py-md">
        <Pressable onPress={onPrevMonth} className="p-xs">
          <ChevronLeft size={24} color={darkColors.textPrimary} />
        </Pressable>
        <Text className="text-h3 text-text-primary">
          {MONTHS[month]} {year}
        </Text>
        <Pressable onPress={onNextMonth} className="p-xs">
          <ChevronRight size={24} color={darkColors.textPrimary} />
        </Pressable>
      </View>

      {/* Day labels */}
      <View className="flex-row px-sm">
        {DAY_LABELS.map((label) => (
          <View key={label} className="flex-1 items-center py-xs">
            <Text className="text-small text-text-muted">{label}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View className="flex-row flex-wrap px-sm">
        {cells.map((day, i) => {
          if (day === null) {
            return <View key={`empty-${i}`} className="w-[14.28%] h-[48px]" />;
          }

          const dateStr = toDateStr(year, month, day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isBlocked = blockedSet.has(dateStr);
          const dots = dotMap.get(dateStr);

          return (
            <Pressable
              key={dateStr}
              className="w-[14.28%] h-[48px] items-center justify-center"
              onPress={() => onSelectDate(dateStr)}
            >
              <View
                className={`w-[36px] h-[36px] items-center justify-center rounded-full ${
                  isSelected
                    ? isToday
                      ? "bg-accent"
                      : "bg-surface-raised"
                    : isToday
                      ? "border-2 border-accent"
                      : isBlocked
                        ? "bg-surface-raised"
                        : ""
                }`}
              >
                <Text
                  className={`text-body ${
                    isSelected && isToday
                      ? "text-white"
                      : isSelected
                        ? "text-text-primary"
                        : isToday
                          ? "text-accent"
                          : isBlocked
                            ? "text-text-muted"
                            : "text-text-primary"
                  }`}
                >
                  {day}
                </Text>
              </View>
              {/* Dots */}
              {dots && (
                <View className="flex-row absolute bottom-[2px]">
                  {dots.blue > 0 && (
                    <View
                      className="w-[5px] h-[5px] rounded-full mx-[1px]"
                      style={{ backgroundColor: darkColors.accent }}
                    />
                  )}
                  {dots.yellow > 0 && (
                    <View
                      className="w-[5px] h-[5px] rounded-full mx-[1px]"
                      style={{ backgroundColor: statusColors.warning }}
                    />
                  )}
                  {(dots.blue + dots.yellow > 2) && (
                    <View
                      className="w-[5px] h-[5px] rounded-full mx-[1px]"
                      style={{ backgroundColor: darkColors.textMuted }}
                    />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/components/MonthlyGrid.tsx`
Expected: file exists

---

### Task 5: DayDetail Component

**Files:**
- Create: `apps/mobile/src/components/DayDetail.tsx`

**Depends on:** Task 2 (BookingCard)

- [ ] **Step 1: Create DayDetail component**

Shows the selected day's shoots in chronological order. Confirmed bookings get a blue left border; pending bookings get a yellow left border and dashed card border. Groups pending separately at top. Shows empty states.

```tsx
// apps/mobile/src/components/DayDetail.tsx
import { View, Text } from "react-native";
import { useMemo } from "react";
import { BookingCard } from "@/components/BookingCard";
import type { BookingWithId } from "@/hooks/useBookings";
import type { AvailabilityWindow } from "@shotready/shared";

const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DayDetailProps {
  dateStr: string; // "YYYY-MM-DD"
  bookings: BookingWithId[];
  availabilityWindows: AvailabilityWindow[];
  blockedDates: string[];
}

function parseTime(time: string | null): number {
  if (!time) return 9999;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}hr`;
  return `${hrs}hr ${mins}m`;
}

export function DayDetail({ dateStr, bookings, availabilityWindows, blockedDates }: DayDetailProps) {
  const date = new Date(dateStr + "T12:00:00"); // noon to avoid timezone shift
  const dayName = FULL_DAYS[date.getDay()];
  const monthName = MONTHS[date.getMonth()];
  const dayNum = date.getDate();

  const { pending, confirmed } = useMemo(() => {
    const p: BookingWithId[] = [];
    const c: BookingWithId[] = [];
    for (const b of bookings) {
      if (b.status === "pending") p.push(b);
      else c.push(b);
    }
    c.sort((a, b) => parseTime(a.schedule.startTime) - parseTime(b.schedule.startTime));
    return { pending: p, confirmed: c };
  }, [bookings]);

  const isBlocked = blockedDates.includes(dateStr);
  const dayOfWeek = date.getDay(); // 0=Sun
  const isAvailable = availabilityWindows.some((w) => w.dayOfWeek === dayOfWeek);

  return (
    <View className="px-lg pt-md">
      {/* Day header */}
      <Text className="text-h3 text-text-primary">
        {dayName}, {monthName} {dayNum}
      </Text>
      <Text className="text-caption text-text-secondary mt-xs">
        {bookings.length} shoot{bookings.length !== 1 ? "s" : ""}
      </Text>

      {/* Pending requests */}
      {pending.length > 0 && (
        <View className="mt-md">
          <Text className="text-caption text-warning mb-sm">
            Pending Requests ({pending.length})
          </Text>
          {pending.map((b) => (
            <View key={b.id} className="mb-sm border-l-[3px] border-warning pl-sm">
              <BookingCard booking={b} compact />
            </View>
          ))}
        </View>
      )}

      {/* Confirmed shoots */}
      {confirmed.length > 0 && (
        <View className="mt-md">
          {confirmed.map((b) => (
            <View key={b.id} className="mb-sm border-l-[3px] border-accent pl-sm">
              <View className="flex-row items-center mb-xs">
                {b.schedule.startTime && (
                  <Text className="text-caption text-accent mr-sm">
                    {formatTime12(b.schedule.startTime)}
                  </Text>
                )}
                <Text className="text-caption text-text-muted">
                  {formatDuration(b.schedule.estimatedDuration)}
                </Text>
              </View>
              <BookingCard booking={b} compact />
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {bookings.length === 0 && (
        <View className="mt-lg items-center">
          <Text className="text-body text-text-secondary">No shoots scheduled</Text>
          <Text className="text-caption text-text-muted mt-xs">
            {isBlocked
              ? "This date is blocked"
              : isAvailable
                ? "Available for bookings"
                : "Not available"}
          </Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/components/DayDetail.tsx`
Expected: file exists

---

### Task 6: Calendar Screen

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/calendar.tsx`

**Depends on:** Tasks 1, 4, 5 (useBookings, MonthlyGrid, DayDetail)

- [ ] **Step 1: Replace placeholder Calendar screen with full implementation**

Read the current `calendar.tsx` first, then replace. Combines MonthlyGrid + DayDetail. Defaults to today's date selected. Filters bookings by the currently viewed month. Gets availability windows and blocked dates from the photographer document.

```tsx
// apps/mobile/src/app/(tabs)/calendar.tsx
import { View, ScrollView } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { useBookings, type BookingWithId } from "@/hooks/useBookings";
import { usePhotographer } from "@/hooks/usePhotographer";
import { MonthlyGrid } from "@/components/MonthlyGrid";
import { DayDetail } from "@/components/DayDetail";
import { SkeletonLoader } from "@/components/ui";

function getTodayInfo() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    dateStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  };
}

function getBookingsForMonth(bookings: BookingWithId[], year: number, month: number): BookingWithId[] {
  return bookings.filter((b) => {
    const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
    const d = new Date(ts.seconds * 1000);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function getBookingsForDate(bookings: BookingWithId[], dateStr: string): BookingWithId[] {
  return bookings.filter((b) => {
    const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
    const d = new Date(ts.seconds * 1000);
    const bDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return bDateStr === dateStr;
  });
}

export default function CalendarScreen() {
  const today = getTodayInfo();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { photographer, isLoading: photographerLoading } = usePhotographer();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState(today.dateStr);

  const monthBookings = useMemo(
    () => getBookingsForMonth(bookings, year, month),
    [bookings, year, month],
  );

  const dayBookings = useMemo(
    () => (selectedDate ? getBookingsForDate(bookings, selectedDate) : []),
    [bookings, selectedDate],
  );

  const handlePrevMonth = useCallback(() => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const isLoading = bookingsLoading || photographerLoading;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-lg pt-lg">
        <SkeletonLoader height={280} borderRadius={12} />
        <View className="mt-md">
          <SkeletonLoader height={100} borderRadius={12} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-2xl">
      <MonthlyGrid
        year={year}
        month={month}
        selectedDate={selectedDate}
        bookings={monthBookings}
        blockedDates={photographer?.availability.blockedDates ?? []}
        onSelectDate={setSelectedDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      <View className="h-[1px] bg-border mx-lg mt-sm" />

      {selectedDate && (
        <DayDetail
          dateStr={selectedDate}
          bookings={dayBookings}
          availabilityWindows={photographer?.availability.windows ?? []}
          blockedDates={photographer?.availability.blockedDates ?? []}
        />
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify file updated**

Run: `head -5 apps/mobile/src/app/\(tabs\)/calendar.tsx`
Expected: includes ScrollView import

---

### Task 7: Tab Layout Update + Typecheck + Commit

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`

**Depends on:** All previous tasks

- [ ] **Step 1: Update tab layout headers**

Read the current `_layout.tsx` first. Set `headerShown: false` for the Jobs tab (it renders its own header) and the Calendar tab (grid acts as header). Keep Settings header.

```tsx
// apps/mobile/src/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Briefcase, Calendar, MapPin, Settings } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: darkColors.accent,
        tabBarInactiveTintColor: darkColors.textMuted,
        tabBarStyle: {
          backgroundColor: darkColors.background,
          borderTopColor: darkColors.border,
          height: 56,
        },
        headerStyle: {
          backgroundColor: darkColors.background,
        },
        headerTintColor: darkColors.textPrimary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: "Route",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. Fix any type issues before committing.

- [ ] **Step 3: Stage and commit**

```bash
git add apps/mobile/src/hooks/useBookings.ts apps/mobile/src/components/BookingCard.tsx apps/mobile/src/components/MonthlyGrid.tsx apps/mobile/src/components/DayDetail.tsx apps/mobile/src/app/\(tabs\)/index.tsx apps/mobile/src/app/\(tabs\)/calendar.tsx apps/mobile/src/app/\(tabs\)/_layout.tsx docs/superpowers/plans/2026-05-08-dashboard-calendar.md
git commit -m "feat: add jobs dashboard and calendar with monthly grid

- Three-bucket dashboard: Needs Action, Waiting on Others, Completed
- BookingCard component shared between dashboard and calendar
- Custom monthly grid with booking dot indicators and today highlight
- Day detail panel with chronological shoot cards
- Empty states for no bookings and caught-up dashboard
- Pull-to-refresh on dashboard
- useBookings real-time Firestore hook"
```

- [ ] **Step 4: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible

---

## Deferred Features

The following spec features are intentionally deferred from this plan:

| Feature | Spec Section | Reason |
|---------|-------------|--------|
| Swipe actions on job cards | 08 — Card Swipe Actions | Complex gesture handling, lower priority |
| Quick filter chips (All/Today/Week/Pending/Overdue) | 08 — Filter and Search | Polish feature, not core |
| Search (address/agent) | 08 — Filter and Search | Client-side search, add later |
| Notification bell | 08 — Notification Bell | Depends on 19_Notifications spec |
| Bucket transition animation | 08 — Bucket Transition Animation | Polish, add after core works |
| Calendar availability bottom sheet | 09 — Availability Management | Already accessible from Settings |
| Blocked dates management from calendar | 09 — Blocked Dates | Already accessible from Settings |
| Conflict detection | 09 — Conflict Detection | Depends on route optimization |
| Today quick actions (Optimize Route, Start Shoot Day) | 09 — Today Quick Actions | Depends on 12_Route_Optimization |
| Pending inline approve/decline from calendar | 09 — Pending Booking Indicators | Depends on 10_Booking_State_Machine |
| Booking detail screen (card tap destination) | 08 — Card Tap | Separate plan, depends on state machine |
