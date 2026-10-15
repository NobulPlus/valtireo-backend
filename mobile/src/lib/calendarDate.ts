/** Calendar arithmetic must not round-trip through the device's local timezone. */
export function correctionTimestamp(date: string, time: string, nextDay = false): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return undefined;
  if (nextDay) day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}T${time}:00`;
}

export function todayInZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
