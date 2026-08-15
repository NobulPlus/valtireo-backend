import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarClock,
  ClipboardCheck,
  Clock,
  FileStack,
  Gauge,
  ScrollText,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Permission required to see this item. Omit for always-visible items. */
  permission?: string;
  /** User role required to see this item. */
  roles?: string[];
  /** Module key required to see this item (hidden entirely if not entitled). */
  moduleKey?: string;
  /** Screens not yet built in this pass — shown for roadmap context, disabled. */
  comingSoon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar structure follows the brand/product design foundation doc's
 * groups: Core, People, Workflows, Documents, Time, Reports, Governance,
 * Settings. Items are hidden when the user's module/permission set doesn't
 * entitle them (per the handoff guide's "Hide navigation when the module is
 * unavailable" rule); a few not-yet-built screens are kept visible-but-
 * disabled so the shell communicates the full product shape.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { label: 'Valtireo console', to: '/platform', icon: ShieldCheck, roles: ['Super Admin'] },
      { label: 'Dashboard', to: '/dashboard', icon: Gauge },
    ],
  },
  {
    label: 'My workspace',
    items: [
      { label: 'My profile', to: '/me/profile', icon: UserRound },
      { label: 'My leave', to: '/me/leave', icon: CalendarCheck2 },
      { label: 'My attendance', to: '/me/attendance', icon: Clock },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', to: '/employees', icon: Users, permission: 'employees.view' },
    ],
  },
  {
    label: 'Documents',
    items: [
      {
        label: 'Documents & compliance',
        to: '/documents',
        icon: FileStack,
        moduleKey: 'documents',
      },
    ],
  },
  {
    label: 'Workflows',
    items: [
      {
        label: 'Approvals',
        to: '/approvals',
        icon: ClipboardCheck,
        permission: 'approvals.view',
      },
    ],
  },
  {
    label: 'Time',
    items: [
      { label: 'Leave', to: '/leave', icon: CalendarClock, moduleKey: 'leave' },
      {
        label: 'Attendance',
        to: '/attendance',
        icon: BadgeCheck,
        moduleKey: 'attendance',
      },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        label: 'Reports',
        to: '/reports',
        icon: BarChart3,
        permission: 'reports.view',
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        label: 'Audit & activity',
        to: '/audit',
        icon: ScrollText,
        permission: 'audit_logs.view',
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        label: 'Control center',
        to: '/settings/control-center',
        icon: SlidersHorizontal,
        permission: 'workspace_settings.update',
      },
      {
        label: 'Workspace',
        to: '/workspace',
        icon: Settings,
        permission: 'workspace_settings.view',
      },
      {
        label: 'Organization structure',
        to: '/settings/structure',
        icon: Building2,
        permission: 'workspace_settings.view',
      },
    ],
  },
];
