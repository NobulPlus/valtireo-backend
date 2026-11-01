import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ConnectAvatar } from './ConnectMedia';
import type { Page, VoiceCall } from './chatTypes';

export function ConnectCallDock() {
  const { session, moduleByKey } = useAuth();
  const user = session?.user;
  const query = useQuery({ queryKey: ['connect', 'calls', user?.id], queryFn: () => api.get<{ calls: Page<VoiceCall>; media_ready: boolean }>('/connect/calls'), enabled: moduleByKey('connect')?.can_access === true, refetchInterval: 4000, retry: false });
  const call = query.data?.calls.data.find((c) => ['ringing', 'active'].includes(c.status));
  return call ? <CallPanel key={`${user?.id}:${call.id}`} call={call} /> : null;
}

function CallPanel({ call }: { call: VoiceCall }) {
  const cache = useQueryClient();
  const room = useRef<Room | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting audio…');
  const [muted, setMuted] = useState(false);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState('');
  const person = call.incoming ? call.caller : call.callee;
  const action = useMutation({ mutationFn: (action: string) => api.post(`/connect/calls/${call.id}/actions`, { action }), onSuccess: () => cache.invalidateQueries({ queryKey: ['connect', 'calls'] }) });
  useEffect(() => {
    if (call.status !== 'active') return;
    let alive = true;
    const session = new Room(); room.current = session;
    session.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio && alive) container.current?.appendChild(track.attach()); });
    session.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
    session.on(RoomEvent.Reconnecting, () => setStatus('Reconnecting…'));
    session.on(RoomEvent.Reconnected, () => setStatus('Connected'));
    session.on(RoomEvent.Disconnected, () => { if (alive) setStatus('Audio disconnected. End the call and try again.'); });
    void api.post<{ credentials: { token: string; server_url: string } }>(`/connect/calls/${call.id}/actions`, { action: 'join' }).then(async ({ credentials }) => {
      if (!alive) return;
      await session.connect(credentials.server_url, credentials.token);
      if (!alive) { await session.disconnect(); return; }
      await session.startAudio();
      await session.localParticipant.setMicrophoneEnabled(true);
      if (alive) { setStatus('Connected'); setOutputs((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput')); }
    }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not connect microphone.'); });
    return () => { alive = false; session.removeAllListeners(); void session.disconnect(); room.current = null; };
  }, [call.id, call.status]);
  return <aside aria-label="Connect voice call" className="fixed bottom-5 right-5 z-50 w-80 space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-xl">
    <div className="flex items-center gap-3"><ConnectAvatar person={person} /><div><strong>{person.name}</strong><p className="text-sm text-muted">{call.status === 'ringing' ? (call.incoming ? 'Incoming voice call' : 'Calling…') : status}</p></div></div>
    {error || action.error ? <p role="alert" className="text-sm text-red-600">{error || action.error?.message}</p> : null}
    <div ref={container} />
    <div className="flex flex-wrap gap-2">
      {call.status === 'ringing' && call.incoming ? <>
        <Button variant="primary" size="icon" aria-label="Accept call" title="Accept call" disabled={action.isPending} onClick={() => action.mutate('accept')}><Phone size={16} /></Button>
        <Button variant="danger" size="icon" aria-label="Decline call" title="Decline call" disabled={action.isPending} onClick={() => action.mutate('decline')}><PhoneOff size={16} /></Button>
      </> : <Button variant="danger" size="icon" aria-label="End call" title="End call" disabled={action.isPending} onClick={() => action.mutate('end')}><PhoneOff size={16} /></Button>}
      {call.status === 'active' ? <Button variant="ghost" size="icon" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={() => { void room.current?.localParticipant.setMicrophoneEnabled(muted).then(() => setMuted(!muted)).catch((e) => setError(String(e))); }}>{muted ? <MicOff size={16} /> : <Mic size={16} />}</Button> : null}
    </div>
    {call.status === 'active' && outputs.length > 0 ? <label className="block text-xs">Audio output<select className="mt-1 w-full rounded border bg-surface p-2" onChange={(e) => { void room.current?.switchActiveDevice('audiooutput', e.target.value).catch(() => setError('Choose the speaker using your browser or system audio settings.')); }}>{outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'System speaker'}</option>)}</select></label> : null}
  </aside>;
}
