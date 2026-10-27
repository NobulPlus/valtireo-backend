import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './RootNavigator';
import type { NotificationDestination } from '../lib/notificationNavigation';

/**
 * A tapped push notification fires outside any screen's component tree, so
 * there's no `navigation` prop to call — this ref is the standard React
 * Navigation escape hatch for navigating from there. Only used for that; every
 * in-app deep link (Home's shortcuts, the in-app Notifications list) still goes
 * through the normal screen-level `navigation` prop and lib/navigation.ts.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * The root-ref counterpart of NotificationsScreen's own `navigateForNotification`
 * — same destinations, resolved from outside the tree, hence one extra level of
 * nesting through `Main` that an in-screen `navigation` prop already sits inside.
 */
export function navigateFromRoot(destination: NotificationDestination): void {
  if (!navigationRef.isReady()) return;

  switch (destination.kind) {
    case 'profile':
      navigationRef.navigate('Main', { screen: 'HomeTab', params: { screen: 'Profile' } });
      return;
    case 'leaveTab':
      navigationRef.navigate('Main', { screen: 'LeaveTab' });
      return;
    case 'ticketsTab':
      navigationRef.navigate('Main', { screen: 'TicketsTab' });
      return;
    case 'ticketDetail':
      navigationRef.navigate('Main', { screen: 'TicketsTab', params: { screen: 'TicketDetail', params: { ticketId: destination.ticketId } } });
      return;
    case 'moreScreen':
      navigationRef.navigate('Main', { screen: 'MoreTab', params: { screen: destination.screen } });
      return;
    case 'connectConversation':
      navigationRef.navigate('Main', { screen: 'MoreTab', params: { screen: 'Connect', params: { screen: 'ConnectConversation', params: { conversationId: destination.conversationId } } } });
      return;
    case 'unsupported':
      return;
  }
}
