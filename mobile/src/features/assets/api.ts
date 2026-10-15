import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { Asset, Paginated } from '../../types/api';

export function useMyAssets() {
  return useInfiniteList(['assets', 'mine'], (page) => api.get<Paginated<Asset>>('/assets', { params: { per_page: INFINITE_LIST_PAGE_SIZE, page } }));
}

export function useReportAssetFault(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => api.patch<{ data: Asset }>(`/assets/${assetId}/report-fault`, { note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets', 'mine'] }),
  });
}
