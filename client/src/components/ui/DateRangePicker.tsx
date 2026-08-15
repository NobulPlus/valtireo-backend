import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onChange: (range: { dateFrom: string; dateTo: string }) => void;
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function fromInputDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a: Date | null, b: Date): boolean {
  return Boolean(a && toInputDate(a) === toInputDate(b));
}

function inRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const time = day.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

export function DateRangePicker({ dateFrom, dateTo, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => fromInputDate(dateFrom) ?? new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedStart = fromInputDate(dateFrom);
  const selectedEnd = fromInputDate(dateTo);
  const days = useMemo(() => calendarDays(cursor), [cursor]);
  const label = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : dateFrom ? `${dateFrom} - Select end` : 'Select date range';

  function moveMonth(direction: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectDay(day: Date) {
    const value = toInputDate(day);

    if (!dateFrom || (dateFrom && dateTo) || day < fromInputDate(dateFrom)!) {
      onChange({ dateFrom: value, dateTo: '' });
      return;
    }

    onChange({ dateFrom, dateTo: value });
    setOpen(false);
  }

  return (
    <div ref={pickerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-white px-3 text-sm text-strong shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:min-w-[210px]"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 flex-shrink-0 text-teal" />
          <span className="truncate">{label}</span>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[320px] rounded-lg border border-border bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-strong">{monthLabel(cursor)}</p>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isCurrentMonth = day.getMonth() === cursor.getMonth();
              const isStart = sameDay(selectedStart, day);
              const isEnd = sameDay(selectedEnd, day);
              const selected = isStart || isEnd;

              return (
                <button
                  key={toInputDate(day)}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    'h-9 rounded-md text-sm transition-colors',
                    isCurrentMonth ? 'text-strong' : 'text-muted/45',
                    inRange(day, selectedStart, selectedEnd) && 'bg-teal/10',
                    selected && 'bg-teal text-white hover:bg-teal',
                    !selected && 'hover:bg-surface-soft',
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
            <span>Pick a start date, then an end date.</span>
            <button type="button" onClick={() => setOpen(false)} className="font-medium text-teal hover:underline">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function calendarDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}
