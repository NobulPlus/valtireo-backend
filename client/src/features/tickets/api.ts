import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
import type { Paginated, Ticket, TicketCategory, TicketComment } from '@/types/api';

export function useMyTickets() {
  return useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => api.get<Paginated<Ticket>>('/tickets?per_page=50'),
  });
}

export interface TicketQueueFilters {
  q?: string;
  status?: string;
  priority?: string;
  ticket_category_id?: number;
  department_id?: number;
  assigned_to_user_id?: number | 'unassigned';
  date_from?: string;
  date_to?: string;
  sla_breached?: boolean;
  watching?: boolean;
  sort_by?: 'submitted_at' | 'sla_due_at' | 'priority' | 'status' | 'escalation_level';
  sort_direction?: 'asc' | 'desc';
  per_page?: number;
}

export function useTicketQueue(filters: TicketQueueFilters = {}) {
  return useQuery({
    queryKey: ['tickets', 'queue', filters],
    queryFn: () => api.get<Paginated<Ticket>>('/tickets', { params: { per_page: 50, ...filters } }),
  });
}

export interface TicketReportingFilters {
  date_from?: string;
  date_to?: string;
}

export interface TicketReporting {
  date_from: string;
  date_to: string;
  volume_trend: {
    grain: 'day' | 'month';
    entries: Array<{ key: string; label: string; submitted: number; resolved: number }>;
  };
  by_category: Array<{ name: string; total: number }>;
  by_priority: Array<{ priority: string; total: number }>;
  by_status: Array<{ status: string; total: number }>;
  average_resolution_hours: number | null;
  average_first_response_hours: number | null;
  satisfaction_average: number | null;
  resolved_count: number;
  closed_count: number;
  on_hold_count: number;
  in_progress_count: number;
  escalated_count: number;
  sla_breach_count: number;
}

export function useTicketReporting(filters: TicketReportingFilters = {}) {
  return useQuery({
    queryKey: ['tickets', 'reporting', filters],
    queryFn: () => api.get<{ data: TicketReporting }>('/tickets/reporting', { params: filters }),
    select: (response) => response.data,
  });
}

export function useTicket(ticketId: number | null) {
  return useQuery({
    queryKey: ['tickets', 'detail', ticketId],
    queryFn: () => api.get<{ data: Ticket } | Ticket>(`/tickets/${ticketId}`),
    enabled: ticketId !== null,
    select: (response) => ('data' in response ? response.data : response),
  });
}

export interface TicketCategoryFilters {
  is_active?: boolean;
  search?: string;
}

export function useTicketCategories(filters: TicketCategoryFilters = {}) {
  return useQuery({
    queryKey: ['tickets', 'categories', filters],
    queryFn: () => api.get<Paginated<TicketCategory>>('/tickets/categories', { params: { per_page: 100, ...filters } }),
    staleTime: 60_000,
  });
}

export interface TicketResolver {
  id: number;
  name: string;
  email: string;
  department: { id: number; name: string } | null;
}

export function useTicketResolvers(enabled = true) {
  return useQuery({
    queryKey: ['tickets', 'resolvers'],
    queryFn: () => api.get<{ data: TicketResolver[] }>('/tickets/resolvers'),
    enabled,
    staleTime: 60_000,
  });
}

