# Booking Detail + Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the booking detail screen that opens when tapping a BookingCard, displaying status-specific content and primary action buttons that advance bookings through the state machine.

**Architecture:** A single dynamic route `app/booking/[id].tsx` loads the booking by ID from the existing `useBookings` hook and renders status-specific sections via a `BookingActions` component. Status transitions write directly to Firestore with optimistic UI updates (Cloud Function enforcement deferred). Info sections (`PropertyInfo`, `AgentInfo`, `ScheduleInfo`) are extracted into reusable components for the detail screen. A `useBookingTransition` hook encapsulates the Firestore update logic with loading/error state.

**Tech Stack:** Expo Router (dynamic route), NativeWind, @react-native-firebase/firestore, lucide-react-native, react-native-maps (deferred), existing shared types + transition constants

---

## File Structure

```
apps/mobile/src/
├── hooks/
│   └── useBookingTransition.ts       # Create — transition helper with loading/error
├── components/
│   ├── booking/
│   │   ├── PropertyInfo.tsx          # Create — property address, access code, notes
│   │   ├── AgentInfo.tsx             # Create — agent name, email, phone, company
│   │   ├── ScheduleInfo.tsx          # Create — date, time, duration, package
│   │   └── BookingActions.tsx        # Create — status-specific action buttons
├── app/
│   └── booking/
│       └── [id].tsx                  # Create — booking detail screen
```

## Parallelization Notes

Tasks 1–2 (hook + info components) are independent — dispatch sequentially.
Task 3 (BookingActions) depends on Task 1 (useBookingTransition).
Task 4 (detail screen) depends on Tasks 1–3.
Task 5 (typecheck + commit) depends on all.

---

### Task 1: useBookingTransition Hook

**Files:**
- Create: `apps/mobile/src/hooks/useBookingTransition.ts`

- [ ] **Step 1: Create useBookingTransition hook**

Encapsulates a status transition: validates the transition is legal using `isValidTransition`, writes to Firestore, and manages loading/error state. Also writes status-specific timestamp fields on transition (e.g., `schedule.confirmedDate` on approve, `shooting.startedAt` on start shoot).

```tsx
// apps/mobile/src/hooks/useBookingTransition.ts
import { useState, useCallback } from "react";
import firestore from "@react-native-firebase/firestore";
import { isValidTransition, type BookingStatus } from "@shotready/shared/src/constants/booking-status";

interface TransitionResult {
  transitioning: boolean;
  error: string | null;
  transition: (
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    extraFields?: Record<string, unknown>,
  ) => Promise<boolean>;
  clearError: () => void;
}

export function useBookingTransition(): TransitionResult {
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transition = useCallback(
    async (
      bookingId: string,
      from: BookingStatus,
      to: BookingStatus,
      extraFields?: Record<string, unknown>,
    ): Promise<boolean> => {
      if (!isValidTransition(from, to)) {
        setError(`Cannot move from ${from} to ${to}`);
        return false;
      }

      setError(null);
      setTransitioning(true);
      try {
        await firestore()
          .collection("bookings")
          .doc(bookingId)
          .update({
            status: to,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            ...extraFields,
          });
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to update booking");
        return false;
      } finally {
        setTransitioning(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { transitioning, error, transition, clearError };
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/hooks/useBookingTransition.ts`
Expected: file exists

---

### Task 2: Booking Info Components

**Files:**
- Create: `apps/mobile/src/components/booking/PropertyInfo.tsx`
- Create: `apps/mobile/src/components/booking/AgentInfo.tsx`
- Create: `apps/mobile/src/components/booking/ScheduleInfo.tsx`

- [ ] **Step 1: Create PropertyInfo component**

Displays property address, access code, access notes, and orientation.

