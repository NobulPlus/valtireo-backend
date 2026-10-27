import { useEffect, useState } from 'react';
import { Button, PermissionsAndroid, Platform, Text, View } from 'react-native';
import { AudioSession, LiveKitRoom, registerGlobals, useRoomContext } from '@livekit/react-native';

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

function Controls() {
  const room = useRoomContext();
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [error, setError] = useState('');

  return (
    <View>
      <Text>Voice call connected</Text>
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