export interface CreateTicketPayload {
  ticket_category_id: number;
  subject: string;
  description: string;
  priority?: string;
  asset_id?: number;
  assigned_to_user_id?: number;
  department_id?: number;
  attachment?: File | null;
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => {
      const formData = new FormData();
      formData.append('ticket_category_id', String(payload.ticket_category_id));
      formData.append('subject', payload.subject);
      formData.append('description', payload.description);
      if (payload.priority) formData.append('priority', payload.priority);
      if (payload.asset_id) formData.append('asset_id', String(payload.asset_id));
      if (payload.assigned_to_user_id) formData.append('assigned_to_user_id', String(payload.assigned_to_user_id));
      if (payload.department_id) formData.append('department_id', String(payload.department_id));
      if (payload.attachment) formData.append('attachment', payload.attachment);

      return api.post<{ ticket: Ticket }>('/tickets', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export function useCancelTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/tickets/${ticketId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export function useAssignTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignedToUserId: number | null) => api.patch(`/tickets/${ticketId}/assign`, { assigned_to_user_id: assignedToUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicketPriority(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (priority: string) => api.patch(`/tickets/${ticketId}/priority`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useResolveTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.patch(`/tickets/${ticketId}/resolve`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useReopenTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.patch(`/tickets/${ticketId}/reopen`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useStartTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.patch(`/tickets/${ticketId}/start`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useHoldTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.patch(`/tickets/${ticketId}/hold`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useResumeTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.patch(`/tickets/${ticketId}/resume`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export interface EscalateTicketPayload {
  assigned_to_user_id?: number;
  priority?: string;
  note?: string;
}

export function useEscalateTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EscalateTicketPayload) => api.patch(`/tickets/${ticketId}/escalate`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export interface CloseTicketPayload {
  satisfaction_rating?: number;
  satisfaction_comment?: string;
}

export function useCloseTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CloseTicketPayload) => api.patch(`/tickets/${ticketId}/close`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useWatchTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/watch`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUnwatchTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/tickets/${ticketId}/watch`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export interface AddTicketCommentPayload {
  comment: string;
  visibility?: 'public' | 'internal';
  attachment?: File | null;
}

export function useAddTicketComment(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTicketCommentPayload) => {
      const formData = new FormData();
      formData.append('comment', payload.comment);
      if (payload.visibility) formData.append('visibility', payload.visibility);
      if (payload.attachment) formData.append('attachment', payload.attachment);

      return api.post<{ comment: TicketComment }>(`/tickets/${ticketId}/comments`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

const TERMINAL_TICKET_STATUSES = new Set(['resolved', 'closed', 'rejected', 'cancelled']);

export function slaStatus(ticket: Pick<Ticket, 'sla_due_at' | 'status'>): { label: string; overdue: boolean } | null {
  if (!ticket.sla_due_at || TERMINAL_TICKET_STATUSES.has(ticket.status)) return null;

  const dueAt = new Date(ticket.sla_due_at);
  const diffMs = dueAt.getTime() - Date.now();
  const diffHours = Math.round(Math.abs(diffMs) / (60 * 60 * 1000));

  return diffMs < 0
    ? { label: `Overdue by ${diffHours}h`, overdue: true }
    : { label: `Due in ${diffHours}h`, overdue: false };
}

type TicketAttachmentDownload = Pick<Ticket, 'id' | 'attachment_mime_type' | 'attachment_download_url'>;

export async function openTicketAttachmentInNewTab(ticket: TicketAttachmentDownload): Promise<void> {
  if (!ticket.attachment_download_url) return;

  const response = await apiClient.get(`/tickets/${ticket.id}/attachment/download`, {
    responseType: 'blob',
  });
  const responseType = response.headers['content-type'];
  const blob = new Blob([response.data], {
    type: ticket.attachment_mime_type ?? (typeof responseType === 'string' ? responseType : 'application/octet-stream'),
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

type TicketCommentAttachmentDownload = Pick<TicketComment, 'id' | 'attachment_mime_type' | 'attachment_download_url'>;

export async function openTicketCommentAttachmentInNewTab(ticketId: number, comment: TicketCommentAttachmentDownload): Promise<void> {
  if (!comment.attachment_download_url) return;

  const response = await apiClient.get(`/tickets/${ticketId}/comments/${comment.id}/attachment/download`, {
    responseType: 'blob',
  });
  const responseType = response.headers['content-type'];
  const blob = new Blob([response.data], {
    type: comment.attachment_mime_type ?? (typeof responseType === 'string' ? responseType : 'application/octet-stream'),
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}
