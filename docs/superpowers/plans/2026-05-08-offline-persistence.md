# Offline Persistence + Notes Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app connectivity-aware — block online-only actions when offline, show syncing state after reconnection, and give clear feedback when notes are saved offline.

**Architecture:** A shared `useConnectivity` hook wraps `@react-native-community/netinfo` to provide `isOnline` state. The existing `OfflineBar` gains a "syncing" state (blue bar) that appears when transitioning from offline to online, using Firestore's `waitForPendingWrites()`. `BookingActions` disables status-transition buttons when offline with a cloud-off indicator. The notes editor in the booking detail screen shows "Saved offline" feedback when saving while disconnected.

**Tech Stack:** @react-native-community/netinfo, @react-native-firebase/firestore, react-native-reanimated, lucide-react-native

---

## File Structure

```
apps/mobile/src/
├── hooks/
│   └── useConnectivity.ts              # Create — shared connectivity hook
├── components/
│   └── ui/
│       └── OfflineBar.tsx              # Modify — add syncing state
│   └── booking/
│       └── BookingActions.tsx          # Modify — disable actions when offline
├── app/
│   └── booking/
│       └── [id].tsx                    # Modify — offline notes save feedback
```

## Parallelization Notes

Task 1 (useConnectivity) is a dependency for Tasks 2–4.
Tasks 2, 3, 4 are independent of each other once Task 1 exists.
Task 5 depends on all.

---

### Task 1: useConnectivity Hook

**Files:**
- Create: `apps/mobile/src/hooks/useConnectivity.ts`

- [ ] **Step 1: Create useConnectivity hook**

Wraps `useNetInfo` from `@react-native-community/netinfo`. Returns a simple `{ isOnline }` object. Treats `null` (initial state during SDK initialization) as online to avoid a flash of "offline" on app start.

```tsx
// apps/mobile/src/hooks/useConnectivity.ts
import { useNetInfo } from "@react-native-community/netinfo";

export function useConnectivity() {
  const netInfo = useNetInfo();
  // netInfo.isConnected is boolean | null (null during initialization)
  // Treat null as online (optimistic) to avoid false offline indicators on startup
  const isOnline = netInfo.isConnected !== false;
  return { isOnline };
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/hooks/useConnectivity.ts`
Expected: file exists

---

### Task 2: OfflineBar Syncing State

**Files:**
- Modify: `apps/mobile/src/components/ui/OfflineBar.tsx`

**Depends on:** Task 1 (useConnectivity)

- [ ] **Step 1: Read existing OfflineBar**

Read: `apps/mobile/src/components/ui/OfflineBar.tsx`

Current behavior: uses `useNetInfo` directly, shows yellow pulse bar when `isConnected === false`, returns null when online.

- [ ] **Step 2: Rewrite OfflineBar with syncing state**

Replace the entire file. Changes:
1. Use `useConnectivity` instead of `useNetInfo` directly
2. Track `wasOffline` ref to detect offline→online transition
3. On reconnection, show blue "syncing" bar and call `firestore().waitForPendingWrites()`
4. Clear syncing state when writes are acknowledged (or after 5s timeout fallback)

```tsx
// apps/mobile/src/components/ui/OfflineBar.tsx
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/hooks/useConnectivity";
import firestore from "@react-native-firebase/firestore";

export function OfflineBar() {
  const { isOnline } = useConnectivity();
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOffline = useRef(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      opacity.value = withRepeat(
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setIsSyncing(true);
      opacity.value = 1;

      const timeout = setTimeout(() => setIsSyncing(false), 5000);
      firestore()
        .waitForPendingWrites()
        .then(() => {
          clearTimeout(timeout);
          setIsSyncing(false);
        })
        .catch(() => {
          clearTimeout(timeout);
          setIsSyncing(false);
        });
    } else {
      opacity.value = 1;
    }
  }, [isOnline, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (isOnline && !isSyncing) return null;

  return (
    <Animated.View
      className={`h-[3px] w-full ${isSyncing ? "bg-accent" : "bg-warning"}`}
      style={animatedStyle}
    />
  );
}
```

