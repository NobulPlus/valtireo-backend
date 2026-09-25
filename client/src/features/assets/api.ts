import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { Asset, AssetCategory, AssetReporting, Paginated } from '@/types/api';

export interface AssetFilters {
  status?: string;
  asset_category_id?: number;
  search?: string;
  per_page?: number;
}

export function useAssets(filters: AssetFilters = {}) {
  return useQuery({
    queryKey: ['assets', 'list', filters],
    queryFn: () => api.get<Paginated<Asset>>('/assets', { params: { per_page: 50, ...filters } }),
  });
}

export function useAssetCategories() {
  return useQuery({
    queryKey: ['assets', 'categories'],
    queryFn: () => api.get<{ data: AssetCategory[] }>('/assets/categories'),
    staleTime: 5 * 60_000,
  });
}

export interface CreateAssetCategoryPayload {
  name: string;
  code: string;
  description?: string | null;
}

export function useCreateAssetCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetCategoryPayload) => api.post<{ data: AssetCategory }>('/assets/categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', 'categories'] });
    },
  });
}

export function useUpdateAssetCategory(categoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateAssetCategoryPayload> & { is_active?: boolean }) =>
      api.patch<{ data: AssetCategory }>(`/assets/categories/${categoryId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', 'categories'] });
    },
  });
}

export function useAssetReporting() {
  return useQuery({
    queryKey: ['assets', 'reporting'],
    queryFn: () => api.get<{ data: AssetReporting }>('/assets/reporting'),
    select: (response) => response.data,
  });
}

export function useAsset(assetId: number | null) {
  return useQuery({
    queryKey: ['assets', 'detail', assetId],
    queryFn: () => api.get<{ data: Asset }>(`/assets/${assetId}`),
    enabled: assetId !== null,
    select: (response) => response.data,
  });
}

export function useMyAssets() {
  return useQuery({
    queryKey: ['assets', 'mine'],
    queryFn: () => api.get<Paginated<Asset>>('/assets?per_page=50'),
  });
}

export interface CreateAssetPayload {
  name: string;
  asset_tag: string;
  serial_number?: string | null;
  asset_category_id: number;
  status?: string;
  condition?: string;
  assigned_to_employee_id?: number | null;
  organization_location_id?: number | null;
  purchase_date?: string | null;
  warranty_expires_at?: string | null;
  notes?: string | null;
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => api.post<{ data: Asset }>('/assets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export type UpdateAssetPayload = Partial<CreateAssetPayload>;

export function useUpdateAsset(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAssetPayload) => api.patch<{ data: Asset }>(`/assets/${assetId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export interface AssignAssetPayload {
  employee_id: number;
  condition?: string;
  assigned_at?: string | null;
  note?: string | null;
}

export function useAssignAsset(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignAssetPayload) => api.patch<{ data: Asset }>(`/assets/${assetId}/assign`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export interface ReturnAssetPayload {
  condition: string;
  returned_at?: string | null;
  note?: string | null;
}

export function useReturnAsset(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReturnAssetPayload) => api.patch<{ data: Asset }>(`/assets/${assetId}/return`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useReportAssetFault(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => api.patch<{ data: Asset }>(`/assets/${assetId}/report-fault`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useReturnAssetToService(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => api.patch<{ data: Asset }>(`/assets/${assetId}/return-to-service`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}
