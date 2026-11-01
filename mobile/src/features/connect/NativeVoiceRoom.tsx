import { useEffect, useState } from 'react';
import { Button, PermissionsAndroid, Platform, Text, View } from 'react-native';
import { AudioSession, LiveKitRoom, registerGlobals, useConnectionState, useRoomContext } from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';

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

export default function NativeVoiceRoom({ credentials }: { credentials: { token: string; server_url: string } }) {
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
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {ready ? (
        <LiveKitRoom serverUrl={credentials.server_url} token={credentials.token} connect audio video={false} onError={(e) => setError(e.message)}>
          <Controls />
        </LiveKitRoom>
      ) : !error ? (
        <Text>Preparing audio…</Text>
      ) : null}
    </View>
  );
}

// The audit's own words: this used to render "Voice call connected"
// unconditionally — true the instant the LiveKit room object exists, not
// once a media connection is actually up, so a still-connecting or silently
// reconnecting call read as fully connected the whole time.
const CONNECTION_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: 'Connecting…',
  [ConnectionState.Connected]: 'Voice call connected',
  [ConnectionState.Reconnecting]: 'Reconnecting…',
  [ConnectionState.SignalReconnecting]: 'Reconnecting…',
  [ConnectionState.Disconnected]: 'Disconnected',
};

function Controls() {
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [error, setError] = useState('');

  return (
    <View>
      <Text accessibilityLiveRegion="polite">{CONNECTION_LABEL[connectionState] ?? 'Connecting…'}</Text>
      <Button
        title={muted ? 'Unmute' : 'Mute'}
        onPress={() => void room.localParticipant.setMicrophoneEnabled(muted).then(() => setMuted(!muted)).catch((e) => setError(String(e)))}
      />
      <Button
        title={speaker ? 'Use earpiece' : 'Use speaker'}
        onPress={() =>
          void AudioSession.selectAudioOutput(Platform.OS === 'ios' ? (speaker ? 'default' : 'force_speaker') : speaker ? 'earpiece' : 'speaker')
            .then(() => setSpeaker(!speaker))
            .catch((e) => setError(String(e)))
        }
      />
      {error ? <Text>{error}</Text> : null}
    </View>
  );
}
