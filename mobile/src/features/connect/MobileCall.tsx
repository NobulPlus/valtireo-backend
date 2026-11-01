import { lazy, Suspense, useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { Avatar } from '../../components/Avatar';
import type { VoiceCall } from './types';

const NativeVoiceRoom = lazy(() => import('./NativeVoiceRoom'));
export const nativeCallsSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export function MobileCall({ call }: { call: VoiceCall }) {
  const cache = useQueryClient(); const [credentials, setCredentials] = useState<{ token: string; server_url: string } | null>(null); const [error, setError] = useState('');
  const action = useMutation({ mutationFn: (action: string) => api.post(`/connect/calls/${call.id}/actions`, { action }), onSuccess: () => cache.invalidateQueries({ queryKey: ['connect'] }) });
  useEffect(() => { let alive = true; if (call.status === 'active' && nativeCallsSupported) void api.post<{ credentials: { token: string; server_url: string } }>(`/connect/calls/${call.id}/actions`, { action: 'join' }).then((r) => { if (alive) setCredentials(r.credentials); }).catch((e) => { if (alive) setError(String(e)); }); return () => { alive = false; }; }, [call.id, call.status]);
  const person = call.incoming ? call.caller : call.callee;
  return <View style={{ padding: 16, gap: 8, backgroundColor: '#E9F5F0', borderRadius: 12 }}><Avatar name={person.name} uri={person.photo_url} /><Text style={{ color: '#123F3A', fontWeight: '700' }}>{person.name} · {call.status === 'ringing' ? call.incoming ? 'Incoming voice call' : 'Calling…' : call.status}</Text>
    {!nativeCallsSupported ? <Text style={{ color: '#123F3A' }}>Live calls need a Valtireo development build. Expo Go supports messaging and voice notes.</Text> : null}
    {call.status === 'ringing' && call.incoming ? <><Button title="Accept" disabled={!nativeCallsSupported || action.isPending} onPress={() => action.mutate('accept')} /><Button title="Decline" disabled={action.isPending} onPress={() => action.mutate('decline')} /></> : <Button title="End call" disabled={action.isPending} onPress={() => action.mutate('end')} />}
    {call.status === 'active' && credentials ? <Suspense fallback={<Text>Loading audio…</Text>}><NativeVoiceRoom credentials={credentials} /></Suspense> : null}{error || action.error ? <Text accessibilityRole="alert">{error || action.error?.message}</Text> : null}
  </View>;
}
