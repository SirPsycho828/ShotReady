import { View, Text, Pressable } from "react-native";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { darkColors, statusColors } from "@/theme/colors";
import type { BookingWithId } from "@/hooks/useBookings";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthlyGridProps {
  year: number;
  month: number;
  selectedDate: string | null;
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
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
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
