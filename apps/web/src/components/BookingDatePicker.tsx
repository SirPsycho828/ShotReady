import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailabilityWindow } from "@shotready/shared";

interface BookingDatePickerProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  availabilityWindows: AvailabilityWindow[];
  blockedDates: string[];
}

function getDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDateAvailable(
  date: Date,
  today: Date,
  maxDate: Date,
  windows: AvailabilityWindow[],
  blocked: string[],
): boolean {
  if (date < today || date > maxDate) return false;
  if (blocked.includes(getDateStr(date))) return false;
  const day = date.getDay();
  return windows.some((w) => w.dayOfWeek === day);
}

export function BookingDatePicker({
  selectedDate,
  onSelectDate,
  availabilityWindows,
  blockedDates,
}: BookingDatePickerProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 60);
    return d;
  }, [today]);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const todayStr = getDateStr(today);

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const result: { date: Date; dateStr: string; inMonth: boolean; available: boolean }[] = [];

    for (let i = 0; i < startOffset; i++) {
      const d = new Date(viewYear, viewMonth, 1 - startOffset + i);
      result.push({ date: d, dateStr: getDateStr(d), inMonth: false, available: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      const available = isDateAvailable(d, today, maxDate, availabilityWindows, blockedDates);
      result.push({ date: d, dateStr: getDateStr(d), inMonth: true, available });
    }

    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewYear, viewMonth + 1, i);
        result.push({ date: d, dateStr: getDateStr(d), inMonth: false, available: false });
      }
    }

    return result;
  }, [viewYear, viewMonth, availabilityWindows, blockedDates, today, maxDate]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  function handlePrev() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNext() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="p-1 rounded hover:bg-surface-raised disabled:opacity-30"
        >
          <ChevronLeft size={20} className="text-text-secondary" />
        </button>
        <span className="text-sm font-medium text-text-primary">{monthLabel}</span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          className="p-1 rounded hover:bg-surface-raised disabled:opacity-30"
        >
          <ChevronRight size={20} className="text-text-secondary" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          return (
            <button
              type="button"
              key={cell.dateStr}
              disabled={!cell.available}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`h-9 rounded-lg text-sm transition-colors
                ${!cell.inMonth ? "text-text-muted/30" : ""}
                ${cell.inMonth && !cell.available ? "text-text-muted" : ""}
                ${cell.available && !isSelected ? "text-text-primary hover:bg-surface-raised" : ""}
                ${isSelected ? "bg-accent text-white font-semibold" : ""}
                ${isToday && !isSelected ? "ring-1 ring-accent" : ""}
              `}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