```tsx
// apps/mobile/src/components/booking/PropertyInfo.tsx
import { View, Text } from "react-native";
import { Card } from "@/components/ui";
import { MapPin, Key, Compass } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface PropertyInfoProps {
  address: string;
  city: string;
  state: string;
  zip: string;
  accessCode: string | null;
  accessNotes: string | null;
  orientation: string | null;
}

export function PropertyInfo({
  address,
  city,
  state,
  zip,
  accessCode,
  accessNotes,
  orientation,
}: PropertyInfoProps) {
  return (
    <Card>
      <View className="flex-row items-start">
        <MapPin size={18} color={darkColors.accent} style={{ marginTop: 2 }} />
        <View className="ml-sm flex-1">
          <Text className="text-body-medium text-text-primary">{address}</Text>
          <Text className="text-caption text-text-secondary">
            {city}, {state} {zip}
          </Text>
        </View>
      </View>

      {accessCode && (
        <View className="flex-row items-center mt-md">
          <Key size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-text-secondary ml-sm">
            Access: {accessCode}
          </Text>
        </View>
      )}

      {accessNotes && (
        <Text className="text-caption text-text-muted mt-xs ml-[26px]">
          {accessNotes}
        </Text>
      )}

      {orientation && (
        <View className="flex-row items-center mt-md">
          <Compass size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-text-secondary ml-sm">
            Facing {orientation}
          </Text>
        </View>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Create AgentInfo component**

Displays agent name, email, phone, and company.

```tsx
// apps/mobile/src/components/booking/AgentInfo.tsx
import { View, Text, Pressable, Linking } from "react-native";
import { Card } from "@/components/ui";
import { User, Mail, Phone, Building2 } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface AgentInfoProps {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
}

