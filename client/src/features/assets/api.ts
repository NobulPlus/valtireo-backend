import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { Asset, Paginated } from '@/types/api';

export interface AssetFilters {
  status?: string;
  category?: string;
  search?: string;
  per_page?: number;
}

export function useAssets(filters: AssetFilters = {}) {
  return useQuery({
    queryKey: ['assets', 'list', filters],
    queryFn: () => api.get<Paginated<Asset>>('/assets', { params: { per_page: 50, ...filters } }),
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
  category: string;
  status?: string;
  assigned_to_employee_id?: number | null;
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
