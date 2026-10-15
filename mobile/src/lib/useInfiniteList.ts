import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { LaravelPage, Paginated } from '../types/api';

/** Load the first page fast, then keep fetching ahead of the user's scroll instead of making them tap through numbered pages. */
export const INFINITE_LIST_PAGE_SIZE = 10;

type AnyPage<T> = Paginated<T> | LaravelPage<T>;

function lastPageOf<T>(page: AnyPage<T>): number {
  return 'meta' in page ? page.meta.last_page : page.last_page;
}

export interface UseInfiniteListOptions {
  enabled?: boolean;
}

export function useInfiniteList<T>(
  queryKey: readonly unknown[],
  fetchPage: (page: number) => Promise<AnyPage<T>>,
  options: UseInfiniteListOptions = {},
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return nextPage <= lastPageOf(lastPage) ? nextPage : undefined;
    },
    enabled: options.enabled,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  function fetchMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    fetchMore,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
  };
}
