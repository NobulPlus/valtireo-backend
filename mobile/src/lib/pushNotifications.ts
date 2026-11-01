import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { navigateFromRoot } from '../navigation/navigationRef';
import { isEligibleForManagerHome } from './managerEligibility';
import { registerPushToken } from './pushTokenRegistration';
import { resolveNotificationDestination, type NotificationAccess, type NotificationLike } from './notificationNavigation';

/**
 * Mounted once near the app root (RootNavigator), only while authenticated —
 * registers this device for push so messages/calls still notify while the app
 * is backgrounded or fully closed, and routes a tapped push through the same
 * destination resolver the in-app Notifications list already uses (see
 * lib/notificationNavigation.ts).
 */
export function usePushNotifications(enabled: boolean): void {
  const { moduleByKey, session } = useAuth();
  const currentAccess: NotificationAccess = {
    leave: moduleByKey('leave')?.can_access === true,
    serviceDesk: moduleByKey('service_desk')?.can_access === true,
    employeeSelfService: moduleByKey('employee_self_service')?.can_access === true,
    connect: moduleByKey('connect')?.can_access === true,
    approvals: isEligibleForManagerHome(session),
  };
  // A ref, not state: the tap listener below is set up once and must read
  // whatever access the person currently has, not whatever it was when the
  // listener was attached. Written in an effect, never during render.
  const access = useRef<NotificationAccess>(currentAccess);
  useEffect(() => {
    access.current = currentAccess;
  });

  useEffect(() => {
    if (!enabled) return;
    void registerPushToken();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationLike;
      navigateFromRoot(resolveNotificationDestination(data, access.current));
    });
    return () => subscription.remove();
  }, [enabled]);
}
