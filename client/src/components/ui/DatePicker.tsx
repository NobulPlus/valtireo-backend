import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const YEAR_RANGE_BEFORE = 90;
const YEAR_RANGE_AFTER = 10;
const GAP = 8;
const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT_ESTIMATE = 400;

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

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function calendarDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  // Monday-first grid, matching the WEEKDAYS header order.
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function computePosition(trigger: HTMLElement): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;
  const left = Math.min(Math.max(rect.left, GAP), window.innerWidth - POPOVER_WIDTH - GAP);

  if (spaceBelow < POPOVER_HEIGHT_ESTIMATE && spaceAbove > spaceBelow) {
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left,
      maxHeight: Math.min(POPOVER_HEIGHT_ESTIMATE, spaceAbove),
    };
  }

  return {
    top: rect.bottom + GAP,
    left,
    maxHeight: Math.min(POPOVER_HEIGHT_ESTIMATE, Math.max(spaceBelow, 240)),
  };
}

export function DatePicker({ value, onChange, placeholder = 'Select date', className }: DatePickerProps) {
  const { formatDate } = useDateFormatter();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [cursor, setCursor] = useState(() => fromInputDate(value) ?? new Date());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selected = fromInputDate(value);
  const days = useMemo(() => calendarDays(cursor), [cursor]);
  const years = useMemo(() => {
    const selectedYear = selected?.getFullYear() ?? new Date().getFullYear();
    const start = Math.min(selectedYear, new Date().getFullYear()) - YEAR_RANGE_BEFORE;
    const end = Math.max(selectedYear, new Date().getFullYear()) + YEAR_RANGE_AFTER;

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [selected]);

  function moveMonth(direction: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const trigger = triggerRef.current;

    function reposition() {
      setPosition(computePosition(trigger));
    }

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
        setYearPickerOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setYearPickerOpen(false);
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
    onChange(toInputDate(day));
    setOpen(false);
  }

  function selectYear(year: number) {
    setCursor((current) => new Date(year, current.getMonth(), 1));
    setYearPickerOpen(false);
  }

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 text-sm text-strong shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 flex-shrink-0 text-teal" />
          <span className={cn('truncate', !value && 'text-muted')}>{value ? formatDate(value) : placeholder}</span>
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: POPOVER_WIDTH,
              maxHeight: position.maxHeight,
            }}
            className="z-50 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setYearPickerOpen((current) => !current)}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-strong transition-colors hover:bg-surface-soft"
              >
                {monthLabel(cursor)}
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {yearPickerOpen ? (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-surface-soft p-2">
                <div className="grid grid-cols-4 gap-1">
                  {years.map((year) => {
                    const isCursorYear = year === cursor.getFullYear();
                    const isSelectedYear = year === selected?.getFullYear();

                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => selectYear(year)}
                        className={cn(
                          'h-8 rounded-md text-sm transition-colors hover:bg-surface-soft',
                          isCursorYear && 'bg-surface-soft font-semibold text-teal shadow-sm',
                          isSelectedYear && 'ring-1 ring-teal',
                        )}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
                  {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-y-1">
                  {days.map((day) => {
                    const dateValue = toInputDate(day);
                    const isCurrentMonth = day.getMonth() === cursor.getMonth();
                    const isSelected = selected && toInputDate(selected) === dateValue;

                    return (
                      <button
                        key={dateValue}
                        type="button"
                        onClick={() => selectDay(day)}
                        className={cn(
                          'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                          isCurrentMonth ? 'text-strong' : 'text-muted/45',
                          isSelected ? 'bg-pine text-white hover:bg-pine' : 'hover:bg-surface-soft',
                        )}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
              <button type="button" onClick={() => onChange('')} className="font-medium text-muted hover:text-strong">
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (yearPickerOpen) {
                    setYearPickerOpen(false);
                    return;
                  }

                  setOpen(false);
                }}
                className="font-medium text-teal hover:underline"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
