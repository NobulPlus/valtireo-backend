/**
 * Pure selection logic for Home's Birthdays/Anniversaries/Appreciation card — see
 * docs/design-system/10-home-experience-audit.md item 8 and
 * 12-home-expansion-plan.md Phase A, item 4.
 *
 * All privacy filtering (per-person opt-in, organization feature flags) already
 * happens server-side before this data ever reaches the client — `EmployeeLifestyleService::milestones()`
 * only includes employees who opted in, and the backend already sorts the result
 * ascending by date within the requested window (server/app/Services/
 * EmployeeLifestyleService.php:45-76), so "the nearest upcoming milestone" is simply
 * the first element, not something this file needs to search for. This file's only job
 * is presentation: picking what to show, computing a human "in N days" label, and
 * deciding whether the card has anything worth rendering at all.
 */

export interface MilestoneLike {
  employee: { name: string };
  type: 'birthday' | 'anniversary';
  date: string;
  years_of_service?: number;
}

export interface LifestyleHomeSummaryInput {
  milestonesEnabled: boolean;
  appreciationEnabled: boolean;
  /** `undefined` while the query hasn't resolved yet — treated the same as "nothing to show" for this pass; the card's own loading state is handled by the screen, not this function. */
  milestones: MilestoneLike[] | undefined;
  /** The length of the first loaded page of received appreciations — not a true total (no count endpoint exists, per the audit), so `capped` below must be set whenever this could be an undercount. */
  receivedAppreciationCount: number | undefined;
  /** True when `receivedAppreciationCount` is exactly a full page — there may be more than shown. */
  receivedAppreciationCapped: boolean;
  /** Injectable for deterministic tests; defaults to the real current time. */
  today?: Date;
}

export interface LifestyleHomeSummary {
  /** False means render nothing — per the audit, an empty card must not appear. */
  visible: boolean;
  milestoneLabel: string | null;
  appreciationLabel: string | null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(today: Date, isoDate: string): number | null {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((startOfDay(parsed).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

function formatMilestone(milestone: MilestoneLike, today: Date): string | null {
  const days = daysUntil(today, milestone.date);
  if (days === null || days < 0) return null; // Past or malformed — the backend window shouldn't produce this, but never show a negative "in -2 days".
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  const what = milestone.type === 'birthday'
    ? 'birthday'
    : `${milestone.years_of_service ?? '?'}-year work anniversary`;
  return `${milestone.employee.name}'s ${what} is ${when}`;
}

export function selectLifestyleHomeSummary(input: LifestyleHomeSummaryInput): LifestyleHomeSummary {
  const today = input.today ?? new Date();

  const nearestMilestone = input.milestonesEnabled ? input.milestones?.[0] : undefined;
  const milestoneLabel = nearestMilestone ? formatMilestone(nearestMilestone, today) : null;

  const count = input.appreciationEnabled ? input.receivedAppreciationCount ?? 0 : 0;
  // "Received", not "new" — useAppreciations('received', ...) has no read/unread concept
  // at all (unlike notifications), so calling these "new" would claim something this
  // data doesn't actually establish. The `+` convention for a possibly-incomplete count
  // (no count endpoint exists, per the audit) is unchanged.
  const appreciationLabel = input.appreciationEnabled && count > 0
    ? `${count}${input.receivedAppreciationCapped ? '+' : ''} appreciation${count === 1 && !input.receivedAppreciationCapped ? '' : 's'} received`
    : null;

  return {
    visible: milestoneLabel !== null || appreciationLabel !== null,
    milestoneLabel,
    appreciationLabel,
  };
}
