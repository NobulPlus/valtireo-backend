import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useInfiniteList } from '../../lib/useInfiniteList';
import type { LaravelPage } from '../../types/api';
import type { RNFile } from '../leave/api';
import type { Conversation, Message, Person, VoiceCall } from './types';

/** Active colleagues search — the data source for both "new conversation" and "add a member" pickers. */
export function useConnectPeople(search: string, departmentId?: number | null) {
  return useInfiniteList<Person>(
    ['connect', 'colleagues', search, departmentId],
    (page) => api.get<LaravelPage<Person>>('/connect/colleagues', { params: { search: search || undefined, department_id: departmentId || undefined, page } }),
  );
}

export function useConnectConversations() {
  return useInfiniteList<Conversation>(
    ['connect', 'conversations'],
    (page) => api.get<LaravelPage<Conversation>>('/connect/conversations', { params: { page } }),
  );
}

export function useConnectChannels() {
  return useInfiniteList<Conversation>(
    ['connect', 'channels'],
    (page) => api.get<LaravelPage<Conversation>>('/connect/channels', { params: { page } }),
  );
}

export function useConnectConversation(id: string) {
  return useQuery({
    queryKey: ['connect', 'conversation', id],
    queryFn: () => api.get<{ data: Conversation }>(`/connect/conversations/${id}`),
    select: (response) => response.data,
    refetchInterval: 5000,
  });
}

interface CreateConversationPayload {
  kind: 'direct' | 'group' | 'channel';
  name?: string;
  visibility?: 'private' | 'organization';
  member_ids: number[];
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConversationPayload) => api.post<{ data: Conversation }>('/connect/conversations', payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect'] }),
  });
}

type MembershipAction = 'join' | 'add' | 'remove' | 'leave' | 'transfer' | 'archive' | 'rename' | 'mute' | 'read' | 'unread';

export function useConversationMembership(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { action: MembershipAction; user_id?: number; name?: string; enabled?: boolean; last_read_id?: number }) =>
      api.patch(`/connect/conversations/${id}/membership`, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect'] }),
  });
}

export function useConnectMessages(conversationId: string, options: { search?: string; pinned?: boolean; before?: number } = {}, enabled: boolean) {
  return useQuery({
    queryKey: ['connect', 'messages', conversationId, options.search, options.pinned, options.before],
    queryFn: () => api.get<Message[]>(`/connect/conversations/${conversationId}/messages`, {
      params: { search: options.search || undefined, pinned: options.pinned ? 1 : undefined, before: options.before },
    }),
    enabled,
    refetchInterval: 4000,
  });
}

interface SendMessagePayload {
  clientId: string;
  body?: string;
  replyToId?: number | null;
  mentions?: number[];
  voiceNote?: boolean;
  file?: RNFile | null;
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessagePayload) => {
      const data = new FormData();
      data.append('client_id', payload.clientId);
      if (payload.body) data.append('body', payload.body);
      data.append('voice_note', payload.voiceNote ? '1' : '0');
      if (payload.replyToId) data.append('reply_to_id', String(payload.replyToId));
      (payload.mentions ?? []).forEach((id) => data.append('mentions[]', String(id)));
      if (payload.file) data.append('file', payload.file as unknown as Blob);
      return api.post<{ data: Message }>(`/connect/conversations/${conversationId}/messages`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect', 'messages', conversationId] }),
  });
}

type MessageAction = 'edit' | 'delete' | 'pin' | 'react' | 'report';

export function useMessageAction(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, ...payload }: { messageId: number; action: MessageAction; body?: string; reaction?: string; enabled?: boolean; reason?: string }) =>
      api.patch(`/connect/conversations/${conversationId}/messages/${messageId}`, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect', 'messages', conversationId] }),
  });
}

export interface ConnectPreferences {
  availability: 'available' | 'away' | 'busy' | 'offline';
  notifications: boolean;
  allow_calls: boolean;
}

export function useConnectPreferences() {
  return useQuery({ queryKey: ['connect', 'preferences'], queryFn: () => api.get<ConnectPreferences>('/connect/preferences') });
}

export function useSaveConnectPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ConnectPreferences>) => api.patch<ConnectPreferences>('/connect/preferences', payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect', 'preferences'] }),
  });
}

interface ConnectReport { id: number; body: string | null; reason: string; status: string }

export function useConnectReports() {
  return useInfiniteList<ConnectReport>(
    ['connect', 'reports'],
    (page) => api.get<LaravelPage<ConnectReport>>('/connect/reports', { params: { page } }),
  );
}

export function useModerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, action, reason }: { reportId: number; action: 'hide' | 'dismiss'; reason: string }) =>
      api.patch(`/connect/reports/${reportId}`, { action, reason }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect', 'reports'] }),
  });
}

/** Polled from a single place mounted near the app root — see ConnectCallWatcher — so a ringing/active call surfaces no matter which screen is open. */
export function useConnectCalls(enabled: boolean) {
  return useQuery({
    queryKey: ['connect', 'calls'],
    queryFn: () => api.get<{ media_ready: boolean; calls: LaravelPage<VoiceCall> }>('/connect/calls'),
    enabled,
    refetchInterval: 4000,
    retry: false,
  });
}

export function useStartCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.post<{ data: VoiceCall }>('/connect/calls', { conversation_id: conversationId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['connect', 'calls'] }),
  });
}
