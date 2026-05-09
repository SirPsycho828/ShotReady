# Onboarding + Service Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 4-step photographer onboarding flow (business identity, first package, availability, booking link) and service package CRUD accessible from Settings.

**Architecture:** Onboarding is a separate Expo Router route group `(onboarding)` with a Stack navigator. The root layout's auth gate checks `photographer.onboardingComplete` and routes accordingly: unauthenticated → `(auth)`, authenticated + not onboarded → `(onboarding)`, onboarded → `(tabs)`. A reusable `PackageForm` component is shared between onboarding Step 2 and the settings package form route. Firestore hooks (`usePhotographer`, `usePackages`) provide real-time data subscriptions.

**Tech Stack:** Expo Router, NativeWind, @react-native-firebase/firestore, expo-clipboard

---

## File Structure

```
apps/mobile/src/
├── hooks/
│   ├── usePhotographer.ts          # Create — subscribe to photographers/{uid}
│   └── usePackages.ts              # Create — subscribe to packages for this photographer
├── components/
│   ├── PackageForm.tsx             # Create — reusable package create/edit form
│   └── AvailabilityEditor.tsx      # Create — weekly grid with day toggles + time pickers
├── app/
│   ├── _layout.tsx                 # Modify — Stack navigator + onboarding gate
│   ├── package-form.tsx            # Create — standalone route for settings package CRUD
│   ├── (onboarding)/
│   │   ├── _layout.tsx             # Create — Stack layout for onboarding steps
│   │   ├── step1-business.tsx      # Create — business name + phone
│   │   ├── step2-package.tsx       # Create — first package (uses PackageForm)
│   │   ├── step3-availability.tsx  # Create — availability (uses AvailabilityEditor)
│   │   ├── step4-booking-link.tsx  # Create — booking slug + URL preview
│   │   └── complete.tsx            # Create — completion screen with copy link
│   └── (tabs)/
│       └── settings.tsx            # Modify — packages list + logout
```

## Parallelization Notes

Tasks 1–3 (hooks + components) are independent — dispatch in parallel.
Tasks 4–6 (onboarding screens) are sequential — each step navigates to the next.
Task 7 (root layout) depends on Task 1 (usePhotographer hook).
Task 8 (settings + package route) depends on Tasks 1–2 (hooks + PackageForm).

---

### Task 1: Firestore Hooks

**Files:**
- Create: `apps/mobile/src/hooks/usePhotographer.ts`
- Create: `apps/mobile/src/hooks/usePackages.ts`

- [ ] **Step 1: Create usePhotographer hook**

Subscribes to `photographers/{uid}` with a real-time Firestore listener. Returns `{ photographer, isLoading }`.

```tsx
// apps/mobile/src/hooks/usePhotographer.ts
import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Photographer } from "@shotready/shared";

export function usePhotographer() {
  const { user } = useAuth();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPhotographer(null);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("photographers")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          setPhotographer(doc.exists ? (doc.data() as Photographer) : null);
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user]);

  return { photographer, isLoading };
}
```

- [ ] **Step 2: Create usePackages hook**

Subscribes to `packages` collection where `photographerId == uid`, ordered by `sortOrder`. Returns typed array with document IDs attached.

```tsx
// apps/mobile/src/hooks/usePackages.ts
import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { ServicePackage } from "@shotready/shared";

export interface PackageWithId extends ServicePackage {
  id: string;
}

export function usePackages() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<PackageWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPackages([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("packages")
      .where("photographerId", "==", user.uid)
      .orderBy("sortOrder", "asc")
      .onSnapshot(
        (snapshot) => {
          setPackages(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PackageWithId),
          );
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user]);

  return { packages, isLoading };
}
```

- [ ] **Step 3: Verify files exist**

Run: `ls apps/mobile/src/hooks/`
Expected: `usePhotographer.ts` and `usePackages.ts`

---

### Task 2: PackageForm Component

**Files:**
- Create: `apps/mobile/src/components/PackageForm.tsx`

- [ ] **Step 1: Create PackageForm component**

Reusable form for creating and editing service packages. Used by onboarding Step 2 and the settings package form route.

Features:
- Name input (max 60 chars)
- Description input (max 200 chars)
- Price input (dollar format → cents on save)
- Deliverables list (add/remove, min 1, max 10)
- Shot list template (add/remove, optional, max 30) — controlled by `showShotList` prop
- Estimated duration picker (15-min increments, 30–480 min)
- Live package card preview at top

