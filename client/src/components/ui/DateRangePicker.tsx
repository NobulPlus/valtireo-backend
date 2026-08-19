import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onChange: (range: { dateFrom: string; dateTo: string }) => void;
  className?: string;
}

interface Preset {
  label: string;
  range: () => { start: Date | null; end: Date | null };
}

interface PanelPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 8;
// Presets rail (176) + two 248px calendars + nav arrows + gaps/padding — see
// MonthGrid below. Measured via the rendered scrollWidth, not a guess: a
// narrower panel here clips the Cancel/Apply footer via the panel's own
// overflow-auto (it looks like off-screen clipping but it isn't — it's this
// panel being narrower than its own content).
const PANEL_WIDTH = 840;
const MAX_PANEL_HEIGHT = 480;

/**
 * Portal-positioned like SelectMenu's computePosition, but this panel is
 * much wider (two calendars + a presets rail), so it also clamps
 * horizontally — a plain `absolute right-0` overflowed the viewport
 * whenever the trigger sat inside a narrower flex/grid cell than the
 * panel itself needs.
 */
function computePosition(trigger: HTMLElement): PanelPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
  const spaceBelow = window.innerHeight - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;

  if (spaceBelow < MAX_PANEL_HEIGHT && spaceAbove > spaceBelow) {
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left,
      width,
      maxHeight: Math.min(MAX_PANEL_HEIGHT, spaceAbove),
    };
  }

  return {
    top: rect.bottom + GAP,
    left,
    width,
    maxHeight: Math.min(MAX_PANEL_HEIGHT, Math.max(spaceBelow, 200)),
  };
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

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

function sameDay(a: Date | null, b: Date | null): boolean {
  return Boolean(a && b && toInputDate(a) === toInputDate(b));
}

function inRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const time = day.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date);
}

function formatShort(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
}

function calendarDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  // Monday-first grid, matching the WEEKDAYS header order.
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

const PRESETS: Preset[] = [
  { label: 'Today', range: () => { const today = new Date(); return { start: today, end: today }; } },
  { label: 'Last 7 days', range: () => { const today = new Date(); return { start: addDays(today, -6), end: today }; } },
  { label: 'Last 30 days', range: () => { const today = new Date(); return { start: addDays(today, -29), end: today }; } },
  { label: 'Last 3 months', range: () => { const today = new Date(); return { start: addMonths(today, -3), end: today }; } },
  { label: 'Last 12 months', range: () => { const today = new Date(); return { start: addMonths(today, -12), end: today }; } },
  { label: 'Month to date', range: () => { const today = new Date(); return { start: startOfMonth(today), end: today }; } },
  { label: 'Year to date', range: () => { const today = new Date(); return { start: startOfYear(today), end: today }; } },
  { label: 'All time', range: () => ({ start: null, end: null }) },
];

export function DateRangePicker({ dateFrom, dateTo, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [cursor, setCursor] = useState(() => fromInputDate(dateFrom) ?? new Date());
  const [draftStart, setDraftStart] = useState<Date | null>(() => fromInputDate(dateFrom));
  const [draftEnd, setDraftEnd] = useState<Date | null>(() => fromInputDate(dateTo));
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const committedStart = fromInputDate(dateFrom);
  const committedEnd = fromInputDate(dateTo);
  const label = dateFrom && dateTo ? `${formatShort(committedStart)} – ${formatShort(committedEnd)}` : 'Select date range';

  const leftMonth = cursor;
  const rightMonth = useMemo(() => addMonths(cursor, 1), [cursor]);
  const leftDays = useMemo(() => calendarDays(leftMonth), [leftMonth]);
  const rightDays = useMemo(() => calendarDays(rightMonth), [rightMonth]);

  function openPicker() {
    // Re-seed the draft from the last committed value every time it opens,
    // so a cancelled edit never leaks into the next time it's opened.
    setDraftStart(committedStart);
    setDraftEnd(committedEnd);
    setCursor(committedStart ?? new Date());
    setOpen(true);
  }

  function moveMonths(direction: number) {
    setCursor((current) => addMonths(current, direction));
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

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
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectDay(day: Date) {
    if (!draftStart || (draftStart && draftEnd) || day < draftStart) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }

    setDraftEnd(day);
  }

  function selectPreset(preset: Preset) {
    const { start, end } = preset.range();
    setDraftStart(start);
    setDraftEnd(end);
    setCursor(start ?? new Date());
  }

  function handleApply() {
    onChange({
      dateFrom: draftStart ? toInputDate(draftStart) : '',
      dateTo: draftEnd ? toInputDate(draftEnd) : '',
    });
    setOpen(false);
  }

  function handleCancel() {
    setDraftStart(committedStart);
    setDraftEnd(committedEnd);
    setOpen(false);
  }

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-white px-3 text-sm text-strong shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:min-w-[210px]"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 flex-shrink-0 text-teal" />
          <span className={cn('truncate', !dateFrom && 'text-muted')}>{label}</span>
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="z-[60] flex overflow-auto rounded-lg border border-border bg-white shadow-xl"
          >
          <div className="w-44 flex-shrink-0 border-r border-border p-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => selectPreset(preset)}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-strong transition-colors hover:bg-surface-soft"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-4 p-4">
              <button
                type="button"
                onClick={() => moveMonths(-1)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <MonthGrid
                month={leftMonth}
                days={leftDays}
                start={draftStart}
                end={draftEnd}
                onSelectDay={selectDay}
                monthLabelExtra={String(leftMonth.getFullYear())}
              />
              <MonthGrid
                month={rightMonth}
                days={rightDays}
                start={draftStart}
                end={draftEnd}
                onSelectDay={selectDay}
                monthLabelExtra={String(rightMonth.getFullYear())}
              />

              <button
                type="button"
                onClick={() => moveMonths(1)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted">
                {draftStart ? `Range: ${formatShort(draftStart)} - ${draftEnd ? formatShort(draftEnd) : '…'}` : 'Select a range'}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={handleApply}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MonthGrid({
  month,
  days,
  start,
  end,
  onSelectDay,
  monthLabelExtra,
}: {
  month: Date;
  days: Date[];
  start: Date | null;
  end: Date | null;
  onSelectDay: (day: Date) => void;
  monthLabelExtra: string;
}) {
  return (
    <div className="w-[248px] flex-shrink-0">
      <div className="mb-3 flex justify-center gap-2">
        <span className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-strong">
          {monthLabel(month)}
        </span>
        <span className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-strong">
          {monthLabelExtra}
        </span>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, index) => {
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isStart = sameDay(day, start);
          const isEnd = sameDay(day, end);
          const isEndpoint = isStart || isEnd;
          const withinRange = inRange(day, start, end);
          const showRangeBackground = withinRange || isEndpoint;
          const isRowStart = index % 7 === 0;
          const isRowEnd = index % 7 === 6;
          const roundLeft = isStart || isRowStart;
          const roundRight = isEnd || isRowEnd;

          return (
            <div
              key={toInputDate(day)}
              className={cn(
                'flex h-9 items-center justify-center',
                showRangeBackground && 'bg-teal/15',
                showRangeBackground && roundLeft && 'rounded-l-full',
                showRangeBackground && roundRight && 'rounded-r-full',
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                  isCurrentMonth ? 'text-strong' : 'text-muted/40',
                  isEndpoint ? 'bg-pine text-white hover:bg-pine' : 'hover:bg-white',
                )}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
