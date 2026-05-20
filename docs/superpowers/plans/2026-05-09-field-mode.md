# Field Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shoot-day field mode screen — a streamlined, one-handed interface showing property info, access codes, and an interactive shot list checklist, with a complete-shoot flow that transitions the booking to editing status.

**Architecture:** A full-screen Expo Router page at `field-mode/[id]` replaces normal app chrome (no tab bar). The top 40% shows read-only property/access info; the bottom 60% has an interactive shot list with check/uncheck (offline-safe Firestore writes), add-shot input, and a complete button with unchecked-items confirmation. Entry is via the existing "Start Shoot" button in BookingActions, which already transitions confirmed→shooting and now navigates to the field mode screen.

**Tech Stack:** React Native, Expo Router, NativeWind, Lucide Icons, `@react-native-firebase/firestore` (offline writes)

---

### Task 1: ShotListItem component

**Files:**
- Create: `apps/mobile/src/components/field-mode/ShotListItem.tsx`

**Context files to read:**
- `packages/shared/src/types/booking.ts` — `ShotListItem` type: `{ label: string; isCompleted: boolean; completedAt: Timestamp | null }`
- `apps/mobile/src/theme/colors.ts` — `darkColors`, `statusColors`

- [ ] **Step 1: Create `apps/mobile/src/components/field-mode/ShotListItem.tsx`**

```typescript
import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { darkColors, statusColors } from "@/theme/colors";

interface ShotListItemProps {
  label: string;
  isCompleted: boolean;
  onToggle: () => void;
}

export function ShotListItem({ label, isCompleted, onToggle }: ShotListItemProps) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center py-sm px-md min-h-[56px]"
      hitSlop={{ top: 4, bottom: 4 }}
    >
      {/* Checkbox — 32x32 visual, 56x56 tap target (Pressable handles tap area) */}
      <View
        className={`w-[32px] h-[32px] rounded-md items-center justify-center mr-md ${
          isCompleted ? "bg-success" : "border-2 border-border"
        }`}
        style={isCompleted ? { backgroundColor: statusColors.success } : undefined}
      >
        {isCompleted && <Check size={20} color="#fff" strokeWidth={3} />}
      </View>

      <Text
        className={`text-body flex-1 ${
          isCompleted ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/field-mode/ShotListItem.tsx
git commit -m "feat: add ShotListItem checkbox component for field mode"
```

---

### Task 2: Field mode screen

**Files:**
- Create: `apps/mobile/src/app/field-mode/[id].tsx`

**Context files to read:**
- `apps/mobile/src/hooks/useBookings.ts` — `useBookings` returns `{ bookings }`, find by ID
- `apps/mobile/src/hooks/useBookingTransition.ts` — `useBookingTransition` returns `{ transitioning, transition }`
- `apps/mobile/src/hooks/useConnectivity.ts` — `useConnectivity` returns `{ isOnline }`
- `apps/mobile/src/components/field-mode/ShotListItem.tsx` (Task 1)
- `packages/shared/src/types/booking.ts` — `Booking` shape: `property.address`, `property.accessCode`, `property.accessNotes`, `agent.name`, `agentNotes`, `shotList[]`, `schedule.estimatedDuration`

- [ ] **Step 1: Create `apps/mobile/src/app/field-mode/[id].tsx`**

```typescript
import { useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ArrowLeft, Plus, ChevronRight, Check } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";
import { darkColors, statusColors } from "@/theme/colors";
import { useBookings } from "@/hooks/useBookings";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useConnectivity } from "@/hooks/useConnectivity";
import { ShotListItem } from "@/components/field-mode/ShotListItem";

function getStreetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