```tsx
// apps/mobile/src/components/PackageForm.tsx
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { useState } from "react";
import { Button, Input, Card } from "@/components/ui";
import { darkColors } from "@/theme/colors";
import { Check, Plus, X } from "lucide-react-native";

export interface PackageFormData {
  name: string;
  description: string;
  price: number; // cents
  deliverables: string[];
  shotListTemplate: string[];
  estimatedDuration: number; // minutes
}

interface PackageFormProps {
  initialData?: Partial<PackageFormData>;
  onSave: (data: PackageFormData) => Promise<void>;
  saveLabel?: string;
  showShotList?: boolean;
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480];

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parsePriceToCents(input: string): number {
  const num = parseFloat(input.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export function PackageForm({
  initialData,
  onSave,
  saveLabel = "Save Package",
  showShotList = false,
}: PackageFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [priceText, setPriceText] = useState(
    initialData?.price ? formatPrice(initialData.price) : "",
  );
  const [deliverables, setDeliverables] = useState<string[]>(
    initialData?.deliverables?.length ? initialData.deliverables : [""],
  );
  const [shotList, setShotList] = useState<string[]>(
    initialData?.shotListTemplate ?? [],
  );
  const [duration, setDuration] = useState(initialData?.estimatedDuration ?? 60);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateDeliverable(index: number, value: string) {
    const next = [...deliverables];
    next[index] = value;
    setDeliverables(next);
  }

  function removeDeliverable(index: number) {
    if (deliverables.length <= 1) return;
    setDeliverables(deliverables.filter((_, i) => i !== index));
  }

  function updateShotItem(index: number, value: string) {
    const next = [...shotList];
    next[index] = value;
    setShotList(next);
  }

  function removeShotItem(index: number) {
    setShotList(shotList.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const priceCents = parsePriceToCents(priceText);
    const trimmedDeliverables = deliverables.map((d) => d.trim()).filter(Boolean);

    if (!trimmedName) { setError("Package name is required"); return; }
    if (trimmedName.length > 60) { setError("Name must be 60 characters or less"); return; }
    if (!trimmedDesc) { setError("Description is required"); return; }
    if (trimmedDesc.length > 200) { setError("Description must be 200 characters or less"); return; }
    if (!priceText || priceCents < 0) { setError("Enter a valid price"); return; }
    if (trimmedDeliverables.length === 0) { setError("At least one deliverable is required"); return; }
    if (trimmedDeliverables.length > 10) { setError("Maximum 10 deliverables"); return; }

    const trimmedShotList = shotList.map((s) => s.trim()).filter(Boolean);

    setError("");
    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        description: trimmedDesc,
        price: priceCents,
        deliverables: trimmedDeliverables,
        shotListTemplate: trimmedShotList,
        estimatedDuration: duration,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const previewPrice = parsePriceToCents(priceText);
  const previewDeliverables = deliverables.filter((d) => d.trim());

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-lg pb-2xl"
      keyboardShouldPersistTaps="handled"
    >
      {/* Live preview card */}
      <Card className="mb-lg mt-md">
        <View className="flex-row justify-between items-start">
          <Text className="text-h3 text-text-primary flex-1" numberOfLines={1}>
            {name || "Package Name"}
          </Text>
          <Text className="text-h3 text-text-primary ml-md">
            ${previewPrice > 0 ? formatPrice(previewPrice) : "0.00"}
          </Text>
        </View>
        <Text className="text-body text-text-secondary mt-xs" numberOfLines={2}>
          {description || "Package description"}
        </Text>
        {previewDeliverables.length > 0 && (
          <View className="mt-sm">
            {previewDeliverables.map((d, i) => (
              <View key={i} className="flex-row items-center mt-xs">
                <Check size={14} color={darkColors.accent} strokeWidth={2.5} />
                <Text className="text-caption text-text-secondary ml-xs">{d}</Text>
              </View>
            ))}
          </View>
        )}
        <Text className="text-caption text-text-muted mt-sm">
          Approx. {formatDuration(duration)}
        </Text>
      </Card>

      {/* Form fields */}
      <Input
        label="Package Name"
        value={name}
        onChangeText={setName}
        placeholder="Standard Listing"
        maxLength={60}
      />

      <View className="mt-md">
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Professional photos for your listing"
          maxLength={200}
          multiline
          numberOfLines={2}
        />
      </View>

      <View className="mt-md">
        <Input
          label="Price ($)"
          value={priceText}
          onChangeText={setPriceText}
          placeholder="250.00"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Duration picker */}
      <View className="mt-md">
        <Text className="text-caption text-text-secondary mb-xs">Estimated Duration</Text>
        <Pressable
          className="h-[48px] rounded-input bg-surface px-md border border-border flex-row items-center justify-between"
          onPress={() => setDurationPickerVisible(true)}
        >
          <Text className="text-body text-text-primary">{formatDuration(duration)}</Text>
          <Text className="text-caption text-text-muted">Tap to change</Text>
        </Pressable>
      </View>

      {/* Deliverables */}
      <View className="mt-lg">
        <Text className="text-h3 text-text-primary mb-sm">Deliverables</Text>
        {deliverables.map((d, i) => (
          <View key={i} className="flex-row items-center mt-sm">
            <View className="flex-1">
              <Input
                value={d}
                onChangeText={(v) => updateDeliverable(i, v)}
                placeholder={i === 0 ? "25 edited photos" : "24-hour turnaround"}
                maxLength={80}
              />
            </View>
            {deliverables.length > 1 && (
              <Pressable className="ml-sm p-sm" onPress={() => removeDeliverable(i)}>
                <X size={20} color={darkColors.textMuted} />
              </Pressable>
            )}
          </View>
        ))}
        {deliverables.length < 10 && (
          <Pressable
            className="flex-row items-center mt-sm"
            onPress={() => setDeliverables([...deliverables, ""])}
          >
            <Plus size={18} color={darkColors.accent} />
            <Text className="text-body text-accent ml-xs">Add deliverable</Text>
          </Pressable>
        )}
      </View>

      {/* Shot list template (optional, shown in settings edit) */}
      {showShotList && (
        <View className="mt-lg">
          <Text className="text-h3 text-text-primary mb-xs">Shot List Template</Text>
          <Text className="text-caption text-text-muted mb-sm">
            Optional. Seeds the shot list for bookings using this package.
          </Text>
          {shotList.map((s, i) => (
            <View key={i} className="flex-row items-center mt-sm">
              <View className="flex-1">
                <Input
                  value={s}
                  onChangeText={(v) => updateShotItem(i, v)}
                  placeholder={["Front exterior", "Kitchen", "Living room", "Primary bedroom", "Primary bathroom", "Backyard"][i] ?? "Shot description"}
                />
              </View>
              <Pressable className="ml-sm p-sm" onPress={() => removeShotItem(i)}>
                <X size={20} color={darkColors.textMuted} />
              </Pressable>
            </View>
          ))}
          {shotList.length < 30 && (
            <Pressable
              className="flex-row items-center mt-sm"
              onPress={() => setShotList([...shotList, ""])}
            >
              <Plus size={18} color={darkColors.accent} />
              <Text className="text-body text-accent ml-xs">Add shot</Text>
            </Pressable>
          )}
        </View>
      )}

      {error !== "" && (
        <Text className="text-small text-error mt-md">{error}</Text>
      )}

      <View className="mt-lg">
        <Button title={saveLabel} onPress={handleSave} loading={saving} />
      </View>

      {/* Duration picker modal */}
      <Modal visible={durationPickerVisible} transparent animationType="slide">
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setDurationPickerVisible(false)}
        >
          <View className="bg-surface rounded-t-card pt-md pb-2xl">
            <Text className="text-h3 text-text-primary text-center mb-md">
              Select Duration
            </Text>
            <FlatList
              data={DURATION_OPTIONS}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => (
                <Pressable
                  className={`py-sm px-lg ${item === duration ? "bg-accent/10" : ""}`}
                  onPress={() => { setDuration(item); setDurationPickerVisible(false); }}
                >
                  <Text className={`text-body text-center ${item === duration ? "text-accent" : "text-text-primary"}`}>
                    {formatDuration(item)}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls apps/mobile/src/components/PackageForm.tsx`
