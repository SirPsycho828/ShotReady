import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { googleMapsApiKey, REGION, FUNCTIONS_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Internal type aliases (mirrors shared package types without importing them)
// ---------------------------------------------------------------------------

interface LightingWindow {
  ideal: string;
  reason: string;
}

interface RouteStop {
  bookingId: string;
  address: string;
  lat: number;
  lng: number;
  sortOrder: number;
  estimatedArrival: string; // "09:30" (24h)
  estimatedDuration: number; // minutes
  lightingWindow: LightingWindow;
  driveFromPrevious: number; // minutes
}

interface RoutePlan {
  photographerId: string;
  date: string; // YYYY-MM-DD
  stops: RouteStop[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  isOptimized: boolean;
  optimizedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface BookingDoc {
  photographerId: string;
  status: string;
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
    orientation: string | null;
  };
  schedule: {
    confirmedDate: Timestamp | null;
    estimatedDuration: number;
  };
}

interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface PhotographerDoc {
  availability: {
    windows: AvailabilityWindow[];
    blockedDates: string[];
  };
}

// ---------------------------------------------------------------------------
// Lighting heuristic
// ---------------------------------------------------------------------------

type LightingPeriod = "morning" | "afternoon" | null;

const MORNING_ORIENTATIONS = new Set(["E", "NE", "SE"]);
const AFTERNOON_ORIENTATIONS = new Set(["W", "NW", "SW"]);

function getLightingPeriod(orientation: string | null): LightingPeriod {
  if (!orientation) return null;
  if (MORNING_ORIENTATIONS.has(orientation)) return "morning";
  if (AFTERNOON_ORIENTATIONS.has(orientation)) return "afternoon";
  return null; // N, S
}

function buildLightingWindow(orientation: string | null): LightingWindow {
  if (!orientation) {
    return { ideal: "", reason: "Lighting: unknown orientation" };
  }
  const period = getLightingPeriod(orientation);
  if (period === "morning") {
    return {
      ideal: "09:00-12:00",
      reason: `${orientation}-facing front, morning light`,
    };
  }
  if (period === "afternoon") {
    return {
      ideal: "12:00-17:00",
      reason: `${orientation}-facing front, afternoon light`,
    };
  }
  // N or S
  return { ideal: "", reason: "No lighting preference" };
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" into total minutes from midnight. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes from midnight to "HH:MM". */
function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Google Maps Directions API
// ---------------------------------------------------------------------------

interface WaypointInfo {
  bookingId: string;
  lat: number;
  lng: number;
  address: string;
  estimatedDuration: number;
  orientation: string | null;
}

interface DirectionsLeg {
  distance: { value: number }; // metres
  duration: { value: number }; // seconds
}

interface DirectionsRoute {
  waypoint_order: number[];
  legs: DirectionsLeg[];
  overview_polyline?: unknown;
}

interface DirectionsResponse {
  status: string;
  routes: DirectionsRoute[];
}

async function callDirectionsApi(
  waypoints: WaypointInfo[]
): Promise<{ waypointOrder: number[]; legs: DirectionsLeg[] } | null> {
  if (waypoints.length < 2) return null;

  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const intermediates = waypoints
    .slice(1, -1)
    .map((w) => `${w.lat},${w.lng}`)
    .join("|");

  const params = new URLSearchParams({
    origin,
    destination,
    key: googleMapsApiKey.value(),
    optimize_waypoints: "true", // deprecated param name kept for compat; will use optimizeWaypoints below
  });

  // Build the URL manually to use the correct param name
  const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
  const url =
    `${baseUrl}?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (intermediates ? `&waypoints=optimize:true|${encodeURIComponent(intermediates)}` : "") +
    `&key=${googleMapsApiKey.value()}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error("Directions API HTTP error", response.status);
    return null;
  }

  const data = (await response.json()) as DirectionsResponse;
  if (data.status !== "OK" || !data.routes.length) {
    console.error("Directions API non-OK status", data.status);
    return null;
  }

  const route = data.routes[0];
  return {
    waypointOrder: route.waypoint_order,
    legs: route.legs,
  };
}

// ---------------------------------------------------------------------------
// Lighting heuristic — greedy adjacent swaps
// ---------------------------------------------------------------------------

/**
 * Returns a score for the order of stops: lower is better.
 * Morning stops early score well; afternoon stops later score well.
 */
function computeOrderScore(
  stops: WaypointInfo[],
  startMinutes: number
): number {
  let score = 0;
  let cursor = startMinutes;
  stops.forEach((stop, i) => {
    const period = getLightingPeriod(stop.orientation);
    if (period === "morning") {
      // Penalise afternoon arrivals for morning-preferred stops
      if (cursor >= timeToMinutes("12:00")) score += cursor - timeToMinutes("12:00");
    } else if (period === "afternoon") {
      // Penalise morning arrivals for afternoon-preferred stops
      if (cursor < timeToMinutes("12:00")) score += timeToMinutes("12:00") - cursor;
    }
    // Add estimated duration to cursor (drive times are ignored in scoring for simplicity)
    cursor += stop.estimatedDuration;
  });
  return score;
}

const SWAP_THRESHOLD_MINUTES = 15;

/**
 * Apply greedy adjacent swaps guided by the lighting heuristic.
 * Only swaps if both new positions improve and the reorder costs ≤15 min extra.
 */
function applyLightingSwaps(
  stops: WaypointInfo[],
  legDurationsSeconds: number[],
  startMinutes: number
): WaypointInfo[] {
  const arr = [...stops];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < arr.length - 1; i++) {
      const scoreBefore = computeOrderScore(arr, startMinutes);

      // Swap i and i+1
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      const scoreAfter = computeOrderScore(arr, startMinutes);

      // Estimate extra time cost of this swap using the adjacent leg durations
      const legCost =
        (legDurationsSeconds[i] ?? 0) / 60;

      if (scoreAfter < scoreBefore && legCost <= SWAP_THRESHOLD_MINUTES) {
        improved = true; // keep swap, continue scanning
      } else {
        // Revert
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      }
    }
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Build route plan helpers
// ---------------------------------------------------------------------------

/**
 * Compute arrival times and drive durations for a sequence of stops, given
 * per-leg drive durations in seconds.
 */
function buildStops(
  orderedWaypoints: WaypointInfo[],
  legDurationsSeconds: number[],
  legDistanceMeters: number[],
  startMinutes: number
): RouteStop[] {
  let cursor = startMinutes;
  return orderedWaypoints.map((wp, idx) => {
    const driveFromPrevious = idx === 0 ? 0 : Math.round((legDurationsSeconds[idx - 1] ?? 0) / 60);
    cursor += driveFromPrevious;

    const stop: RouteStop = {
      bookingId: wp.bookingId,
      address: wp.address,
      lat: wp.lat,
      lng: wp.lng,
      sortOrder: idx,
      estimatedArrival: minutesToTime(cursor),
      estimatedDuration: wp.estimatedDuration,
      lightingWindow: buildLightingWindow(wp.orientation),
      driveFromPrevious,
    };

    cursor += wp.estimatedDuration;
    return stop;
  });
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const routingOptimize = onCall(
  {
    region: REGION,
    memory: FUNCTIONS_CONFIG.routing.memory,
    timeoutSeconds: FUNCTIONS_CONFIG.routing.timeoutSeconds,
  },
  async (request) => {
    // --- Auth check ---
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const photographerId = request.auth.uid;

    // --- Validate date parameter ---
    const date: unknown = request.data?.date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpsError("invalid-argument", "date must be a string in YYYY-MM-DD format.");
    }

    // Compute start-of-day and end-of-day Timestamps for the given date
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    if (isNaN(dayStart.getTime())) {
      throw new HttpsError("invalid-argument", "date is not a valid calendar date.");
    }

    const db = getFirestore();

    // --- Query confirmed bookings for the date ---
    const bookingsSnap = await db
      .collection("bookings")
      .where("photographerId", "==", photographerId)
      .where("status", "==", "confirmed")
      .where("schedule.confirmedDate", ">=", Timestamp.fromDate(dayStart))
      .where("schedule.confirmedDate", "<=", Timestamp.fromDate(dayEnd))
      .get();

    const bookingDocs = bookingsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as BookingDoc),
    }));

    // --- Get photographer availability window for day-of-week ---
    const photographerSnap = await db.collection("photographers").doc(photographerId).get();
    const photographerData = photographerSnap.data() as PhotographerDoc | undefined;

    const dayOfWeek = dayStart.getUTCDay(); // 0=Sun, 6=Sat (date is UTC midnight)
    const availabilityWindow = photographerData?.availability?.windows?.find(
      (w) => w.dayOfWeek === dayOfWeek
    );
    const startTimeStr = availabilityWindow?.startTime ?? "09:00";
    const startMinutes = timeToMinutes(startTimeStr);

    // --- Single booking: simple single-stop plan ---
    if (bookingDocs.length === 0) {
      const now = Timestamp.now();
      const emptyPlan: RoutePlan = {
        photographerId,
        date,
        stops: [],
        totalDistanceMeters: 0,
        totalDurationMinutes: 0,
        isOptimized: false,
        optimizedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db
        .collection("routePlans")
        .doc(`${photographerId}_${date}`)
        .set(emptyPlan);
      return emptyPlan;
    }

    if (bookingDocs.length === 1) {
      const b = bookingDocs[0];
      const address = `${b.property.address}, ${b.property.city}, ${b.property.state} ${b.property.zip}`;
      const stop: RouteStop = {
        bookingId: b.id,
        address,
        lat: b.property.lat,
        lng: b.property.lng,
        sortOrder: 0,
        estimatedArrival: startTimeStr,
        estimatedDuration: b.schedule.estimatedDuration,
        lightingWindow: buildLightingWindow(b.property.orientation),
        driveFromPrevious: 0,
      };

      const now = Timestamp.now();
      const plan: RoutePlan = {
        photographerId,
        date,
        stops: [stop],
        totalDistanceMeters: 0,
        totalDurationMinutes: b.schedule.estimatedDuration,
        isOptimized: false,
        optimizedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db
        .collection("routePlans")
        .doc(`${photographerId}_${date}`)
        .set(plan);
      return plan;
    }

    // --- 2+ bookings: call Directions API, apply lighting heuristic ---
    const waypoints: WaypointInfo[] = bookingDocs.map((b) => ({
      bookingId: b.id,
      lat: b.property.lat,
      lng: b.property.lng,
      address: `${b.property.address}, ${b.property.city}, ${b.property.state} ${b.property.zip}`,
      estimatedDuration: b.schedule.estimatedDuration,
      orientation: b.property.orientation,
    }));

    let orderedWaypoints = waypoints;
    let legDurationsSeconds: number[] = new Array(waypoints.length - 1).fill(0);
    let legDistanceMeters: number[] = new Array(waypoints.length - 1).fill(0);
    let totalDistanceMeters = 0;
    let isOptimized = false;
    let optimizedAt: Timestamp | null = null;

    try {
      const directionsResult = await callDirectionsApi(waypoints);

      if (directionsResult) {
        // Re-order waypoints according to Google's optimized order.
        // Google returns waypoint_order for the intermediate points only.
        // For N stops: indices 0..N-1 in waypoints array.
        // Google treats waypoints[0] as origin and waypoints[N-1] as destination (fixed),
        // and optimizes waypoints[1..N-2].
        // However, since all stops are "waypoints" in the photographer's day, we pass
        // all as via-waypoints except origin=first and destination=last.
        // The returned waypoint_order applies to the slice [1, N-2].
        const { waypointOrder, legs } = directionsResult;

        // Reconstruct the full ordered array: origin + optimized midpoints + destination
        const mid = waypoints.slice(1, -1);
        const orderedMid = waypointOrder.map((i) => mid[i]);
        orderedWaypoints = [waypoints[0], ...orderedMid, waypoints[waypoints.length - 1]];

        legDurationsSeconds = legs.map((l) => l.duration.value);
        legDistanceMeters = legs.map((l) => l.distance.value);
        totalDistanceMeters = legDistanceMeters.reduce((a, b) => a + b, 0);
        isOptimized = true;
        optimizedAt = Timestamp.now();

        // Apply lighting heuristic swaps
        orderedWaypoints = applyLightingSwaps(
          orderedWaypoints,
          legDurationsSeconds,
          startMinutes
        );
      }
    } catch (err) {
      console.error("Directions API call failed, falling back to original order", err);
    }

    // Build stops with arrival times
    const stops = buildStops(
      orderedWaypoints,
      legDurationsSeconds,
      legDistanceMeters,
      startMinutes
    );

    const totalDurationMinutes =
      stops.reduce((acc, s) => acc + s.estimatedDuration + s.driveFromPrevious, 0);

    const now = Timestamp.now();
    const plan: RoutePlan = {
      photographerId,
      date,
      stops,
      totalDistanceMeters,
      totalDurationMinutes,
      isOptimized,
      optimizedAt,
      createdAt: now,
      updatedAt: now,
    };

    await db
      .collection("routePlans")
      .doc(`${photographerId}_${date}`)
      .set(plan);

    return plan;
  }
);
