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
    const day = days[timePicker.dayIndex];
    if (timePicker.field === "startTime" && time >= day.endTime) return;
    if (timePicker.field === "endTime" && time <= day.startTime) return;
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
