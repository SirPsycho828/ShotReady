import { View, ScrollView } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { useBookings, type BookingWithId } from "@/hooks/useBookings";
import { usePhotographer } from "@/hooks/usePhotographer";
import { MonthlyGrid } from "@/components/MonthlyGrid";
import { DayDetail } from "@/components/DayDetail";
import { SkeletonLoader } from "@/components/ui";

function getTodayInfo() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    dateStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  };
}

function getBookingsForMonth(bookings: BookingWithId[], year: number, month: number): BookingWithId[] {
  return bookings.filter((b) => {
    const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
    const d = new Date(ts.seconds * 1000);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function getBookingsForDate(bookings: BookingWithId[], dateStr: string): BookingWithId[] {
  return bookings.filter((b) => {
    const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
    const d = new Date(ts.seconds * 1000);
    const bDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return bDateStr === dateStr;
  });
}

export default function CalendarScreen() {
  const today = getTodayInfo();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { photographer, isLoading: photographerLoading } = usePhotographer();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState(today.dateStr);

  const monthBookings = useMemo(
    () => getBookingsForMonth(bookings, year, month),
    [bookings, year, month],
  );

  const dayBookings = useMemo(
    () => (selectedDate ? getBookingsForDate(bookings, selectedDate) : []),
    [bookings, selectedDate],
  );

  const handlePrevMonth = useCallback(() => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const isLoading = bookingsLoading || photographerLoading;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-lg pt-lg">
        <SkeletonLoader height={280} borderRadius={12} />
        <View className="mt-md">
          <SkeletonLoader height={100} borderRadius={12} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-2xl">
      <MonthlyGrid
        year={year}
        month={month}
        selectedDate={selectedDate}
        bookings={monthBookings}
        blockedDates={photographer?.availability.blockedDates ?? []}
        onSelectDate={setSelectedDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      <View className="h-[1px] bg-border mx-lg mt-sm" />

      {selectedDate && (
        <DayDetail
          dateStr={selectedDate}
          bookings={dayBookings}
          availabilityWindows={photographer?.availability.windows ?? []}
          blockedDates={photographer?.availability.blockedDates ?? []}
        />
      )}
    </ScrollView>
  );
}
