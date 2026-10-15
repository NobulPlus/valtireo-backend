export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

/** Based on the phone's own clock, not the org's configured timezone — this is about the employee's actual day, not head-office time. */
export function getGreeting(date: Date = new Date()): { label: string; period: GreetingPeriod } {
  const hour = date.getHours();
  if (hour < 12) return { label: 'Good morning', period: 'morning' };
  if (hour < 17) return { label: 'Good afternoon', period: 'afternoon' };
  return { label: 'Good evening', period: 'evening' };
}
