# Route Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the route optimization Cloud Function and route screen (third tab) so the photographer can optimize their daily shoot order, see lighting annotations, and navigate to each stop.

**Architecture:** A Firebase callable Cloud Function queries confirmed bookings for a date, calls Google Maps Directions API for drive-time-optimized waypoint order, applies a lighting heuristic based on property orientation, and writes the result to `routePlans/{photographerId}_{YYYY-MM-DD}`. The mobile route screen subscribes to this document in real-time, displays stop cards with lighting annotations, and offers navigation handoff to the device's native maps app. Drag-to-reorder is deferred to a follow-up plan.

**Tech Stack:** Firebase Cloud Functions 2nd gen (callable), Google Maps Directions API, React Native + Expo Router, NativeWind, Lucide Icons, `@react-native-firebase/firestore`, `expo-linking`

---

### Task 1: Cloud Function — `routingOptimize`

**Files:**
- Create: `functions/src/routing.ts`
- Modify: `functions/src/index.ts`

**Context files to read:**
- `functions/src/config.ts` — has `googleMapsApiKey`, `REGION`, `FUNCTIONS_CONFIG.routing`
- `packages/shared/src/types/route-plan.ts` — `RoutePlan`, `RouteStop`, `LightingWindow`
- `packages/shared/src/types/booking.ts` — `Booking` shape (property.lat/lng/orientation, schedule.estimatedDuration)
- `packages/shared/src/constants/booking-status.ts` — `PROPERTY_ORIENTATIONS`

- [ ] **Step 1: Create `functions/src/routing.ts`**

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { REGION, FUNCTIONS_CONFIG, googleMapsApiKey } from "./config";

interface OptimizeRequest {
  date: string; // YYYY-MM-DD
}

interface DirectionsLeg {
  distanceMeters: number;
  durationMinutes: number;
}

const LIGHTING_PREFS: Record<string, "morning" | "afternoon" | null> = {
  E: "morning", NE: "morning", SE: "morning",
  W: "afternoon", NW: "afternoon", SW: "afternoon",
  N: null, S: null,
};

