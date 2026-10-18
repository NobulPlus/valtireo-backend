import type { MoreStackParamList } from '../navigation/MoreStack';

/**
 * Shared by every screen nested under the Home tab (Home itself, Notifications, ...)
 * that needs to jump into a sibling tab or a MoreTab-nested screen — extracted from
 * HomeScreen.tsx so it has exactly one implementation instead of being duplicated per
 * screen.
 *
 * Deliberately a small, hand-written structural type rather than React Navigation's
 * full `CompositeNavigationProp<...>` generic: that generic's `setParams` becomes
 * invariant once the current-route-name parameter is widened to a union (or defaulted),
 * which breaks assignability from every screen's own concretely-typed `navigation` prop
 * for a method (`setParams`) this file never calls anyway. Only the two methods actually
 * used are declared here, so any real screen's navigation prop — which always has a
 * superset of these — is assignable without that generic-variance trap.
 */
export interface HomeAreaNavigation {
  navigate(screen: 'Profile'): void;
  navigate(screen: 'LeaveTab'): void;
  navigate(screen: 'TicketsTab'): void;
  navigate(screen: 'TicketsTab', params: { screen: 'TicketDetail'; params: { ticketId: number } }): void;
  navigate(screen: 'MoreTab', params: { screen: keyof MoreStackParamList }): void;
  getParent(): { getState(): unknown } | undefined;
}

type MoreDestination = Exclude<keyof MoreStackParamList, 'MoreMenu'>;

/**
 * Jumping into a MoreTab screen must not just push onto whatever MoreTab's stack
 * already has — bottom-tabs keeps every tab's nested stack alive across tab switches,
 * so repeated shortcuts into different features (Documents, then Assets, ...) would
 * otherwise pile up into one unrelated back-stack, and pressing back from Assets would
 * land on Documents instead of the More menu. Reset to the menu first, then push the
 * destination — but only when actually switching features, so reopening the same
 * feature you're already in doesn't discard its in-progress state.
 */
function currentMoreTabScreen(navigation: HomeAreaNavigation): string | undefined {
  const parentState = navigation.getParent()?.getState() as
    | { routes?: { name: string; state?: { routes?: { name: string }[]; index?: number } }[] }
    | undefined;
  const moreRoute = parentState?.routes?.find((route) => route.name === 'MoreTab');
  const nestedRoutes = moreRoute?.state?.routes;
  const nestedIndex = moreRoute?.state?.index;
  if (!nestedRoutes || nestedIndex === undefined) return undefined;
  return nestedRoutes[nestedIndex]?.name;
}

export function goIntoMoreTab(navigation: HomeAreaNavigation, screen: MoreDestination) {
  if (currentMoreTabScreen(navigation) !== screen) {
    navigation.navigate('MoreTab', { screen: 'MoreMenu' });
  }
  navigation.navigate('MoreTab', { screen });
}
