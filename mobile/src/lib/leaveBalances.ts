/**
 * Home's "Leave balances" card only shows leave types that actually apply to
 * this employee. An organization can configure many leave types (maternity,
 * paternity, study, compassionate, ...) that only apply to some employee
 * segments — showing a "0 days" chip for every type that doesn't apply to
 * THIS person is noise, not information (the real complaint a device test
 * raised: the card felt "muddled").
 *
 * A zero AVAILABLE balance for a type that DOES apply (days_allocated > 0 —
 * e.g. sick leave fully used this year) is still shown: "0 days left" for a
 * real entitlement is a genuine, useful signal, not clutter, so this only
 * filters on allocation, never on the remaining/available count.
 */
export interface LeaveBalanceLike {
  days_allocated: number;
}

export function selectImportantLeaveBalances<T extends LeaveBalanceLike>(balances: T[]): T[] {
  return balances.filter((balance) => balance.days_allocated > 0);
}
