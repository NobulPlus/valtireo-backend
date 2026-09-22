import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BarChart3,
  Banknote,
  Bell,
  Boxes,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileStack,
  FileCheck2,
  Gauge,
  Headset,
  LifeBuoy,
  ListChecks,
  Network,
  Receipt,
  ScrollText,
  Settings,
  ShieldPlus,
  SlidersHorizontal,
  TriangleAlert,
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
  /** Visible only to platform (cross-organization) admins. */
  platformAdminOnly?: boolean;
  /** Module key required to see this item (hidden entirely if not entitled). */
  moduleKey?: string;
  /** Org-level "employee experience" toggle required to see this item — mirrors `WorkspaceSettings.employee_experience`. */
  employeeExperienceKey?: 'show_org_chart' | 'allow_employee_directory';
  /** Screens not yet built in this pass — shown for roadmap context, disabled. */
  comingSoon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /**
   * Which workspace mode this group shows in (see AuthContext's
   * `workspaceMode`). `'core'` = always visible in both modes. `'employee'`
   * = only in employee mode. Omitted = admin-only (the default for every
   * group except the two tagged below) — not repeated on each one since
   * it's the common case.
   */
  scope?: 'core' | 'employee';
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
    scope: 'core',
    items: [
      { label: 'Valtireo console', to: '/platform', icon: ShieldCheck, platformAdminOnly: true },
      { label: 'Error logs', to: '/platform/error-logs', icon: TriangleAlert, platformAdminOnly: true },
      { label: 'Dashboard', to: '/dashboard', icon: Gauge },
      { label: 'Calendar', to: '/calendar', icon: CalendarDays },
      { label: 'Notifications', to: '/notifications', icon: Bell },
      { label: 'Verification', to: '/organization-verification', icon: FileCheck2, permission: 'workspace_settings.update' },
    ],
  },
  {
    label: 'My workspace',
    scope: 'employee',
    items: [
      { label: 'My profile', to: '/me/profile', icon: UserRound },
      { label: 'My calendar', to: '/calendar', icon: CalendarDays },
      { label: 'My leave', to: '/me/leave', icon: CalendarCheck2, moduleKey: 'leave' },
      { label: 'My attendance', to: '/me/attendance', icon: Clock, moduleKey: 'attendance' },
      { label: 'My tickets', to: '/me/tickets', icon: LifeBuoy, moduleKey: 'service_desk' },
      { label: 'My assets', to: '/me/assets', icon: Boxes, moduleKey: 'assets' },
      { label: 'My payslips', to: '/me/payslips', icon: Receipt, moduleKey: 'payroll' },
      { label: 'Org chart', to: '/me/org-chart', icon: Network, employeeExperienceKey: 'show_org_chart' },
      { label: 'Directory', to: '/me/directory', icon: Users, employeeExperienceKey: 'allow_employee_directory' },
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
      {
        label: 'Service desk',
        to: '/service-desk',
        icon: Headset,
        permission: 'service_desk.view',
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
      {
        label: 'Payroll',
        to: '/payroll',
        icon: Banknote,
        permission: 'payroll.view',
        moduleKey: 'payroll',
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
      {
        label: 'Roles & permissions',
        to: '/settings/roles',
        icon: ShieldPlus,
        permission: 'roles.view',
      },
      {
        label: 'Custom fields',
        to: '/settings/custom-fields',
        icon: ListChecks,
        permission: 'employees.view',
      },
      {
        label: 'Assets',
        to: '/settings/assets',
        icon: Boxes,
        permission: 'assets.view',
        moduleKey: 'assets',
      },
    ],
  },
];