- [ ] **Step 3: Verify file saved**

Run: `cat apps/mobile/src/components/ui/OfflineBar.tsx | head -5`
Expected: shows the new imports including `useConnectivity`

---

### Task 3: Block Online-Only Actions When Offline

**Files:**
- Modify: `apps/mobile/src/components/booking/BookingActions.tsx`

**Depends on:** Task 1 (useConnectivity)

- [ ] **Step 1: Read existing BookingActions**

Read: `apps/mobile/src/components/booking/BookingActions.tsx`

Current behavior: all transition buttons are always interactive (no connectivity check).

- [ ] **Step 2: Rewrite BookingActions with offline blocking**

Replace the entire file. Changes:
1. Import `useConnectivity` and `CloudOff` icon
2. All transition buttons get `disabled={!isOnline || transitioning}`
3. When offline, show a small cloud-off indicator below the action buttons area
4. Info text sections (editing, proofing, delivered, invoiced/overdue) remain unchanged — they're read-only
5. Per spec: "Button appears in disabled state with a small offline indicator (cloud-off icon, 16px, textMuted). No toast or modal."

```tsx
// apps/mobile/src/components/booking/BookingActions.tsx
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useConnectivity } from "@/hooks/useConnectivity";
import type { BookingWithId } from "@/hooks/useBookings";
import { CloudOff } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import firestore from "@react-native-firebase/firestore";

interface BookingActionsProps {
  booking: BookingWithId;
}

export function BookingActions({ booking }: BookingActionsProps) {
  const { transitioning, error, transition, clearError } = useBookingTransition();
  const { isOnline } = useConnectivity();
  const router = useRouter();
  const isDisabled = !isOnline || transitioning;

  async function handleApprove() {
    const success = await transition(booking.id, booking.status, "confirmed", {
      "schedule.confirmedDate": booking.schedule.requestedDate,
    });
    if (success) router.back();
  }

  function handleDecline() {
    Alert.alert("Decline Booking", `Decline this booking from ${booking.agent.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          const success = await transition(booking.id, booking.status, "declined");
          if (success) router.back();
        },
      },
    ]);
  }

  function handleCancel() {
    Alert.alert("Cancel Booking", `Cancel this booking at ${booking.property.address.split(",")[0]}?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Booking",
        style: "destructive",
        onPress: async () => {
          const success = await transition(booking.id, booking.status, "cancelled");
          if (success) router.back();
        },
      },
    ]);
  }

  async function handleStartShoot() {
    await transition(booking.id, booking.status, "shooting", {
      "shooting.startedAt": firestore.FieldValue.serverTimestamp(),
    });
  }

  async function handleCompleteShoot() {
    await transition(booking.id, booking.status, "editing", {
      "shooting.completedAt": firestore.FieldValue.serverTimestamp(),
    });
  }

  async function handleCloseJob() {
    const success = await transition(booking.id, booking.status, "closed");
    if (success) router.back();
  }

  const hasActionButton =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "shooting" ||
    booking.status === "paid";

  return (
    <View>
      {error && (
        <Text className="text-small text-error mb-sm text-center">{error}</Text>
      )}

      {booking.status === "pending" && (
        <View>
          <Button title="Approve Booking" onPress={handleApprove} disabled={isDisabled} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Decline" variant="destructive" onPress={handleDecline} disabled={isDisabled} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "confirmed" && (
        <View>
          <Button title="Start Shoot" onPress={handleStartShoot} disabled={isDisabled} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Cancel Booking" variant="ghost" onPress={handleCancel} disabled={isDisabled} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "shooting" && (
        <Button title="Complete Shoot" onPress={handleCompleteShoot} disabled={isDisabled} loading={transitioning} />
      )}

      {booking.status === "editing" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Upload photos via the web companion, then send to proofing.
          </Text>
        </View>
      )}

      {booking.status === "proofing" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Waiting for agent to review and select photos.
          </Text>
        </View>
      )}

      {booking.status === "delivered" && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Photos delivered. Invoice management coming soon.
          </Text>
        </View>
      )}

      {(booking.status === "invoiced" || booking.status === "overdue") && (
        <View className="py-md items-center">
          <Text className="text-body text-text-secondary text-center">
            Awaiting payment from agent.
          </Text>
        </View>
      )}

      {booking.status === "paid" && (
        <Button title="Close Job" variant="secondary" onPress={handleCloseJob} disabled={isDisabled} loading={transitioning} />
      )}

      {!isOnline && hasActionButton && (
        <View className="flex-row items-center justify-center mt-sm">
          <CloudOff size={14} color={darkColors.textMuted} />
          <Text className="text-small text-text-muted ml-xs">
            Actions unavailable offline
          </Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Verify file saved**

Run: `grep -c "useConnectivity" apps/mobile/src/components/booking/BookingActions.tsx`
Expected: 2 (import + usage)

---

### Task 4: Offline Notes Save Feedback

**Files:**
- Modify: `apps/mobile/src/app/booking/[id].tsx`

**Depends on:** Task 1 (useConnectivity)

- [ ] **Step 1: Read existing booking detail screen**

Read: `apps/mobile/src/app/booking/[id].tsx`

Current behavior: notes save on blur via Firestore `.update()`. Shows "Unsaved changes" while dirty. No connectivity awareness.

- [ ] **Step 2: Add offline save feedback**

Add `useConnectivity` import and a `savedWhileOffline` state. After saving notes while offline, show "Saved offline — will sync when connected" in warning color. Clear the indicator when back online.

The full modified file:

```tsx
// apps/mobile/src/app/booking/[id].tsx
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState, useEffect } from "react";
import { useBookings } from "@/hooks/useBookings";
import { useConnectivity } from "@/hooks/useConnectivity";
import { StatusPill } from "@/components/ui";
import { PropertyInfo } from "@/components/booking/PropertyInfo";
import { AgentInfo } from "@/components/booking/AgentInfo";
import { ScheduleInfo } from "@/components/booking/ScheduleInfo";
import { BookingActions } from "@/components/booking/BookingActions";
import { darkColors } from "@/theme/colors";
import { ArrowLeft } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bookings, isLoading } = useBookings();
  const { isOnline } = useConnectivity();
  const booking = bookings.find((b) => b.id === id);

  const [notes, setNotes] = useState(booking?.photographerNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);
  const [savedWhileOffline, setSavedWhileOffline] = useState(false);

  useEffect(() => {
    if (isOnline) setSavedWhileOffline(false);
  }, [isOnline]);

  async function saveNotes() {
    if (!id || notesSaved) return;
    await firestore().collection("bookings").doc(id).update({
      photographerNotes: notes.trim() || null,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    setNotesSaved(true);
    setSavedWhileOffline(!isOnline);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-body text-text-secondary">Loading...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-lg">
        <Text className="text-h2 text-text-primary">Booking not found</Text>
        <Text className="text-body text-text-secondary mt-sm">
          This booking may have been archived.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-lg">
          <Text className="text-body text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerClassName="pb-2xl" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="px-lg pt-xl pb-md">
          <Pressable onPress={() => router.back()} className="flex-row items-center mb-md">
            <ArrowLeft size={20} color={darkColors.textPrimary} />
            <Text className="text-body text-text-primary ml-xs">Back</Text>
          </Pressable>

          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-sm">
              <Text className="text-h1 text-text-primary">
                {getStreetAddress(booking.property.address)}
              </Text>
              <Text className="text-body text-text-secondary mt-xs">
                {booking.agent.name}
              </Text>
            </View>
            <StatusPill status={booking.status} />
          </View>
        </View>

        {/* Info sections */}
        <View className="px-lg">
          <View className="mb-md">
            <ScheduleInfo
              requestedDate={booking.schedule.requestedDate}
              confirmedDate={booking.schedule.confirmedDate}
              startTime={booking.schedule.startTime}
              estimatedDuration={booking.schedule.estimatedDuration}
              packageName={booking.package.name}
              packagePrice={booking.package.price}
              deliverables={booking.package.deliverables}
            />
          </View>

          <View className="mb-md">
            <PropertyInfo
              address={booking.property.address}
              city={booking.property.city}
              state={booking.property.state}
              zip={booking.property.zip}
              accessCode={booking.property.accessCode}
              accessNotes={booking.property.accessNotes}
              orientation={booking.property.orientation}
            />
          </View>

          <View className="mb-md">
            <AgentInfo
              name={booking.agent.name}
              email={booking.agent.email}
              phone={booking.agent.phone}
              company={booking.agent.company}
            />
          </View>

          {/* Agent notes (from booking form) */}
          {booking.agentNotes && (
            <View className="mb-md bg-surface border border-border rounded-card p-md">
              <Text className="text-caption text-text-muted mb-xs">Agent Notes</Text>
              <Text className="text-body text-text-secondary">{booking.agentNotes}</Text>
            </View>
          )}

          {/* Photographer notes (editable) */}
          <View className="mb-lg bg-surface border border-border rounded-card p-md">
            <Text className="text-caption text-text-muted mb-xs">Your Notes</Text>
            <TextInput
              className="text-body text-text-primary min-h-[60px]"
              value={notes}
              onChangeText={(t) => { setNotes(t); setNotesSaved(false); setSavedWhileOffline(false); }}
              onBlur={saveNotes}
              placeholder="Add private notes about this booking..."
              placeholderTextColor={darkColors.textMuted}
              multiline
              textAlignVertical="top"
            />
            {!notesSaved && (
              <Text className="text-small text-text-muted mt-xs">Unsaved changes</Text>
            )}
            {notesSaved && savedWhileOffline && (
              <Text className="text-small text-warning mt-xs">Saved offline — will sync when connected</Text>
            )}
          </View>

          {/* Actions */}
          <BookingActions booking={booking} />
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Verify changes**

Run: `grep -c "useConnectivity\|savedWhileOffline" apps/mobile/src/app/booking/\[id\].tsx`
Expected: 6 (import + hook call + useEffect + setSavedWhileOffline x2 + render check)

---

### Task 5: Typecheck + Commit

**Depends on:** All previous tasks

- [ ] **Step 1: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. Fix any type issues before committing.

- [ ] **Step 2: Stage and commit**

```bash
git add apps/mobile/src/hooks/useConnectivity.ts apps/mobile/src/components/ui/OfflineBar.tsx apps/mobile/src/components/booking/BookingActions.tsx apps/mobile/src/app/booking/\[id\].tsx docs/superpowers/plans/2026-05-08-offline-persistence.md
git commit -m "feat: add offline persistence with connectivity-aware actions

- useConnectivity hook wrapping @react-native-community/netinfo
- OfflineBar gains syncing state (blue bar) on reconnection via waitForPendingWrites
- BookingActions disables status transitions when offline with cloud-off indicator
- Notes save shows 'Saved offline' feedback when saving while disconnected"
```

- [ ] **Step 3: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible

---

## Deferred Features

| Feature | Spec Section | Reason |
|---------|-------------|--------|
| "Prep My Day" pre-fetch flow | 05 — Pre-Fetch Strategy | Existing onSnapshot already caches 50 bookings; explicit pre-fetch adds UX value but not technical necessity for v1 |
| Background refresh every 30 min | 05 — Cache Freshness | Can be added when Field Mode (spec 13) is built |
| Stale data "Last updated X min ago" caption | 05 — Per-Action Indicators | Requires tracking refresh timestamps in hooks |
| Shot list offline writes | 05 — Allowed Offline | Shot list UI not built yet (spec 13) |
| Route plan pre-fetch | 05 — Tier 1 Data | Route feature not built yet (spec 12) |
| Online-only action blocking for future features (invoicing, photos) | 05 — Blocked Offline | Those features don't exist yet |
