import { api } from './apiClient';
import type { Paginated } from '../types/api';

/** Fetch actual pages; increasing per_page beyond the server cap cannot load more. */
export async function pagedResource<T>(path: string, limit: number, params: Record<string, unknown> = {}): Promise<Paginated<T>> {
  let result: Paginated<T> | undefined;
  for (let page = 1; page <= Math.ceil(limit / 100); page++) {
    const next = await api.get<Paginated<T>>(path, { params: { ...params, per_page: 100, page } });
    result = result ? { ...next, data: [...result.data, ...next.data] } : next;
    if (page >= next.meta.last_page) break;
  }
  return result!;
}