function getLightingWindow(
  orientation: string | null,
): { ideal: string; reason: string } {
  if (!orientation || !(orientation in LIGHTING_PREFS)) {
    return { ideal: "", reason: orientation ? "No lighting preference" : "Lighting: unknown orientation" };
  }
  const pref = LIGHTING_PREFS[orientation];
  if (!pref) return { ideal: "", reason: "No lighting preference" };
  if (pref === "morning") return { ideal: "09:00-12:00", reason: `${orientation}-facing front, morning light` };
  return { ideal: "12:00-17:00", reason: `${orientation}-facing front, afternoon light` };
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isInWindow(arrivalMinutes: number, idealWindow: string): boolean {
  if (!idealWindow) return true;
  const [start, end] = idealWindow.split("-").map(timeToMinutes);
  return arrivalMinutes >= start && arrivalMinutes <= end;
}

export const routingOptimize = onCall(
  { region: REGION, ...FUNCTIONS_CONFIG.routing },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

    const { date } = request.data as OptimizeRequest;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD");
    }

    const photographerId = request.auth.uid;
    const db = getFirestore();

    // Get confirmed bookings for this date
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const bookingsSnap = await db
      .collection("bookings")
      .where("photographerId", "==", photographerId)
      .where("status", "==", "confirmed")
      .where("schedule.confirmedDate", ">=", Timestamp.fromDate(dayStart))
      .where("schedule.confirmedDate", "<=", Timestamp.fromDate(dayEnd))
      .get();

    if (bookingsSnap.empty) {
      throw new HttpsError("not-found", "No confirmed bookings for this date");
    }

    const bookings = bookingsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        agent: { name: string };
        property: { address: string; lat: number; lng: number; orientation: string | null };
        schedule: { estimatedDuration: number };
      }),
    }));

    if (bookings.length < 2) {
      // Single booking — no optimization needed, just build the plan
      const b = bookings[0];
      const lw = getLightingWindow(b.property.orientation);
      const stop = {
        bookingId: b.id,
        address: b.property.address,
        lat: b.property.lat,
        lng: b.property.lng,
        sortOrder: 0,
        estimatedArrival: "09:00",
        estimatedDuration: b.schedule.estimatedDuration,
        lightingWindow: lw,
        driveFromPrevious: 0,
      };
      const plan = {
        photographerId,
        date,
        stops: [stop],
        totalDistanceMeters: 0,
        totalDurationMinutes: b.schedule.estimatedDuration,
        isOptimized: true,
        optimizedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docId = `${photographerId}_${date}`;
      await db.collection("routePlans").doc(docId).set(plan);
      return { success: true, docId };
    }

    // Build waypoints string for Directions API
    const origin = `${bookings[0].property.lat},${bookings[0].property.lng}`;
    const dest = `${bookings[bookings.length - 1].property.lat},${bookings[bookings.length - 1].property.lng}`;
    const waypoints = bookings
      .slice(1, -1)
      .map((b) => `${b.property.lat},${b.property.lng}`)
      .join("|");

    const apiKey = googleMapsApiKey.value();
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", dest);
    if (waypoints) {
      url.searchParams.set("waypoints", `optimize:true|${waypoints}`);
    }
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = (await response.json()) as {
      status: string;
      routes: Array<{
        waypoint_order: number[];
        legs: Array<{
          distance: { value: number };
          duration: { value: number };
        }>;
      }>;
    };

    if (data.status !== "OK" || !data.routes.length) {
      throw new HttpsError("internal", `Directions API error: ${data.status}`);
    }

    const route = data.routes[0];
    const waypointOrder = route.waypoint_order;

    // Reorder bookings per Directions API optimization
    // waypointOrder maps intermediate waypoints (index 1..n-2) to their optimized position
    const first = bookings[0];
    const last = bookings[bookings.length - 1];
    const intermediates = bookings.slice(1, -1);
    const reordered = [
      first,
      ...waypointOrder.map((i: number) => intermediates[i]),
      last,
    ];

    // Extract legs (drive times between consecutive stops)
    const legs: DirectionsLeg[] = route.legs.map((leg) => ({
      distanceMeters: leg.distance.value,
      durationMinutes: Math.round(leg.duration.value / 60),
    }));

    // Get photographer's start time for this day of week
    const photographerDoc = await db.collection("photographers").doc(photographerId).get();
    const photographerData = photographerDoc.data();
    const dow = new Date(date).getDay();
    const windows = (photographerData?.availability?.windows ?? []) as Array<{
      dayOfWeek: number;
      startTime: string;
    }>;
    const todayWindow = windows.find((w) => w.dayOfWeek === dow);
    const startMinutes = todayWindow ? timeToMinutes(todayWindow.startTime) : 9 * 60; // default 9am

    // Step 2: Apply lighting adjustment (greedy adjacent swaps)
    const ordered = [...reordered];
    let swapped = true;
    while (swapped) {
      swapped = false;
      for (let i = 0; i < ordered.length - 1; i++) {
        // Calculate arrival times for current pair
        let arrivalI = startMinutes;
        for (let j = 0; j < i; j++) {
          arrivalI += (legs[j]?.durationMinutes ?? 0) + ordered[j].schedule.estimatedDuration;
        }
        const arrivalNext = arrivalI + ordered[i].schedule.estimatedDuration + (legs[i]?.durationMinutes ?? 0);

        const lwI = getLightingWindow(ordered[i].property.orientation);
        const lwNext = getLightingWindow(ordered[i + 1].property.orientation);

        const currentScore =
          (isInWindow(arrivalI, lwI.ideal) ? 1 : 0) +
          (isInWindow(arrivalNext, lwNext.ideal) ? 1 : 0);

        // Check swapped scenario
        const swapArrivalI = arrivalI; // same position
        const swapArrivalNext = arrivalI + ordered[i + 1].schedule.estimatedDuration + (legs[i]?.durationMinutes ?? 0);
        const swapScore =
          (isInWindow(swapArrivalI, lwNext.ideal) ? 1 : 0) +
          (isInWindow(swapArrivalNext, lwI.ideal) ? 1 : 0);

        if (swapScore > currentScore) {
          [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
          swapped = true;
        }
      }
    }

    // Step 3: Build route plan with computed arrival times
    let totalDistance = 0;
    let cumulativeMinutes = startMinutes;
    const stops = ordered.map((b, i) => {
      const driveFromPrevious = i === 0 ? 0 : (legs[i - 1]?.durationMinutes ?? 0);
      if (i > 0) cumulativeMinutes += driveFromPrevious;
      const estimatedArrival = minutesToTime(cumulativeMinutes);
      const lw = getLightingWindow(b.property.orientation);
      cumulativeMinutes += b.schedule.estimatedDuration;
      if (i < legs.length) totalDistance += legs[i]?.distanceMeters ?? 0;

      return {
        bookingId: b.id,
        address: b.property.address,
        lat: b.property.lat,
        lng: b.property.lng,
        sortOrder: i,
        estimatedArrival,
        estimatedDuration: b.schedule.estimatedDuration,
        lightingWindow: lw,
        driveFromPrevious,
      };
    });

    const totalDurationMinutes = cumulativeMinutes - startMinutes;
    const plan = {
      photographerId,
      date,
      stops,
      totalDistanceMeters: totalDistance,
      totalDurationMinutes,
      isOptimized: true,
      optimizedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docId = `${photographerId}_${date}`;
    await db.collection("routePlans").doc(docId).set(plan);
    return { success: true, docId };
  },
);
```

- [ ] **Step 2: Export from `functions/src/index.ts`**

Add this line after the health export:

```typescript
export { routingOptimize } from "./routing";
```

Remove the commented-out routing line.

- [ ] **Step 3: Commit**

```bash
git add functions/src/routing.ts functions/src/index.ts
git commit -m "feat: add routingOptimize Cloud Function with lighting heuristic"
```

---

### Task 2: `useRoutePlan` hook

**Files:**
- Create: `apps/mobile/src/hooks/useRoutePlan.ts`

**Context files to read:**
- `apps/mobile/src/hooks/useBookings.ts` — pattern for Firestore real-time listener
- `apps/mobile/src/contexts/AuthContext.tsx` — `useAuth` provides `user.uid`
- `packages/shared/src/types/route-plan.ts` — `RoutePlan` type

- [ ] **Step 1: Create `apps/mobile/src/hooks/useRoutePlan.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import type { RoutePlan } from "@shotready/shared";

export function useRoutePlan(date: string) {
  const { user } = useAuth();
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !date) {
      setRoutePlan(null);
      setIsLoading(false);
      return;
    }

    const docId = `${user.uid}_${date}`;
    const unsubscribe = firestore()
      .collection("routePlans")
      .doc(docId)
      .onSnapshot(
        (doc) => {
          setRoutePlan(doc.exists ? (doc.data() as RoutePlan) : null);
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );

    return unsubscribe;
  }, [user, date]);

  const optimizeRoute = useCallback(async () => {
    if (!user || !date) return;
    setIsOptimizing(true);
    setError(null);
    try {
      await functions().httpsCallable("routingOptimize")({ date });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to optimize route");
    } finally {
      setIsOptimizing(false);
    }
  }, [user, date]);

  return { routePlan, isLoading, isOptimizing, error, optimizeRoute };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useRoutePlan.ts
