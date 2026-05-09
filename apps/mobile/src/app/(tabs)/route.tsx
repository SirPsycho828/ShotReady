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
  if (url) Linking.openURL(url);
}

export default function RouteScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = toDateString(selectedDate);
  const { bookings } = useBookings();
  const { routePlan, isLoading, isOptimizing, error, optimizeRoute } = useRoutePlan(dateStr);
  const { isOnline } = useConnectivity();

  const confirmedForDate = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== "confirmed") return false;
      if (!b.schedule.confirmedDate) return false;
      const bDate = (b.schedule.confirmedDate as unknown as { toDate: () => Date }).toDate();
      return toDateString(bDate) === dateStr;
    });
  }, [bookings, dateStr]);

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
          {routePlan && (
            <RouteSummary
              stopCount={routePlan.stops.length}
              totalDurationMinutes={routePlan.totalDurationMinutes}
              totalDistanceMeters={routePlan.totalDistanceMeters}
              isOptimized={routePlan.isOptimized}
            />
          )}

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