Expected: file exists

---

### Task 3: AvailabilityEditor Component

**Files:**
- Create: `apps/mobile/src/components/AvailabilityEditor.tsx`

- [ ] **Step 1: Create AvailabilityEditor component**

Weekly grid with day toggles and start/end time pickers. Default: Mon–Fri 08:00–17:00. Each enabled day produces an `AvailabilityWindow` (from `@shotready/shared`).

```tsx
// apps/mobile/src/components/AvailabilityEditor.tsx
import { View, Text, Switch, Pressable, Modal, FlatList } from "react-native";
import { useState } from "react";
import type { AvailabilityWindow } from "@shotready/shared";
import { darkColors } from "@/theme/colors";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Generate times from 06:00 to 22:00 in 15-min increments
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 22 && m > 0) break;
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTime12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

interface DayState {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_DAYS: DayState[] = [
  { enabled: false, startTime: "08:00", endTime: "17:00" }, // Sunday
  { enabled: true, startTime: "08:00", endTime: "17:00" },  // Monday
  { enabled: true, startTime: "08:00", endTime: "17:00" },  // Tuesday
  { enabled: true, startTime: "08:00", endTime: "17:00" },  // Wednesday
  { enabled: true, startTime: "08:00", endTime: "17:00" },  // Thursday
  { enabled: true, startTime: "08:00", endTime: "17:00" },  // Friday
  { enabled: false, startTime: "08:00", endTime: "17:00" }, // Saturday
];

function windowsToDays(windows: AvailabilityWindow[]): DayState[] {
  const days = DEFAULT_DAYS.map((d) => ({ ...d, enabled: false }));
  for (const w of windows) {
    days[w.dayOfWeek] = { enabled: true, startTime: w.startTime, endTime: w.endTime };
  }
  return days;
}

function daysToWindows(days: DayState[]): AvailabilityWindow[] {
  return days
    .map((d, i) =>
      d.enabled ? { dayOfWeek: i, startTime: d.startTime, endTime: d.endTime } : null,
    )
    .filter((w): w is AvailabilityWindow => w !== null);
}

interface AvailabilityEditorProps {
  initialWindows?: AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
}

export function AvailabilityEditor({ initialWindows, onChange }: AvailabilityEditorProps) {
  const [days, setDays] = useState<DayState[]>(
    initialWindows?.length ? windowsToDays(initialWindows) : DEFAULT_DAYS,
  );
  const [timePicker, setTimePicker] = useState<{
    dayIndex: number;
    field: "startTime" | "endTime";
  } | null>(null);

  function updateDay(index: number, update: Partial<DayState>) {
    const next = days.map((d, i) => (i === index ? { ...d, ...update } : d));
    setDays(next);
    onChange(daysToWindows(next));
  }

  function selectTime(time: string) {
    if (!timePicker) return;
    updateDay(timePicker.dayIndex, { [timePicker.field]: time });
    setTimePicker(null);
  }

  return (
    <View>
      {days.map((day, i) => (
        <View
          key={i}
          className={`flex-row items-center py-sm ${i > 0 ? "border-t border-border" : ""}`}
        >
          <Text className="text-body text-text-primary w-[48px]">{SHORT_DAYS[i]}</Text>
          <Switch
            value={day.enabled}
            onValueChange={(v) => updateDay(i, { enabled: v })}
            trackColor={{ false: darkColors.border, true: darkColors.accent }}
            thumbColor="#FFFFFF"
          />
          {day.enabled && (
            <View className="flex-row items-center ml-sm flex-1">
              <Pressable
                className="bg-surface-raised px-sm py-xs rounded-input"
                onPress={() => setTimePicker({ dayIndex: i, field: "startTime" })}
              >
                <Text className="text-caption text-text-primary">
                  {formatTime12(day.startTime)}
                </Text>
              </Pressable>
              <Text className="text-caption text-text-muted mx-xs">to</Text>
              <Pressable
                className="bg-surface-raised px-sm py-xs rounded-input"
                onPress={() => setTimePicker({ dayIndex: i, field: "endTime" })}
              >
                <Text className="text-caption text-text-primary">
                  {formatTime12(day.endTime)}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      {/* Time picker modal */}
      <Modal visible={timePicker !== null} transparent animationType="slide">
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setTimePicker(null)}
        >
          <View className="bg-surface rounded-t-card pt-md pb-2xl max-h-[400px]">
            <Text className="text-h3 text-text-primary text-center mb-md">
              {timePicker
                ? `${DAYS[timePicker.dayIndex]} — ${timePicker.field === "startTime" ? "Start" : "End"} Time`
                : ""}
            </Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected =
                  timePicker && days[timePicker.dayIndex][timePicker.field] === item;
                return (
                  <Pressable
                    className={`py-sm px-lg ${isSelected ? "bg-accent/10" : ""}`}
                    onPress={() => selectTime(item)}
                  >
                    <Text
                      className={`text-body text-center ${isSelected ? "text-accent" : "text-text-primary"}`}
                    >
                      {formatTime12(item)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls apps/mobile/src/components/AvailabilityEditor.tsx`
