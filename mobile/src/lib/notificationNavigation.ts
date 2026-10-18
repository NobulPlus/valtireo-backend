/**
 * Pure, testable resolver translating a notification's backend-supplied references
 * into a mobile navigation destination — see
 * docs/design-system/10-home-experience-audit.md item 6 and
 * 12-home-expansion-plan.md Phase A, item 2.
 *
 * Deliberately an explicit allowlist, not a generic URL parser: `action_url` is never
 * navigated to directly (it's a web route, e.g. `/service-desk?ticket=5`, not a mobile
 * one) — it's only ever compared against a small, fixed set of exact patterns this file
 * knows about, each paired with the `entity_type` the backend sends alongside it. Every
 * pattern below is copied from the real values `server/app/Services/
 * NotificationDispatchService.php` actually dispatches (confirmed by direct grep, not
 * inferred) — nothing here is a guess at a URL shape. Anything that doesn't match one
 * of these exact pairs — including a currently-unreachable combination like
 * `approval_request` + `/approvals/{id}` (no manager-approval screen exists on mobile;
 * that's Phase C, explicitly out of scope here) — resolves to `unsupported`.
 */

export type NotificationDestination =
  | { kind: 'profile' }
  | { kind: 'leaveTab' }
  | { kind: 'ticketsTab' }
  | { kind: 'ticketDetail'; ticketId: number }
  | { kind: 'moreScreen'; screen: 'Documents' | 'Calendar' | 'Lifestyle' }
  | { kind: 'unsupported' };

export interface NotificationAccess {
  leave: boolean;
  serviceDesk: boolean;
  /** Documents/Lifestyle are both gated on the `employee_self_service` module, matching MoreMenuScreen's own gating convention. */
  employeeSelfService: boolean;
}

export interface NotificationLike {
  entity_type?: string | null;
  entity_id?: number | string | null;
  action_url?: string | null;
}

const TICKET_DETAIL_PATTERN = /^\/service-desk\?ticket=(\d+)$/;

function asPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

export function resolveNotificationDestination(notification: NotificationLike, access: NotificationAccess): NotificationDestination {
  const url = notification.action_url ?? '';
  const type = notification.entity_type ?? '';

  if (type === 'ticket') {
    const match = TICKET_DETAIL_PATTERN.exec(url);
    if (match) {
      if (!access.serviceDesk) return { kind: 'unsupported' };
      const urlId = asPositiveInt(match[1]);
      const entityId = asPositiveInt(notification.entity_id);
      // Only trust the id if the notification's own entity_id agrees with the one
      // embedded in the URL — a mismatch is a malformed/untrustworthy payload, so fall
      // back to the list rather than guess which one is right.
      if (urlId !== null && (entityId === null || entityId === urlId)) {
        return { kind: 'ticketDetail', ticketId: urlId };
      }
      return { kind: 'ticketsTab' };
    }
    if (url === '/me/tickets') {
      return access.serviceDesk ? { kind: 'ticketsTab' } : { kind: 'unsupported' };
    }
    return { kind: 'unsupported' };
  }

  if (type === 'leave_request' && url === '/me/leave') {
    return access.leave ? { kind: 'leaveTab' } : { kind: 'unsupported' };
  }

  if (type === 'company_event' && url === '/calendar') {
    // Calendar has no module gate of its own (MoreMenuScreen's `module: null`).
    return { kind: 'moreScreen', screen: 'Calendar' };
  }

  if (type === 'employee_document' && url === '/me/profile?tab=documents') {
    return access.employeeSelfService ? { kind: 'moreScreen', screen: 'Documents' } : { kind: 'unsupported' };
  }

  if (type === 'employee_appreciation' && url === '/me/lifestyle') {
    return access.employeeSelfService ? { kind: 'moreScreen', screen: 'Lifestyle' } : { kind: 'unsupported' };
  }

  if (type === 'approval_request') {
    // These two are the self-facing outcomes (`decidedActionFor()`,
    // server/app/Services/NotificationDispatchService.php:209-224) — the employee's
    // own leave/document request was decided. Anything else under this entity_type
    // (e.g. `/approvals/{id}`, the reviewer-facing case) has no mobile screen yet.
    if (url === '/me/leave') return access.leave ? { kind: 'leaveTab' } : { kind: 'unsupported' };
    if (url === '/me/profile?tab=documents') return access.employeeSelfService ? { kind: 'moreScreen', screen: 'Documents' } : { kind: 'unsupported' };
    return { kind: 'unsupported' };
  }

  // organization / employee_invitation / employee — admin/HR-facing concepts with no
  // employee-mobile screen at all, and any other unrecognized entity_type.
  return { kind: 'unsupported' };
}
