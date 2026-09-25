import { useAuth } from '@/context/AuthContext';

export type DateFormatPattern = 'd/m/Y' | 'm/d/Y' | 'Y-m-d' | 'd M Y';
export type TimeFormatPattern = '12h' | '24h';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_DATE_FORMAT: DateFormatPattern = 'd/m/Y';
const DEFAULT_TIME_FORMAT: TimeFormatPattern = '24h';

function isDateFormatPattern(value: string | undefined): value is DateFormatPattern {
  return value === 'd/m/Y' || value === 'm/d/Y' || value === 'Y-m-d' || value === 'd M Y';
}

function isTimeFormatPattern(value: string | undefined): value is TimeFormatPattern {
  return value === '12h' || value === '24h';
}

/** Pulls the calendar date out of either a bare 'YYYY-MM-DD' or a full ISO timestamp, without going through the Date object (and its timezone shift) for pure date values. */
function extractDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatDateWithPattern(
  value: string | null | undefined,
  pattern: DateFormatPattern = DEFAULT_DATE_FORMAT,
): string {
  if (!value) return '—';

  const parts = extractDateParts(value);
  if (!parts) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatDateWithPattern(date.toISOString(), pattern);
  }

  const { year, month, day } = parts;
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');

  switch (pattern) {
    case 'm/d/Y':
      return `${mm}/${dd}/${year}`;
    case 'Y-m-d':
      return `${year}-${mm}-${dd}`;
    case 'd M Y':
      return `${dd} ${MONTH_SHORT[month - 1]} ${year}`;
    case 'd/m/Y':
    default:
      return `${dd}/${mm}/${year}`;
  }
}

export function formatTimeWithPattern(
  value: string | null | undefined,
  pattern: TimeFormatPattern = DEFAULT_TIME_FORMAT,
): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return pattern === '12h'
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateTimeWithPattern(
  value: string | null | undefined,
  datePattern: DateFormatPattern = DEFAULT_DATE_FORMAT,
  timePattern: TimeFormatPattern = DEFAULT_TIME_FORMAT,
): string {
  if (!value) return '—';
  return `${formatDateWithPattern(value, datePattern)} · ${formatTimeWithPattern(value, timePattern)}`;
}

/**
 * The organization's chosen date/time display format (Workspace settings →
 * Localization), applied consistently everywhere a record's date is shown to
 * a user. Falls back to d/m/Y · 24h before the session loads or for an
 * organization that hasn't set a preference.
 */
export function useDateFormatter() {
  const { session } = useAuth();
  const localization = session?.workspace?.localization;
  const datePattern = isDateFormatPattern(localization?.date_format) ? localization.date_format : DEFAULT_DATE_FORMAT;
  const timePattern = isTimeFormatPattern(localization?.time_format) ? localization.time_format : DEFAULT_TIME_FORMAT;

  return {
    datePattern,
    timePattern,
    formatDate: (value: string | null | undefined) => formatDateWithPattern(value, datePattern),
    formatTime: (value: string | null | undefined) => formatTimeWithPattern(value, timePattern),
    formatDateTime: (value: string | null | undefined) => formatDateTimeWithPattern(value, datePattern, timePattern),
  };
}
