import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { apiClient } from '../../lib/apiClient';
import { getStoredToken } from '../../lib/secureToken';
import { useTheme } from '../../theme';
import { downloadAndShare } from '../leave/api';
import type { RNFile } from '../leave/api';
import type { Message } from './types';

export function AudioPlayback({ uri, remote = false }: { uri: string; remote?: boolean }) {
  const player = useAudioPlayer(remote ? { uri: `${apiClient.defaults.baseURL}${uri}`, headers: { Authorization: `Bearer ${getStoredToken()}` } } : uri);
  const status = useAudioPlayerStatus(player);
  return <View><Button title={status.playing ? 'Pause audio' : 'Play audio'} onPress={() => { if (status.playing) player.pause(); else { if (status.didJustFinish) void player.seekTo(0); player.play(); } }} /><Text>{Math.floor(status.currentTime)}s / {Math.floor(status.duration)}s</Text></View>;
}
export function MobileAttachment({ attachment }: { attachment: NonNullable<Message['attachment']> }) {
  return <View style={{ gap: 8 }}>
    {attachment.voice_note || attachment.mime.startsWith('audio/') ? <AudioPlayback uri={attachment.url} remote /> : attachment.mime.startsWith('image/') ? <Image source={{ uri: `${apiClient.defaults.baseURL}${attachment.url}`, headers: { Authorization: `Bearer ${getStoredToken()}` } }} style={{ height: 180, width: '100%' }} resizeMode="contain" accessibilityLabel={attachment.name} /> : null}
    <Button title={`Open / save ${attachment.name}`} onPress={() => void downloadAndShare(attachment.url, attachment.name).catch((e) => Alert.alert('Could not open file', String(e)))} />
  </View>;
}
export function VoiceRecorder({ onReady, disabled }: { onReady: (file: RNFile) => void; disabled: boolean }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);
  async function stop() {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (recorder.uri) {
      const file = new File(recorder.uri);
      if (file.size > 10 * 1024 * 1024) { Alert.alert('Recording too large', 'Please record a shorter voice note.'); return; }
      onReady({ uri: recorder.uri, name: 'voice-note.m4a', type: 'audio/mp4' });
    }
  }
  useEffect(() => { if (!status.isRecording) return; const timeout = setTimeout(() => { void stop().catch((e) => Alert.alert('Recording failed', String(e))); }, 120000); return () => clearTimeout(timeout); }, [status.isRecording]);
  async function toggle() {
    setBusy(true);
    try {
      if (status.isRecording) await stop();
      else {
        if (!(await requestRecordingPermissionsAsync()).granted) { Alert.alert('Microphone access needed', 'Allow microphone access to record a voice note.'); return; }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(); recorder.record();
      }
    } catch (e) { Alert.alert('Could not record', String(e)); }
    finally { setBusy(false); }
  }
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {status.isRecording ? <Text style={{ fontSize: 12, color: colors.danger }}>{Math.floor(status.durationMillis / 1000)}s</Text> : null}
      <Pressable
        disabled={busy || disabled}
        onPress={() => void toggle()}
        style={{ padding: 8 }}
        accessibilityLabel={status.isRecording ? 'Stop recording' : 'Record a voice note'}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.pine} />
        ) : (
          <Ionicons name={status.isRecording ? 'stop-circle' : 'mic-outline'} size={20} color={status.isRecording ? colors.danger : colors.pine} />
        )}
      </Pressable>
    </View>
  );
}
