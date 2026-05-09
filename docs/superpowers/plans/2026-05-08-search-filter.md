# Search + Filtering UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side search and quick-filter chips to the Jobs dashboard so the photographer can narrow the job list by date range or status, and search across property address, agent name, and agent email.

**Architecture:** A `FilterChipBar` component renders a horizontal ScrollView of pressable chips (All, Today, This Week, Pending, Overdue). The dashboard adds `activeFilter` and `searchQuery` state, filters the bookings array before the existing bucket-grouping logic, and renders a search icon in the header that expands to a TextInput. All filtering is client-side against the cached 50 bookings.

**Tech Stack:** React Native (ScrollView, TextInput, Pressable), NativeWind, lucide-react-native (Search, X icons)

---

## File Structure

```
apps/mobile/src/
├── components/
│   └── FilterChipBar.tsx               # Create — horizontal scrollable chip bar
├── app/
│   └── (tabs)/
│       └── index.tsx                   # Modify — add search + filter state and UI
```

## Parallelization Notes

Task 1 (FilterChipBar) is independent.
Task 2 (dashboard integration) depends on Task 1.
Task 3 (typecheck + commit) depends on all.

---

### Task 1: FilterChipBar Component

**Files:**
- Create: `apps/mobile/src/components/FilterChipBar.tsx`

- [ ] **Step 1: Create FilterChipBar component**

A horizontally scrollable row of pressable chips. The active chip has accent background with white text; inactive chips have surfaceRaised background with secondary text.

```tsx
// apps/mobile/src/components/FilterChipBar.tsx
import { ScrollView, Pressable, Text } from "react-native";

interface Chip {
  key: string;
  label: string;
}

interface FilterChipBarProps {
  chips: Chip[];
  activeChip: string;
  onSelect: (key: string) => void;
}

export function FilterChipBar({ chips, activeChip, onSelect }: FilterChipBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-sm"
    >
      {chips.map((chip) => {
        const isActive = chip.key === activeChip;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onSelect(chip.key)}
            className={`px-md py-xs rounded-pill ${isActive ? "bg-accent" : "bg-surface-raised"}`}
          >
            <Text
              className={`text-caption ${isActive ? "text-white" : "text-text-secondary"}`}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/components/FilterChipBar.tsx`
Expected: file exists

---

### Task 2: Dashboard Search + Filter Integration

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`

**Depends on:** Task 1 (FilterChipBar)

- [ ] **Step 1: Read existing dashboard**

Read: `apps/mobile/src/app/(tabs)/index.tsx`

Current: SectionList with three-bucket grouping, no search or filter. Header shows "Jobs" title.

- [ ] **Step 2: Rewrite dashboard with search and filter**

Replace the entire file. Changes from current:
1. Import `FilterChipBar`, `Search` icon, `X` icon, `TextInput`
2. Add `activeFilter` state (string, default "all")
3. Add `searchQuery` state (string, default "")
4. Add `searchActive` state (boolean, default false)
5. Define `FILTER_CHIPS` array
6. Add `filteredBookings` useMemo that applies filter + search before bucket grouping
7. Change existing bucket grouping to use `filteredBookings` instead of `bookings`
8. Replace `ListHeaderComponent` with header that includes search toggle + FilterChipBar
9. Add empty state for "no results" when filters/search produce zero bookings

```tsx
// apps/mobile/src/app/(tabs)/index.tsx
import { View, Text, SectionList, RefreshControl, Pressable, TextInput } from "react-native";
import { useState, useMemo, useCallback, useRef } from "react";
import { useBookings, type BookingWithId } from "@/hooks/useBookings";
import { usePhotographer } from "@/hooks/usePhotographer";
import { BookingCard } from "@/components/BookingCard";
import { FilterChipBar } from "@/components/FilterChipBar";
import { SkeletonLoader, Button } from "@/components/ui";
import { darkColors } from "@/theme/colors";
import { Briefcase, ChevronDown, ChevronRight, Search, X } from "lucide-react-native";
import {
  PHOTOGRAPHER_ACTION_STATUSES,
  WAITING_ON_OTHERS_STATUSES,
  COMPLETED_STATUSES,
} from "@shotready/shared/src/constants/booking-status";
import * as Clipboard from "expo-clipboard";

const ACTION_PRIORITY: Record<string, number> = {
  pending: 0,
  overdue: 1,
  shooting: 2,
  editing: 3,
  delivered: 4,
  confirmed: 5,
};

const FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
];

function sortActionBucket(a: BookingWithId, b: BookingWithId): number {
  const pa = ACTION_PRIORITY[a.status] ?? 99;
  const pb = ACTION_PRIORITY[b.status] ?? 99;
  if (pa !== pb) return pa - pb;
  return a.updatedAt.seconds - b.updatedAt.seconds;
}

function sortWaitingBucket(a: BookingWithId, b: BookingWithId): number {
  return b.updatedAt.seconds - a.updatedAt.seconds;
}