Expected: file exists

---

### Task 4: Onboarding Layout + Steps 1–2

**Files:**
- Create: `apps/mobile/src/app/(onboarding)/_layout.tsx`
- Create: `apps/mobile/src/app/(onboarding)/step1-business.tsx`
- Create: `apps/mobile/src/app/(onboarding)/step2-package.tsx`

**Depends on:** Task 2 (PackageForm)

- [ ] **Step 1: Create onboarding layout**

Stack navigator with no headers. Dark background.

```tsx
// apps/mobile/src/app/(onboarding)/_layout.tsx
import { Stack } from "expo-router";
import { darkColors } from "@/theme/colors";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: darkColors.background },
      }}
    />
  );
}
```

- [ ] **Step 2: Create Step 1 — Business Identity**

Pre-fills business name from registration. Collects optional phone. On Continue, updates the photographer Firestore document and navigates to Step 2.

```tsx
// apps/mobile/src/app/(onboarding)/step1-business.tsx
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import firestore from "@react-native-firebase/firestore";

export default function Step1Business() {
  const router = useRouter();
  const { user } = useAuth();
  const { photographer } = usePhotographer();
  const [businessName, setBusinessName] = useState(photographer?.businessName ?? "");
  const [phone, setPhone] = useState(photographer?.phone ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!businessName.trim()) {
      setError("Business name is required");
      return;
    }
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      await firestore().collection("photographers").doc(user.uid).update({
        businessName: businessName.trim(),
        phone: phone.trim() || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      router.push("/(onboarding)/step2-package");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-lg"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-h1 text-text-primary">Let's set up your business</Text>
        <Text className="text-body text-text-secondary mt-sm mb-xl">
          Tell us about your photography business
        </Text>

        <Input
          label="Business Name"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
          placeholder="Smith Photography"
        />

        <View className="mt-md">
          <Input
            label="Phone Number (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="(555) 123-4567"
          />
        </View>

        {error !== "" && (
          <Text className="text-small text-error mt-sm">{error}</Text>
        )}

        <View className="mt-lg">
          <Button title="Continue" onPress={handleContinue} loading={saving} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 3: Create Step 2 — First Package**

Uses the `PackageForm` component. On save, creates a package document in Firestore and navigates to Step 3. `showShotList` is false for the onboarding flow (keep it simple).

```tsx
// apps/mobile/src/app/(onboarding)/step2-package.tsx
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { PackageForm, type PackageFormData } from "@/components/PackageForm";
import firestore from "@react-native-firebase/firestore";

