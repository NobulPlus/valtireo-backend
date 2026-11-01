import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useConnectCalls } from './api';
import { MobileCall } from './MobileCall';

/**
 * Mounted once near the app root (RootNavigator, only while authenticated) so a
 * ringing or active call surfaces no matter which screen is open — the mobile
 * counterpart of the web app's always-mounted `ConnectCallDock`. Polling only
 * (see MobileCall's own `nativeCallsSupported` gate) — there is no push-triggered
 * incoming-call handling for a backgrounded or closed app; that needs a native
 * build's VoIP push entitlement and is a separate workstream.
 */
export function ConnectCallWatcher() {
  const { moduleByKey } = useAuth();
  const enabled = moduleByKey('connect')?.can_access === true;
  const query = useConnectCalls(enabled);
  const call = query.data?.calls.data.find((c) => c.status === 'ringing' || c.status === 'active');
  if (!call) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
      <MobileCall key={call.id} call={call} />
    </View>
  );
}
