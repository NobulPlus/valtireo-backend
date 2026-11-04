import type { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import type { MoreStackParamList } from '../navigation/MoreStack';

/**
 * The canonical "everything reachable from More" list — shared by MoreMenuScreen
 * itself and Home's customizable Quick Access row, so a feature only has to be
 * added in one place to become eligible for both. Directory and Documents are
 * deliberately NOT gated by the 'employees'/'documents' platform modules — those
 * modules' required_permission is admin-level, which the plain Employee role
 * never holds, so checking can_access on them would hide these tiles for every
 * ordinary employee even though the self-service endpoints behind them work fine.
 */
export const MORE_MENU_ITEMS = [
  { key: 'Directory', icon: 'people-outline', label: 'Directory', moduleColorKey: 'directory', module: null },
  { key: 'Calendar', icon: 'calendar-outline', label: 'Calendar', moduleColorKey: 'calendar', module: null },
  { key: 'Connect', icon: 'chatbubbles-outline', label: 'Connect', moduleColorKey: 'connect', module: 'connect' },
  { key: 'Orbit', icon: 'grid-outline', label: 'Orbit', moduleColorKey: 'orbit', module: 'orbit' },
  { key: 'Assets', icon: 'laptop-outline', label: 'My assets', moduleColorKey: 'assets', module: 'assets' },
  { key: 'Documents', icon: 'document-text-outline', label: 'Documents', moduleColorKey: 'documents', module: 'employee_self_service' },
  { key: 'Payslips', icon: 'cash-outline', label: 'Payslips', moduleColorKey: 'payslips', module: 'payroll' },
  { key: 'Lifestyle', icon: 'heart-outline', label: 'Lifestyle', moduleColorKey: 'lifestyle', module: 'employee_self_service' },
] as const satisfies readonly { key: Exclude<keyof MoreStackParamList, 'MoreMenu'>; icon: keyof typeof Ionicons.glyphMap; label: string; moduleColorKey: string; module: string | null }[];

export type MoreMenuItemKey = (typeof MORE_MENU_ITEMS)[number]['key'];
export type MoreMenuItem = (typeof MORE_MENU_ITEMS)[number];

/** The one place that decides whether a given More/Quick-Access tile is actually reachable for the current session. */
export function useVisibleMoreMenuItems(): readonly MoreMenuItem[] {
  const { moduleByKey, session } = useAuth();
  return MORE_MENU_ITEMS.filter(
    (item) =>
      (!item.module || moduleByKey(item.module)?.can_access === true) &&
      (item.key !== 'Directory' || session?.workspace?.employee_experience.allow_employee_directory === true),
  );
}