export function AgentInfo({ name, email, phone, company }: AgentInfoProps) {
  return (
    <Card>
      <View className="flex-row items-center">
        <User size={18} color={darkColors.accent} />
        <Text className="text-body-medium text-text-primary ml-sm">{name}</Text>
      </View>

      <Pressable
        className="flex-row items-center mt-md"
        onPress={() => Linking.openURL(`mailto:${email}`)}
      >
        <Mail size={16} color={darkColors.textMuted} />
        <Text className="text-caption text-accent ml-sm">{email}</Text>
      </Pressable>

      {phone && (
        <Pressable
          className="flex-row items-center mt-sm"
          onPress={() => Linking.openURL(`tel:${phone}`)}
        >
          <Phone size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-accent ml-sm">{phone}</Text>
        </Pressable>
      )}

      {company && (
        <View className="flex-row items-center mt-sm">
          <Building2 size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-text-secondary ml-sm">{company}</Text>
        </View>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Create ScheduleInfo component**

Displays scheduled date, time, duration, and package info.

```tsx
// apps/mobile/src/components/booking/ScheduleInfo.tsx
import { View, Text } from "react-native";
import { Card } from "@/components/ui";
import { Calendar, Clock, Package } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import type { Timestamp } from "@shotready/shared";

interface ScheduleInfoProps {
  requestedDate: Timestamp;
  confirmedDate: Timestamp | null;
  startTime: string | null;
  estimatedDuration: number;
  packageName: string;
  packagePrice: number;
  deliverables: string[];
}

function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
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
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ScheduleInfo({
  requestedDate,
  confirmedDate,
  startTime,
  estimatedDuration,
  packageName,
  packagePrice,
  deliverables,
}: ScheduleInfoProps) {
  const displayDate = confirmedDate ?? requestedDate;

  return (
    <Card>
      <View className="flex-row items-center">
        <Calendar size={18} color={darkColors.accent} />
        <Text className="text-body-medium text-text-primary ml-sm">
          {formatDate(displayDate)}
        </Text>
        {!confirmedDate && (
          <Text className="text-small text-warning ml-sm">(Requested)</Text>
        )}
      </View>

      <View className="flex-row items-center mt-sm">
        <Clock size={16} color={darkColors.textMuted} />
        <Text className="text-caption text-text-secondary ml-sm">
          {startTime ? formatTime12(startTime) : "Time TBD"} · {formatDuration(estimatedDuration)}
        </Text>
      </View>

      <View className="mt-md pt-md border-t border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Package size={16} color={darkColors.textMuted} />
            <Text className="text-body-medium text-text-primary ml-sm">{packageName}</Text>
          </View>
          <Text className="text-body-medium text-text-primary">{formatPrice(packagePrice)}</Text>
        </View>
        {deliverables.length > 0 && (
          <View className="mt-xs ml-[26px]">
            {deliverables.map((d, i) => (
              <Text key={i} className="text-caption text-text-muted">
                · {d}
              </Text>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}
```

- [ ] **Step 4: Verify all files exist**

Run: `ls apps/mobile/src/components/booking/`
Expected: `PropertyInfo.tsx`, `AgentInfo.tsx`, `ScheduleInfo.tsx`

---

### Task 3: BookingActions Component

**Files:**
- Create: `apps/mobile/src/components/booking/BookingActions.tsx`

**Depends on:** Task 1 (useBookingTransition)

- [ ] **Step 1: Create BookingActions component**

Renders status-specific action buttons. Each button triggers the appropriate transition via `useBookingTransition`. For destructive actions (decline, cancel), shows a confirmation Alert.

```tsx
// apps/mobile/src/components/booking/BookingActions.tsx
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import type { BookingWithId } from "@/hooks/useBookings";
import firestore from "@react-native-firebase/firestore";

interface BookingActionsProps {
  booking: BookingWithId;
}

export function BookingActions({ booking }: BookingActionsProps) {
  const { transitioning, error, transition, clearError } = useBookingTransition();
  const router = useRouter();

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

  return (
    <View>
      {error && (
        <Text className="text-small text-error mb-sm text-center">{error}</Text>
      )}

      {booking.status === "pending" && (
        <View>
          <Button title="Approve Booking" onPress={handleApprove} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Decline" variant="destructive" onPress={handleDecline} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "confirmed" && (
        <View>
          <Button title="Start Shoot" onPress={handleStartShoot} loading={transitioning} />
          <View className="mt-sm">
            <Button title="Cancel Booking" variant="ghost" onPress={handleCancel} loading={transitioning} />
          </View>
        </View>
      )}

      {booking.status === "shooting" && (
        <Button title="Complete Shoot" onPress={handleCompleteShoot} loading={transitioning} />
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
        <Button title="Close Job" variant="secondary" onPress={handleCloseJob} loading={transitioning} />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/components/booking/BookingActions.tsx`
Expected: file exists

---

### Task 4: Booking Detail Screen

**Files:**
- Create: `apps/mobile/src/app/booking/[id].tsx`

**Depends on:** Tasks 1–3

- [ ] **Step 1: Create booking detail dynamic route**

The screen loads the booking by ID from the `useBookings` hook (which already has all 50 bookings cached). Displays a header with status pill, then info sections (property, schedule, agent), then action buttons. Photographer notes section at the bottom with inline editing.

```tsx
// apps/mobile/src/app/booking/[id].tsx
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState } from "react";
import { useBookings } from "@/hooks/useBookings";
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
  const booking = bookings.find((b) => b.id === id);

  const [notes, setNotes] = useState(booking?.photographerNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);

  async function saveNotes() {
    if (!id || notesSaved) return;
    await firestore().collection("bookings").doc(id).update({
      photographerNotes: notes.trim() || null,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    setNotesSaved(true);
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
              onChangeText={(t) => { setNotes(t); setNotesSaved(false); }}
              onBlur={saveNotes}
              placeholder="Add private notes about this booking..."
              placeholderTextColor={darkColors.textMuted}
              multiline
              textAlignVertical="top"
            />
            {!notesSaved && (
              <Text className="text-small text-text-muted mt-xs">Unsaved changes</Text>
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

- [ ] **Step 2: Verify file exists**

Run: `ls apps/mobile/src/app/booking/`
Expected: `[id].tsx`

---

### Task 5: Typecheck + Commit

**Depends on:** All previous tasks

- [ ] **Step 1: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. Fix any type issues before committing.

- [ ] **Step 2: Stage and commit**

```bash
git add apps/mobile/src/hooks/useBookingTransition.ts apps/mobile/src/components/booking/ apps/mobile/src/app/booking/ docs/superpowers/plans/2026-05-08-booking-detail.md
git commit -m "feat: add booking detail screen with status-based actions

- Dynamic route /booking/[id] with full booking info
- PropertyInfo, AgentInfo, ScheduleInfo reusable components
- BookingActions with status-specific transitions (approve, decline, start/complete shoot, close)
- useBookingTransition hook with validation via isValidTransition
- Editable photographer notes with auto-save on blur
- Confirmation dialogs for destructive actions (decline, cancel)"
```

- [ ] **Step 3: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible

---

## Deferred Features

| Feature | Spec Section | Reason |
|---------|-------------|--------|
| Cloud Function transition enforcement | 10 — Transition Rules | Requires Cloud Functions deployment (spec 03) |
| Email/push notifications on transitions | 10 — Side Effects | Depends on 19_Notifications |
| Send to Proofing action (editing→proofing) | 10 — Photographer Detail | Requires photo upload system (specs 14-15) |
| Deliver Finals action (proofing→delivered) | 10 — Photographer Detail | Requires photo processing pipeline |
| Send Invoice action (delivered→invoiced) | 10 — Photographer Detail | Requires Stripe integration (spec 18) |
| Resend Invoice action | 10 — Photographer Detail | Requires invoice system |
| Map view for property | 10 — confirmed detail | Requires Google Maps integration (spec 12) |
| Shot list interactive checklist | 10 — shooting detail | Field mode feature (spec 13) |
| Proofing status display | 10 — proofing detail | Requires proofing gallery (spec 16) |
| Agent-facing URL per status | 10 — Agent-Facing URL | Agent web shell (spec 20) |