export default function FieldModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bookings } = useBookings();
  const { transitioning, transition } = useBookingTransition();
  const { isOnline } = useConnectivity();
  const booking = bookings.find((b) => b.id === id);

  const [addingShot, setAddingShot] = useState(false);
  const [newShotLabel, setNewShotLabel] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  // Toggle a shot list item's completion status
  const toggleShot = useCallback(
    async (index: number) => {
      if (!booking || !id) return;
      const item = booking.shotList[index];
      const updatedList = [...booking.shotList];
      updatedList[index] = {
        ...item,
        isCompleted: !item.isCompleted,
        completedAt: !item.isCompleted
          ? firestore.Timestamp.now()
          : null,
      };
      await firestore().collection("bookings").doc(id).update({
        shotList: updatedList,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [booking, id],
  );

  // Add a new shot to the list
  const addShot = useCallback(async () => {
    if (!id || !newShotLabel.trim()) return;
    const newItem = {
      label: newShotLabel.trim(),
      isCompleted: false,
      completedAt: null,
    };
    await firestore()
      .collection("bookings")
      .doc(id)
      .update({
        shotList: firestore.FieldValue.arrayUnion(newItem),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    setNewShotLabel("");
    setAddingShot(false);
  }, [id, newShotLabel]);

  // Complete shoot with confirmation for unchecked items
  const handleComplete = useCallback(() => {
    if (!booking || !id) return;
    const unchecked = booking.shotList.filter((s) => !s.isCompleted).length;

    if (!isOnline) {
      Alert.alert("Offline", "Go online to complete this shoot.");
      return;
    }

    const doComplete = async () => {
      const success = await transition(booking.id, booking.status, "editing", {
        "shooting.completedAt": firestore.FieldValue.serverTimestamp(),
      });
      if (success) router.back();
    };

    if (unchecked > 0) {
      Alert.alert(
        "Unchecked Shots",
        `You have ${unchecked} unchecked shot${unchecked !== 1 ? "s" : ""}. Complete anyway?`,
        [
          { text: "Go Back", style: "cancel" },
          { text: "Yes, Complete", onPress: doComplete },
        ],
      );
    } else {
      doComplete();
    }
  }, [booking, id, isOnline, transition, router]);

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-body text-text-secondary">Booking not found</Text>
        <Pressable onPress={() => router.back()} className="mt-md">
          <Text className="text-body text-accent">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completed = booking.shotList.filter((s) => s.isCompleted).length;
  const total = booking.shotList.length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="flex-row items-center px-lg pt-sm pb-xs"
        hitSlop={8}
      >
        <ArrowLeft size={20} color={darkColors.textPrimary} />
        <Text className="text-body text-text-primary ml-xs">Back</Text>
      </Pressable>

      {/* ===== TOP SECTION: Read-only property info ===== */}
      <View className="px-lg pb-md">
        {/* Address + Agent */}
        <Text className="text-h2 text-text-primary">
          {getStreetAddress(booking.property.address)}
        </Text>
        <Text className="text-body text-text-secondary mt-xxs">
          Agent: {booking.agent.name}
        </Text>

        {/* Access code — large and prominent */}
        {booking.property.accessCode && (
          <Text className="text-h2 text-accent font-bold mt-md">
            ACCESS: {booking.property.accessCode}
          </Text>
        )}

        {/* Access notes */}
        {booking.property.accessNotes && (
          <Text className="text-body text-text-primary mt-xs">
            {booking.property.accessNotes}
          </Text>
        )}

        {/* Agent notes */}
        {booking.agentNotes && (
          <View className="mt-sm bg-surface rounded-lg p-md">
            <Text className="text-caption text-text-muted mb-xxs">Agent Notes</Text>
            <Text className="text-body text-text-primary">{booking.agentNotes}</Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View className="h-px bg-border mx-lg" />

      {/* ===== BOTTOM SECTION: Interactive shot list ===== */}
      <View className="flex-1 px-lg pt-md">
        {/* Shot list header */}
        <View className="flex-row items-center justify-between mb-sm">
          <Text className="text-body-medium text-text-primary font-semibold tracking-wide">
            SHOT LIST
          </Text>
          <Text className="text-body-medium text-text-secondary">
            {completed} / {total}
          </Text>
        </View>

        {/* Shot list */}
        {total > 0 ? (
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {booking.shotList.map((item, index) => (
              <ShotListItem
                key={`${item.label}-${index}`}
                label={item.label}
                isCompleted={item.isCompleted}
                onToggle={() => toggleShot(index)}
              />
            ))}

            {/* Add shot input (inline) */}
            {addingShot && (
              <View className="flex-row items-center py-sm px-md">
                <TextInput
                  className="flex-1 text-body text-text-primary border-b border-border py-xs mr-sm"
                  value={newShotLabel}
                  onChangeText={setNewShotLabel}
                  placeholder="Shot description..."
                  placeholderTextColor={darkColors.textMuted}
                  autoFocus
                  onSubmitEditing={addShot}
                  returnKeyType="done"
                />
                <Pressable onPress={addShot} hitSlop={8}>
                  <Check size={24} color={statusColors.success} />
                </Pressable>
              </View>
            )}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-body text-text-muted text-center">
              No shot list for this booking.{"\n"}Tap + to add shots.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom action bar */}
      <View className="flex-row items-center justify-between px-lg py-md border-t border-border">
        <Pressable
          onPress={() => setAddingShot(true)}
          className="flex-row items-center py-sm px-md"
          hitSlop={8}
        >
          <Plus size={20} color={darkColors.accent} />
          <Text className="text-body text-accent ml-xs">Add Shot</Text>
        </Pressable>

        <Pressable
          onPress={handleComplete}
          disabled={transitioning}
          className={`flex-row items-center py-sm px-lg rounded-lg ${
            transitioning ? "opacity-40" : ""
          } bg-accent`}
        >
          {transitioning ? (
            <ActivityIndicator size={18} color="#fff" />
          ) : (
            <>
              <Text className="text-body-medium text-white font-semibold">Complete</Text>
              <ChevronRight size={18} color="#fff" className="ml-xs" />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/field-mode/[id].tsx
git commit -m "feat: add field mode screen with shot list and complete flow"
```

---

### Task 3: Wire entry point from BookingActions

**Files:**
- Modify: `apps/mobile/src/components/booking/BookingActions.tsx`

**Context files to read:**
- `apps/mobile/src/components/booking/BookingActions.tsx` — current "Start Shoot" handler (line 56-60) transitions confirmed→shooting but does not navigate

- [ ] **Step 1: Modify `handleStartShoot` to navigate to field mode after transition**

In `BookingActions.tsx`, change the `handleStartShoot` function from:

```typescript
  async function handleStartShoot() {
    await transition(booking.id, booking.status, "shooting", {
      "shooting.startedAt": firestore.FieldValue.serverTimestamp(),
    });
  }
```

To:

```typescript
  async function handleStartShoot() {
    const success = await transition(booking.id, booking.status, "shooting", {
      "shooting.startedAt": firestore.FieldValue.serverTimestamp(),
    });
    if (success) router.push(`/field-mode/${booking.id}`);
  }
```

Also change the `handleCompleteShoot` function to navigate to field mode instead of completing inline, since completing should happen from field mode:

```typescript
  async function handleCompleteShoot() {
    router.push(`/field-mode/${booking.id}`);
  }
```

This replaces the inline complete transition — when a booking is already in `shooting` status, tapping "Complete Shoot" on the detail screen now opens field mode where the photographer can review their shot list and complete from there.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/booking/BookingActions.tsx
git commit -m "feat: wire Start Shoot and Complete Shoot to field mode screen"
```

---

### Task 4: Typecheck all packages

- [ ] **Step 1: Run typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 2: Final commit (if fixes needed)**

```bash
git add -A && git commit -m "fix: resolve typecheck errors in field mode feature"
```
