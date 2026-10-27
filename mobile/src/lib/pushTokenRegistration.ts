import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './apiClient';

/**
 * Split out from pushNotifications.ts (not merely organizational): AuthContext
 * needs unregisterPushToken for its own logout, and pushNotifications.ts
 * imports useAuth from AuthContext — importing that file from here would be a
 * require cycle. Nothing in this file touches React or AuthContext.
 */

// Show a banner + sound even while the app is open and foregrounded — otherwise
// a message/call push would be silently swallowed whenever the recipient
// already has the app in front of them, which is most of the time.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePushPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // No `sound` here: Android's notification channel API treats anything
    // other than silence as a *custom* sound file it must find bundled in the
    // app, 'default' included — passing it throws "Custom sound 'default' not
    // found". Omitting the field is what actually gets the system default.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Valtireo',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  // Simulators/emulators have no push capability, and would otherwise throw.
  if (!Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export async function registerPushToken(): Promise<void> {
  const granted = await ensurePushPermission();
  if (!granted) return;
  const token = await getExpoPushToken();
  if (!token) return;
  await api.post('/push-tokens', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }).catch(() => {});
}

/** Called from AuthContext's logout, before the stored bearer token is cleared — see its own call site for why the token has to be passed in explicitly rather than read from storage. */
export async function unregisterPushToken(authToken: string): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await api.delete('/push-tokens', { data: { token }, headers: { Authorization: `Bearer ${authToken}` } });
  } catch {
    // Best-effort, matching this app's other logout cleanup (see AuthContext's own logout).
  }
}