export default function Step2Package() {
  const router = useRouter();
  const { user } = useAuth();

  async function handleSave(data: PackageFormData) {
    if (!user) return;

    await firestore().collection("packages").add({
      photographerId: user.uid,
      name: data.name,
      description: data.description,
      price: data.price,
      deliverables: data.deliverables,
      shotListTemplate: data.shotListTemplate,
      estimatedDuration: data.estimatedDuration,
      isActive: true,
      sortOrder: 0,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    router.push("/(onboarding)/step3-availability");
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-lg pt-xl">
        <Text className="text-h1 text-text-primary">Create your first package</Text>
        <Text className="text-body text-text-secondary mt-sm">
          Agents will choose this when booking a shoot
        </Text>
      </View>
      <PackageForm onSave={handleSave} saveLabel="Continue" showShotList={false} />
    </View>
  );
}
```

- [ ] **Step 4: Verify all files created**

Run: `ls apps/mobile/src/app/\(onboarding\)/`
Expected: `_layout.tsx`, `step1-business.tsx`, `step2-package.tsx`

---

### Task 5: Onboarding Steps 3–4 + Complete

**Files:**
- Create: `apps/mobile/src/app/(onboarding)/step3-availability.tsx`
- Create: `apps/mobile/src/app/(onboarding)/step4-booking-link.tsx`
- Create: `apps/mobile/src/app/(onboarding)/complete.tsx`

**Depends on:** Task 3 (AvailabilityEditor)

- [ ] **Step 1: Install expo-clipboard**

Run: `cd apps/mobile && pnpm add expo-clipboard`

- [ ] **Step 2: Create Step 3 — Availability**

Uses the `AvailabilityEditor` component. On Continue, writes `availability.windows` to the photographer document.

```tsx
// apps/mobile/src/app/(onboarding)/step3-availability.tsx
import { View, Text, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import type { AvailabilityWindow } from "@shotready/shared";
import firestore from "@react-native-firebase/firestore";

export default function Step3Availability() {
  const router = useRouter();
  const { user } = useAuth();
  const { photographer } = usePhotographer();
  const [windows, setWindows] = useState<AvailabilityWindow[]>(
    photographer?.availability.windows ?? [],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (windows.length === 0) {
      setError("Enable at least one day");
      return;
    }
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      await firestore().collection("photographers").doc(user.uid).update({
        "availability.windows": windows,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      router.push("/(onboarding)/step4-booking-link");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-lg pt-xl pb-2xl"
    >
      <Text className="text-h1 text-text-primary">Set your availability</Text>
      <Text className="text-body text-text-secondary mt-sm mb-lg">
        When are you available for shoots?
      </Text>

      <AvailabilityEditor initialWindows={windows} onChange={setWindows} />

      {error !== "" && (
        <Text className="text-small text-error mt-md">{error}</Text>
      )}

      <View className="mt-lg">
        <Button title="Continue" onPress={handleContinue} loading={saving} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Create Step 4 — Booking Link**

Auto-generates a slug from the business name. The photographer can edit it. On Continue, writes `bookingSlug` and sets `onboardingComplete: true`.

```tsx
// apps/mobile/src/app/(onboarding)/step4-booking-link.tsx
import { View, Text, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Button, Input, Card } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import firestore from "@react-native-firebase/firestore";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Step4BookingLink() {
  const router = useRouter();
  const { user } = useAuth();
  const { photographer } = usePhotographer();
  const [slug, setSlug] = useState(
    photographer?.bookingSlug || generateSlug(photographer?.businessName ?? ""),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleSlugChange(text: string) {
    setSlug(text.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleContinue() {
    if (!slug.trim()) {
      setError("Booking link is required");
      return;
    }
    if (slug.length < 3) {
      setError("Must be at least 3 characters");
      return;
    }
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      // Check uniqueness (always passes for single-photographer v1, but ready for multi-tenant)
      const existing = await firestore()
        .collection("photographers")
        .where("bookingSlug", "==", slug)
        .get();

      const isOwn = existing.docs.length === 1 && existing.docs[0].id === user.uid;
      if (!existing.empty && !isOwn) {
        setError("This link is already taken. Try a different one.");
        setSaving(false);
        return;
      }

      await firestore().collection("photographers").doc(user.uid).update({
        bookingSlug: slug,
        onboardingComplete: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      router.replace("/(onboarding)/complete");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-lg pt-xl pb-2xl"
    >
      <Text className="text-h1 text-text-primary">Your booking link</Text>
      <Text className="text-body text-text-secondary mt-sm mb-lg">
        Share this link with agents. They'll use it to book shoots with you.
      </Text>

      <Input
        label="Booking Slug"
        value={slug}
        onChangeText={handleSlugChange}
        autoCapitalize="none"
        autoCorrect={false}
        error={error || undefined}
      />

      <Card className="mt-md">
        <Text className="text-caption text-text-muted">Your booking URL</Text>
        <Text className="text-body-medium text-accent mt-xs" selectable>
          shotready.app/book/{slug || "..."}
        </Text>
      </Card>

      <View className="mt-lg">
        <Button title="Finish Setup" onPress={handleContinue} loading={saving} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Create Completion Screen**

Shows the booking link with a copy button, a brief message, and a "Go to Dashboard" button. Sets `onboardingComplete` was already done in Step 4, so the auth gate will now allow access to `(tabs)`.

```tsx
// apps/mobile/src/app/(onboarding)/complete.tsx
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { usePhotographer } from "@/hooks/usePhotographer";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";

export default function OnboardingComplete() {
  const router = useRouter();
  const { photographer } = usePhotographer();
  const [copied, setCopied] = useState(false);
  const bookingUrl = `shotready.app/book/${photographer?.bookingSlug ?? ""}`;

  async function handleCopy() {
    await Clipboard.setStringAsync(`https://${bookingUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View className="flex-1 bg-background justify-center px-lg">
      <Text className="text-h1 text-text-primary text-center">You're ready to go</Text>
      <Text className="text-body text-text-secondary text-center mt-sm">
        Share this link with your agents to start receiving bookings
      </Text>

      <Card className="mt-xl">
        <Text className="text-caption text-text-muted">Your booking link</Text>
        <Text className="text-body-medium text-accent mt-xs" selectable>
          https://{bookingUrl}
        </Text>
        <View className="mt-md">
          <Button
            title={copied ? "Copied!" : "Copy Link"}
            variant={copied ? "secondary" : "primary"}
            onPress={handleCopy}
          />
        </View>
      </Card>

      <View className="mt-xl">
        <Button
          title="Go to Dashboard"
          onPress={() => router.replace("/(tabs)")}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Verify all files**

Run: `ls apps/mobile/src/app/\(onboarding\)/`
Expected: `_layout.tsx`, `step1-business.tsx`, `step2-package.tsx`, `step3-availability.tsx`, `step4-booking-link.tsx`, `complete.tsx`

---

### Task 6: Root Layout Update (Onboarding Gate)

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

**Depends on:** Task 1 (usePhotographer hook)

- [ ] **Step 1: Update root layout with onboarding routing**

Replace `<Slot />` with `<Stack>` to support pushing the package-form route. Add onboarding gate logic: if authenticated but `onboardingComplete` is false, redirect to `(onboarding)`.

Read the current file first, then replace the full content:

```tsx
// apps/mobile/src/app/_layout.tsx
import "../../global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import { OfflineBar } from "@/components/ui";
import { darkColors } from "@/theme/colors";

function AuthGate() {
  const { user, isLoading: authLoading } = useAuth();
  const { photographer, isLoading: profileLoading } = usePhotographer();
  const segments = useSegments();
  const router = useRouter();

  const isLoading = authLoading || (!!user && profileLoading);

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

    if (!user) {
      if (!inAuth) router.replace("/(auth)/login");
    } else if (!photographer?.onboardingComplete) {
      if (!inOnboarding) router.replace("/(onboarding)/step1-business");
    } else {
      if (inAuth || inOnboarding) router.replace("/(tabs)");
    }
  }, [user, isLoading, photographer?.onboardingComplete, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={darkColors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="package-form" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <View className="flex-1 bg-background">
        <StatusBar style="light" />
        <OfflineBar />
        <AuthGate />
      </View>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Verify file updated**

Run: `head -5 apps/mobile/src/app/_layout.tsx`
Expected: includes `Stack` import

---

### Task 7: Package Form Route + Settings Screen

**Files:**
- Create: `apps/mobile/src/app/package-form.tsx`
- Modify: `apps/mobile/src/app/(tabs)/settings.tsx`

**Depends on:** Tasks 1–2 (hooks + PackageForm)

- [ ] **Step 1: Create package-form route**

Standalone screen that wraps `PackageForm`. Receives optional `id` search param for edit mode. Supports create, edit, deactivate, and reactivate.

```tsx
// apps/mobile/src/app/package-form.tsx
import { View, Text, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { PackageForm, type PackageFormData } from "@/components/PackageForm";
import { useAuth } from "@/contexts/AuthContext";
import { usePackages } from "@/hooks/usePackages";
import firestore from "@react-native-firebase/firestore";
import { darkColors } from "@/theme/colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Pressable } from "react-native";

export default function PackageFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { packages } = usePackages();
  const existingPkg = id ? packages.find((p) => p.id === id) : undefined;
  const isEdit = !!existingPkg;

  async function handleSave(data: PackageFormData) {
    if (!user) return;

    if (isEdit && id) {
      await firestore().collection("packages").doc(id).update({
        name: data.name,
        description: data.description,
        price: data.price,
        deliverables: data.deliverables,
        shotListTemplate: data.shotListTemplate,
        estimatedDuration: data.estimatedDuration,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const maxSort = packages.reduce((max, p) => Math.max(max, p.sortOrder), -1);
      await firestore().collection("packages").add({
        photographerId: user.uid,
        name: data.name,
        description: data.description,
        price: data.price,
        deliverables: data.deliverables,
        shotListTemplate: data.shotListTemplate,
        estimatedDuration: data.estimatedDuration,
        isActive: true,
        sortOrder: maxSort + 1,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
    router.back();
  }

  function handleDeactivate() {
    if (!id || !existingPkg) return;
    const activeCount = packages.filter((p) => p.isActive).length;

    if (existingPkg.isActive && activeCount <= 1) {
      Alert.alert(
        "Cannot Deactivate",
        "You need at least one active package for agents to book.",
      );
      return;
    }

    const action = existingPkg.isActive ? "Deactivate" : "Reactivate";
    Alert.alert(action, `${action} "${existingPkg.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        style: existingPkg.isActive ? "destructive" : "default",
        onPress: async () => {
          await firestore().collection("packages").doc(id).update({
            isActive: !existingPkg.isActive,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-lg pt-sm pb-md border-b border-border">
        <Text className="text-h2 text-text-primary">
          {isEdit ? "Edit Package" : "New Package"}
        </Text>
        <Pressable onPress={() => router.back()} className="p-xs">
          <X size={24} color={darkColors.textPrimary} />
        </Pressable>
      </View>

      <PackageForm
        initialData={
          existingPkg
            ? {
                name: existingPkg.name,
                description: existingPkg.description,
                price: existingPkg.price,
                deliverables: existingPkg.deliverables,
                shotListTemplate: existingPkg.shotListTemplate,
                estimatedDuration: existingPkg.estimatedDuration,
              }
            : undefined
        }
        onSave={handleSave}
        saveLabel={isEdit ? "Save Changes" : "Create Package"}
        showShotList={true}
      />

      {/* Deactivate/Reactivate button for edit mode */}
      {isEdit && (
        <View className="px-lg pb-lg">
          <Button
            title={existingPkg?.isActive ? "Deactivate Package" : "Reactivate Package"}
            variant={existingPkg?.isActive ? "destructive" : "secondary"}
            onPress={handleDeactivate}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Replace settings screen with packages list**

Read the current `settings.tsx` first, then replace with a real settings screen showing the packages section and a logout button.

```tsx
// apps/mobile/src/app/(tabs)/settings.tsx
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotographer } from "@/hooks/usePhotographer";
import { usePackages } from "@/hooks/usePackages";
import { darkColors } from "@/theme/colors";
import { Plus, ChevronRight } from "lucide-react-native";
import { useState } from "react";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { photographer } = usePhotographer();
  const { packages } = usePackages();
  const [showDeactivated, setShowDeactivated] = useState(false);

  const activePackages = packages.filter((p) => p.isActive);
  const deactivatedPackages = packages.filter((p) => !p.isActive);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-2xl">
      {/* Profile section */}
      <View className="px-lg pt-lg">
        <Text className="text-h2 text-text-primary">
          {photographer?.businessName ?? "Settings"}
        </Text>
        <Text className="text-caption text-text-secondary mt-xs">
          {photographer?.email}
        </Text>
      </View>

      {/* Packages section */}
      <View className="px-lg mt-xl">
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-h3 text-text-primary">Service Packages</Text>
          <Pressable
            className="flex-row items-center"
            onPress={() => router.push("/package-form")}
          >
            <Plus size={18} color={darkColors.accent} />
            <Text className="text-body text-accent ml-xs">Add</Text>
          </Pressable>
        </View>

        {activePackages.map((pkg) => (
          <Pressable
            key={pkg.id}
            onPress={() => router.push(`/package-form?id=${pkg.id}`)}
          >
            <Card className="mb-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-body-medium text-text-primary">{pkg.name}</Text>
                  <Text className="text-caption text-text-muted mt-xs">
                    {pkg.deliverables.length} deliverable{pkg.deliverables.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Text className="text-body-medium text-text-primary mr-sm">
                  {formatPrice(pkg.price)}
                </Text>
                <ChevronRight size={20} color={darkColors.textMuted} />
              </View>
            </Card>
          </Pressable>
        ))}

        {activePackages.length === 0 && (
          <Text className="text-body text-text-muted text-center py-lg">
            No active packages
          </Text>
        )}

        {/* Deactivated packages */}
        {deactivatedPackages.length > 0 && (
          <View className="mt-md">
            <Pressable
              className="flex-row items-center"
              onPress={() => setShowDeactivated(!showDeactivated)}
            >
              <Text className="text-caption text-text-muted">
                Deactivated ({deactivatedPackages.length})
              </Text>
              <ChevronRight
                size={14}
                color={darkColors.textMuted}
                style={{ transform: [{ rotate: showDeactivated ? "90deg" : "0deg" }] }}
              />
            </Pressable>

            {showDeactivated &&
              deactivatedPackages.map((pkg) => (
                <Pressable
                  key={pkg.id}
                  onPress={() => router.push(`/package-form?id=${pkg.id}`)}
                >
                  <Card className="mb-sm mt-sm opacity-60">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-body text-text-secondary">{pkg.name}</Text>
                      </View>
                      <Text className="text-body text-text-secondary mr-sm">
                        {formatPrice(pkg.price)}
                      </Text>
                      <ChevronRight size={20} color={darkColors.textMuted} />
                    </View>
                  </Card>
                </Pressable>
              ))}
          </View>
        )}
      </View>

      {/* Logout */}
      <View className="px-lg mt-xl">
        <Button title="Sign Out" variant="ghost" onPress={logout} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Verify files**

Run: `ls apps/mobile/src/app/package-form.tsx && head -3 apps/mobile/src/app/\(tabs\)/settings.tsx`
Expected: `package-form.tsx` exists, `settings.tsx` starts with `import`

---

### Task 8: Install Dependencies + Typecheck + Commit

**Depends on:** All previous tasks

- [ ] **Step 1: Install expo-clipboard (if not already installed in Task 5)**

Run: `cd apps/mobile && pnpm add expo-clipboard` (skip if already done)

- [ ] **Step 2: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. Fix any type issues before committing.

- [ ] **Step 3: Stage and commit**

```bash
git add apps/mobile/src/hooks/ apps/mobile/src/components/PackageForm.tsx apps/mobile/src/components/AvailabilityEditor.tsx apps/mobile/src/app/\(onboarding\)/ apps/mobile/src/app/package-form.tsx apps/mobile/src/app/_layout.tsx apps/mobile/src/app/\(tabs\)/settings.tsx apps/mobile/package.json docs/superpowers/plans/2026-05-08-onboarding-packages.md
git commit -m "feat: add photographer onboarding flow and service packages CRUD

- 4-step onboarding: business identity, first package, availability, booking link
- Reusable PackageForm and AvailabilityEditor components
- usePhotographer and usePackages Firestore hooks
- Onboarding gate in root layout (redirects until onboardingComplete)
- Settings screen with packages list, create, edit, deactivate/reactivate
- Package form modal route for settings CRUD"
```

- [ ] **Step 4: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible
