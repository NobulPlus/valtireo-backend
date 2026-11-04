import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioSession, LiveKitRoom, registerGlobals, useConnectionState, useRoomContext } from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../../theme';

registerGlobals();

/**
 * Android requires the RECORD_AUDIO runtime permission to be granted before
 * microphone capture works — declaring it in the manifest alone isn't enough
 * (API 23+). @livekit/react-native-webrtc's getUserMedia doesn't request this
 * itself, so without this the call connects fine (signaling doesn't need the
 * mic) but publishes silence, which is why audio was missing on both ends: the
 * other party had nothing to hear. iOS prompts automatically on first mic
 * access (via NSMicrophoneUsageDescription), so there's nothing to request there.
 */
async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone access',
    message: 'Valtireo needs your microphone to make and receive Connect voice calls.',
    buttonPositive: 'Allow',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export default function NativeVoiceRoom({ credentials, onDisconnected }: { credentials: { token: string; server_url: string }; onDisconnected: () => void }) {
  const { colors } = useTheme();
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void ensureMicrophonePermission()
      .then((granted) => {
        if (!mounted) return;
        if (!granted) { setError('Microphone permission is required for voice calls.'); return; }
        return AudioSession.startAudioSession().then(() => { if (mounted) setReady(true); });
      })
      .catch((e) => { if (mounted) setError(String(e)); });
    return () => { mounted = false; void AudioSession.stopAudioSession(); };
  }, []);

  return (
    <View>
      {error ? <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">{error}</Text> : null}
      {ready ? (
        <LiveKitRoom
          serverUrl={credentials.server_url}
          token={credentials.token}
          connect
          audio
          video={false}
          onError={(e) => setError(e.message)}
          onDisconnected={onDisconnected}
        >
          <Controls />
        </LiveKitRoom>
      ) : !error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
          <ActivityIndicator size="small" color={colors.pine} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>Preparing audio…</Text>
        </View>
      ) : null}
    </View>
  );
}

// The audit's own words: this used to render "Voice call connected"
// unconditionally — true the instant the LiveKit room object exists, not
// once a media connection is actually up, so a still-connecting or silently
// reconnecting call read as fully connected the whole time. The Disconnected
// copy is deliberately actionable (matches the web call dock's own wording)
// rather than a bare status word — when LiveKit's own reconnect attempts are
// exhausted, nothing else tells the caller the call is actually stuck.
const CONNECTION_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: 'Connecting…',
  [ConnectionState.Connected]: 'Voice call connected',
  [ConnectionState.Reconnecting]: 'Reconnecting…',
  [ConnectionState.SignalReconnecting]: 'Reconnecting…',
  [ConnectionState.Disconnected]: 'Audio disconnected. End the call and try again.',
};

function Controls() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [error, setError] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.status} accessibilityLiveRegion="polite">{CONNECTION_LABEL[connectionState] ?? 'Connecting…'}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => void room.localParticipant.setMicrophoneEnabled(muted).then(() => setMuted(!muted)).catch((e) => setError(String(e)))}
          style={[styles.control, muted && styles.controlActive]}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
          accessibilityRole="button"
        >
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={20} color={muted ? colors.white : colors.pine} />
        </Pressable>
        <Pressable
          onPress={() =>
            void AudioSession.selectAudioOutput(Platform.OS === 'ios' ? (speaker ? 'default' : 'force_speaker') : speaker ? 'earpiece' : 'speaker')
              .then(() => setSpeaker(!speaker))
              .catch((e) => setError(String(e)))
          }
          style={[styles.control, speaker && styles.controlActive]}
          accessibilityLabel={speaker ? 'Use earpiece' : 'Use speaker'}
          accessibilityRole="button"
        >
          <Ionicons name={speaker ? 'volume-high' : 'volume-medium-outline'} size={20} color={speaker ? colors.white : colors.pine} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors, typography: Typography) {
  return StyleSheet.create({
    container: { marginTop: spacing.md, gap: spacing.sm },
    status: { ...typography.caption, color: colors.muted },
    row: { flexDirection: 'row', gap: spacing.sm },
    control: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
    controlActive: { backgroundColor: colors.pine },
    error: { color: colors.danger, fontSize: 13 },
  });
}