function sortCompletedBucket(a: BookingWithId, b: BookingWithId): number {
  return b.updatedAt.seconds - a.updatedAt.seconds;
}

function getDateStr(seconds: number): string {
  const d = new Date(seconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isThisWeek(seconds: number): boolean {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  const bookingDate = new Date(seconds * 1000);
  return bookingDate >= monday && bookingDate < sunday;
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
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (activeFilter === "today") {
      const today = getTodayStr();
      result = result.filter((b) => {
        const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
        return getDateStr(ts.seconds) === today;
      });
    } else if (activeFilter === "thisWeek") {
      result = result.filter((b) => {
        const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
        return isThisWeek(ts.seconds);
      });
    } else if (activeFilter === "pending") {
      result = result.filter((b) => b.status === "pending");
    } else if (activeFilter === "overdue") {
      result = result.filter((b) => b.status === "overdue");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.property.address.toLowerCase().includes(q) ||
          b.agent.name.toLowerCase().includes(q) ||
          b.agent.email.toLowerCase().includes(q),
      );
    }

    return result;
  }, [bookings, activeFilter, searchQuery]);

  const { actionItems, waitingItems, completedItems } = useMemo(() => {
    const action: BookingWithId[] = [];
    const waiting: BookingWithId[] = [];
    const completed: BookingWithId[] = [];

    for (const b of filteredBookings) {
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
  }, [filteredBookings]);

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
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  async function handleCopyLink() {
    if (!photographer?.bookingSlug) return;
    await Clipboard.setStringAsync(`https://shotready.app/book/${photographer.bookingSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenSearch() {
    setSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }

  function handleCloseSearch() {
    setSearchActive(false);
    setSearchQuery("");
  }

  const isFiltered = activeFilter !== "all" || searchQuery.trim().length > 0;
  const noResults = isFiltered && filteredBookings.length === 0;

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
        sections={noResults ? [] : sections}
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
          <View className="pt-lg mb-md">
            {/* Header row: title or search input + search toggle */}
            <View className="flex-row items-center justify-between mb-md">
              {searchActive ? (
                <View className="flex-1 flex-row items-center bg-surface-raised rounded-input px-sm h-[40px]">
                  <Search size={18} color={darkColors.textMuted} />
                  <TextInput
                    ref={searchInputRef}
                    className="flex-1 text-body text-text-primary ml-sm"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search address, agent..."
                    placeholderTextColor={darkColors.textMuted}
                    returnKeyType="search"
                    autoCapitalize="none"
                  />
                  <Pressable onPress={handleCloseSearch} hitSlop={8}>
                    <X size={18} color={darkColors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text className="text-h2 text-text-primary">Jobs</Text>
                  <Pressable onPress={handleOpenSearch} hitSlop={8}>
                    <Search size={22} color={darkColors.textSecondary} />
                  </Pressable>
                </>
              )}
            </View>

            {/* Filter chips */}
            <FilterChipBar
              chips={FILTER_CHIPS}
              activeChip={activeFilter}
              onSelect={setActiveFilter}
            />
          </View>
        }
        ListEmptyComponent={
          noResults ? (
            <View className="items-center py-2xl">
              <Search size={48} color={darkColors.textMuted} strokeWidth={1.25} />
              <Text className="text-body text-text-secondary mt-md text-center">
                No jobs match your search
              </Text>
              <Pressable
                onPress={() => { setActiveFilter("all"); setSearchQuery(""); setSearchActive(false); }}
                className="mt-sm"
              >
                <Text className="text-body text-accent">Clear filters</Text>
              </Pressable>
            </View>
          ) : null
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

- [ ] **Step 3: Verify changes**

Run: `grep -c "FilterChipBar\|searchQuery\|activeFilter" apps/mobile/src/app/\(tabs\)/index.tsx`
Expected: multiple matches

---

### Task 3: Typecheck + Commit

**Depends on:** All previous tasks

- [ ] **Step 1: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. Fix any type issues before committing.

- [ ] **Step 2: Stage and commit**

```bash
git add apps/mobile/src/components/FilterChipBar.tsx apps/mobile/src/app/\(tabs\)/index.tsx docs/superpowers/plans/2026-05-08-search-filter.md
git commit -m "feat: add search and quick-filter chips to jobs dashboard

- FilterChipBar component with All/Today/This Week/Pending/Overdue chips
- Client-side search across property address, agent name, agent email
- Search icon in header expands to inline TextInput
- Filters narrow bookings before bucket grouping
- No-results empty state with clear-filters action"
```

- [ ] **Step 3: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible

---

## Deferred Features

| Feature | Spec Section | Reason |
|---------|-------------|--------|
| Notification bell in header | 08 — Notification Bell | Requires spec 19 (Notifications) |
| Card swipe actions | 08 — Card Swipe Actions | Requires react-native-gesture-handler swipeable setup |
| Bucket transition animations | 08 — Bucket Transition Animation | Requires Reanimated layout animations, polish item |
| "View all" link on completed section | 08 — Completed bucket | Requires a full history screen |
