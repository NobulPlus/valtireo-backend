import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { downloadAndShare, type RNFile } from '../leave/api';
import { useDepartmentOptions } from '../directory/api';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { Paginated, Ticket, TicketCategory, TicketComment, TicketResolver } from '../../types/api';

export { useDepartmentOptions };

export function useMyTickets() {
  return useInfiniteList(['tickets', 'mine'], (page) => api.get<Paginated<Ticket>>('/tickets', { params: { per_page: INFINITE_LIST_PAGE_SIZE, page } }));
}

export function useTicketCategories() {
  return useQuery({
    queryKey: ['tickets', 'categories', 'mine'],
    queryFn: () => api.get<Paginated<TicketCategory>>('/tickets/categories', { params: { per_page: 100, is_active: true } }),
    staleTime: 5 * 60_000,
  });
}

export function useTicketResolvers() {
  return useQuery({
    queryKey: ['tickets', 'resolvers'],
    queryFn: () => api.get<{ data: TicketResolver[] }>('/tickets/resolvers'),
    select: (response) => response.data,
    staleTime: 60_000,
  });
}

export function useTicket(ticketId: number | null) {
  return useQuery({
    queryKey: ['tickets', 'detail', ticketId],
    queryFn: () => api.get<{ data: Ticket }>(`/tickets/${ticketId}`),
    enabled: ticketId !== null,
    select: (response) => response.data,
  });
}

export interface CreateTicketPayload {
  ticket_category_id: number;
  subject: string;
  description: string;
  priority?: string;
  department_id?: number;
  assigned_to_user_id?: number;
  attachment?: RNFile | null;
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
      if (payload.department_id) formData.append('department_id', String(payload.department_id));
      if (payload.assigned_to_user_id) formData.append('assigned_to_user_id', String(payload.assigned_to_user_id));
      if (payload.attachment) formData.append('attachment', payload.attachment as unknown as Blob);

      return api.post<{ ticket: Ticket }>('/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export interface ResubmitTicketPayload {
  subject: string;
  description: string;
}

export function useResubmitTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ResubmitTicketPayload) => api.patch<{ ticket: Ticket }>(`/tickets/${ticketId}/resubmit`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export interface AddTicketCommentPayload {
  comment: string;
  attachment?: RNFile | null;
}

export function useAddTicketComment(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTicketCommentPayload) => {
      const formData = new FormData();
      formData.append('comment', payload.comment);
      if (payload.attachment) formData.append('attachment', payload.attachment as unknown as Blob);

      return api.post<{ comment: TicketComment }>(`/tickets/${ticketId}/comments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }),
  });
}

const ACTIVE_TICKET_STATUSES = new Set(['submitted', 'changes_requested', 'approved', 'in_progress', 'on_hold']);

export function isActiveTicket(ticket: Pick<Ticket, 'status'>): boolean {
  return ACTIVE_TICKET_STATUSES.has(ticket.status);
}

export function isCancellableTicket(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status === 'submitted' || ticket.status === 'changes_requested' || ticket.status === 'approved';
}

type TicketAttachmentDownload = Pick<Ticket, 'id' | 'attachment_file_name' | 'attachment_download_url'>;

export async function openTicketAttachment(ticket: TicketAttachmentDownload): Promise<void> {
  if (!ticket.attachment_download_url) return;
  await downloadAndShare(`/tickets/${ticket.id}/attachment/download`, ticket.attachment_file_name ?? 'attachment');
}

type TicketCommentAttachmentDownload = Pick<TicketComment, 'id' | 'attachment_file_name' | 'attachment_download_url'>;

export async function openTicketCommentAttachment(ticketId: number, comment: TicketCommentAttachmentDownload): Promise<void> {
  if (!comment.attachment_download_url) return;
  await downloadAndShare(`/tickets/${ticketId}/comments/${comment.id}/attachment/download`, comment.attachment_file_name ?? 'attachment');
}