git commit -m "feat: add useRoutePlan hook with real-time listener and optimize action"
```

---

### Task 3: Route screen components — `DateNavigation`

**Files:**
- Create: `apps/mobile/src/components/route/DateNavigation.tsx`

**Context files to read:**
- `apps/mobile/src/theme/colors.ts` — `darkColors` for styling
- `apps/mobile/src/components/ui/Button.tsx` — existing button pattern (if reusable)

- [ ] **Step 1: Create `apps/mobile/src/components/route/DateNavigation.tsx`**

```typescript
import { View, Text, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface DateNavigationProps {
  date: Date;
  onPrevious: () => void;
  onNext: () => void;
}

function formatDate(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let label = "";
  if (isSameDay(d, today)) label = "Today, ";
  else if (isSameDay(d, tomorrow)) label = "Tomorrow, ";
  else if (isSameDay(d, yesterday)) label = "Yesterday, ";

  return `${label}${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

export function DateNavigation({ date, onPrevious, onNext }: DateNavigationProps) {
  return (
    <View className="flex-row items-center justify-between px-lg py-md">
      <Pressable onPress={onPrevious} className="p-sm" hitSlop={8}>
        <ChevronLeft size={24} color={darkColors.textPrimary} />
      </Pressable>
      <Text className="text-h3 text-text-primary">{formatDate(date)}</Text>
      <Pressable onPress={onNext} className="p-sm" hitSlop={8}>
        <ChevronRight size={24} color={darkColors.textPrimary} />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/route/DateNavigation.tsx
git commit -m "feat: add DateNavigation component for route screen"
```

---

### Task 4: Route screen components — `RouteSummary` and `StopCard`

**Files:**
- Create: `apps/mobile/src/components/route/RouteSummary.tsx`
- Create: `apps/mobile/src/components/route/StopCard.tsx`

**Context files to read:**
- `packages/shared/src/types/route-plan.ts` — `RouteStop`, `RoutePlan`

- [ ] **Step 1: Create `apps/mobile/src/components/route/RouteSummary.tsx`**

```typescript
import { View, Text } from "react-native";
import { CheckCircle, RefreshCw } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface RouteSummaryProps {
  stopCount: number;
  totalDurationMinutes: number;
  totalDistanceMeters: number;
  isOptimized: boolean;
}

export function RouteSummary({
  stopCount,
  totalDurationMinutes,
  totalDistanceMeters,
  isOptimized,
}: RouteSummaryProps) {
  const hours = Math.floor(totalDurationMinutes / 60);
  const mins = totalDurationMinutes % 60;
  const miles = Math.round(totalDistanceMeters / 1609.34);
  const timeStr = hours > 0 ? `${hours}hr ${mins}min` : `${mins}min`;

  return (
    <View className="flex-row items-center justify-between px-lg py-sm bg-surface rounded-lg mx-lg">
      <View className="flex-row items-center gap-md">
        <Text className="text-body text-text-primary font-semibold">{stopCount} stops</Text>
        <Text className="text-caption text-text-secondary">{timeStr}</Text>
        <Text className="text-caption text-text-secondary">{miles} mi</Text>
      </View>
      <View className="flex-row items-center gap-xs">
        {isOptimized ? (
          <>
            <CheckCircle size={14} color={darkColors.success} />
            <Text className="text-caption text-success">Optimized</Text>
          </>
        ) : (
          <>
            <RefreshCw size={14} color={darkColors.textMuted} />
            <Text className="text-caption text-text-muted">Not optimized</Text>
          </>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Create `apps/mobile/src/components/route/StopCard.tsx`**

```typescript
import { View, Text, Pressable } from "react-native";
import { Navigation, Sun, Car } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import type { RouteStop } from "@shotready/shared";

interface StopCardProps {
  stop: RouteStop;
  index: number;
  agentName: string;
  onNavigate: () => void;
}

function formatArrival(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")}${suffix}`;
}

function getLightingColor(lightingWindow: RouteStop["lightingWindow"]): string {
  if (!lightingWindow.ideal) return darkColors.textMuted;
  // Check if arrival is within the ideal window
  return darkColors.success; // green — detailed check done at render
}

function getLightingLabel(lw: RouteStop["lightingWindow"]): string {
  if (!lw.ideal) return lw.reason;
  return `Best light: ${lw.ideal.replace("-", "-")}`;
}

export function StopCard({ stop, index, agentName, onNavigate }: StopCardProps) {
  return (
    <View>
      {/* Drive time connector (skip for first stop) */}
      {stop.driveFromPrevious > 0 && (
        <View className="flex-row items-center px-lg py-xs ml-[40px]">
          <Car size={14} color={darkColors.textMuted} />
          <Text className="text-caption text-text-muted ml-xs">
            {stop.driveFromPrevious} min drive
          </Text>
        </View>
      )}

      {/* Stop card */}
      <View className="flex-row items-start px-lg py-md bg-surface mx-lg rounded-lg">
        {/* Left: stop number */}
        <View className="w-[40px] items-center pt-xs">
          <Text className="text-body text-text-secondary font-semibold">{index + 1}.</Text>
        </View>

        {/* Center: details */}
        <View className="flex-1">
          <Text className="text-body text-text-primary" numberOfLines={1}>
            {stop.address}
          </Text>
          <Text className="text-caption text-text-secondary mt-xxs">
            {agentName} · {stop.estimatedDuration}min shoot
          </Text>
          <View className="flex-row items-center mt-xxs">
            <Sun size={12} color={getLightingColor(stop.lightingWindow)} />
            <Text
              className="text-caption ml-xxs"
              style={{ color: getLightingColor(stop.lightingWindow) }}
            >
              {getLightingLabel(stop.lightingWindow)}
            </Text>
          </View>
        </View>

        {/* Right: arrival time + navigate */}
        <View className="items-end gap-sm">
          <Text className="text-h3 text-accent">{formatArrival(stop.estimatedArrival)}</Text>
          <Pressable onPress={onNavigate} hitSlop={8}>
            <Navigation size={20} color={darkColors.accent} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/route/RouteSummary.tsx apps/mobile/src/components/route/StopCard.tsx
git commit -m "feat: add RouteSummary and StopCard components for route screen"
```

---

### Task 5: Route screen integration

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/route.tsx`

**Context files to read:**
- `apps/mobile/src/app/(tabs)/index.tsx` — pattern for screen layout with SafeAreaView
- `apps/mobile/src/hooks/useBookings.ts` — to get confirmed booking agent names
- `apps/mobile/src/hooks/useConnectivity.ts` — disable optimize when offline
- `apps/mobile/src/components/route/DateNavigation.tsx` (Task 3)
- `apps/mobile/src/components/route/RouteSummary.tsx` (Task 4)
- `apps/mobile/src/components/route/StopCard.tsx` (Task 4)
- `apps/mobile/src/hooks/useRoutePlan.ts` (Task 2)

- [ ] **Step 1: Rewrite `apps/mobile/src/app/(tabs)/route.tsx`**

```typescript
import { useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Route as RouteIcon } from "lucide-react-native";
import { darkColors } from "@/theme/colors";
import { useBookings } from "@/hooks/useBookings";
import { useRoutePlan } from "@/hooks/useRoutePlan";
import { useConnectivity } from "@/hooks/useConnectivity";
import { DateNavigation } from "@/components/route/DateNavigation";
import { RouteSummary } from "@/components/route/RouteSummary";
import { StopCard } from "@/components/route/StopCard";

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function openMaps(lat: number, lng: number) {
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  Linking.openURL(url);
}

export default function RouteScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = toDateString(selectedDate);
  const { bookings } = useBookings();
  const { routePlan, isLoading, isOptimizing, error, optimizeRoute } = useRoutePlan(dateStr);
  const { isOnline } = useConnectivity();

  // Get confirmed bookings for the selected date
  const confirmedForDate = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== "confirmed") return false;
      if (!b.schedule.confirmedDate) return false;
      const bDate = (b.schedule.confirmedDate as unknown as { toDate: () => Date }).toDate();
      return toDateString(bDate) === dateStr;
    });
  }, [bookings, dateStr]);

  // Map booking IDs to agent names for StopCard
  const agentNames = useMemo(() => {
    const map: Record<string, string> = {};
    bookings.forEach((b) => { map[b.id] = b.agent.name; });
    return map;
  }, [bookings]);

  const navigateDate = useCallback((direction: 1 | -1) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction);
      return next;
    });
  }, []);

  const canOptimize = isOnline && confirmedForDate.length >= 2 && !isOptimizing;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-lg pt-md pb-sm">
        <Text className="text-h1 text-text-primary">Route</Text>
      </View>

      <DateNavigation
        date={selectedDate}
        onPrevious={() => navigateDate(-1)}
        onNext={() => navigateDate(1)}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={darkColors.accent} />
        </View>
      ) : confirmedForDate.length === 0 ? (
        /* Empty state: no bookings */
        <View className="flex-1 items-center justify-center px-xl">
          <MapPin size={48} color={darkColors.textMuted} strokeWidth={1.25} />
          <Text className="text-h3 text-text-secondary mt-md text-center">
            No confirmed shoots
          </Text>
          <Text className="text-body text-text-muted mt-sm text-center">
            Confirmed bookings for this date will appear here
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Route summary (if plan exists) */}
          {routePlan && (
            <RouteSummary
              stopCount={routePlan.stops.length}
              totalDurationMinutes={routePlan.totalDurationMinutes}
              totalDistanceMeters={routePlan.totalDistanceMeters}
              isOptimized={routePlan.isOptimized}
            />
          )}

          {/* Optimize button */}
          <View className="px-lg py-md">
            <Pressable
              onPress={optimizeRoute}
              disabled={!canOptimize}
              className={`flex-row items-center justify-center py-sm px-lg rounded-lg ${
                canOptimize ? "bg-accent" : "bg-surface"
              }`}
            >
              {isOptimizing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <RouteIcon size={18} color={canOptimize ? "#fff" : darkColors.textMuted} />
                  <Text
                    className={`ml-sm font-semibold ${
                      canOptimize ? "text-white" : "text-text-muted"
                    }`}
                  >
                    {routePlan?.isOptimized ? "Re-optimize" : "Optimize Route"}
                  </Text>
                </>
              )}
            </Pressable>
            {!isOnline && (
              <Text className="text-caption text-warning text-center mt-xs">
                Route optimization requires internet
              </Text>
            )}
            {error && (
              <Text className="text-caption text-error text-center mt-xs">{error}</Text>
            )}
          </View>

          {/* Stop list */}
          {routePlan ? (
            <View className="gap-sm">
              {routePlan.stops.map((stop, i) => (
                <StopCard
                  key={stop.bookingId}
                  stop={stop}
                  index={i}
                  agentName={agentNames[stop.bookingId] ?? "Agent"}
                  onNavigate={() => openMaps(stop.lat, stop.lng)}
                />
              ))}
            </View>
          ) : (
            /* Has bookings but no route plan yet */
            <View className="items-center px-xl mt-lg">
              <Text className="text-body text-text-secondary text-center">
                {confirmedForDate.length} confirmed shoot{confirmedForDate.length !== 1 ? "s" : ""}.
                Tap "Optimize Route" to plan your day.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/(tabs)/route.tsx
git commit -m "feat: build route screen with stop cards, lighting, and map navigation"
```

---

### Task 6: Typecheck all packages

- [ ] **Step 1: Run typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 2: Final commit (if fixes needed)**

```bash
git add -A && git commit -m "fix: resolve typecheck errors in route feature"
```
