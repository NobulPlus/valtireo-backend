import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { MORE_MENU_ITEMS, useVisibleMoreMenuItems, type MoreMenuItemKey } from './moreMenuItems';

const STORAGE_KEY = 'valtireo.quick_access_order';
export const QUICK_ACCESS_SLOTS = 4;

/** What ships before anyone has customized anything — the four most reached-for-first-thing-every-day features. */
const DEFAULT_ORDER: MoreMenuItemKey[] = ['Connect', 'Assets', 'Documents', 'Payslips'];

function isMoreMenuItemKey(value: unknown): value is MoreMenuItemKey {
  return typeof value === 'string' && MORE_MENU_ITEMS.some((item) => item.key === value);
}

/**
 * Home's Quick Access row — up to {@link QUICK_ACCESS_SLOTS} tiles, user-reordered
 * and user-chosen from everything in the More menu. Persisted per-device via
 * SecureStore (same mechanism as the theme preference), not per-account, matching
 * this app's existing "device-local preference" convention.
 *
 * The saved order is a *preference*, not a guarantee — it's filtered down to
 * what's actually eligible right now (a module could've been unsubscribed since
 * the person last customized this) and topped back up to {@link QUICK_ACCESS_SLOTS}
 * from the default set, so the row is never short a tile just because something
 * saved earlier silently dropped out.
 */
export function useQuickAccessOrder() {
  const visible = useVisibleMoreMenuItems();
  const visibleKeys = visible.map((item) => item.key);
  const [saved, setSaved] = useState<MoreMenuItemKey[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      if (!alive) return;
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        setSaved(Array.isArray(parsed) ? parsed.filter(isMoreMenuItemKey) : null);
      } catch {
        setSaved(null);
      } finally {
        setLoaded(true);
      }
    });
    return () => { alive = false; };
  }, []);

  const setOrder = useCallback((next: MoreMenuItemKey[]) => {
    setSaved(next);
    void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const base = saved ?? DEFAULT_ORDER;
  const order: MoreMenuItemKey[] = [];
  for (const key of base) {
    if (order.length >= QUICK_ACCESS_SLOTS) break;
    if (visibleKeys.includes(key) && !order.includes(key)) order.push(key);
  }
  for (const key of visibleKeys) {
    if (order.length >= QUICK_ACCESS_SLOTS) break;
    if (!order.includes(key)) order.push(key);
  }

  return {
    /** Up to QUICK_ACCESS_SLOTS resolved, eligible items, in the person's chosen order. */
    items: order.map((key) => visible.find((item) => item.key === key)!),
    /** Every eligible item, for the "swap in a different one" picker — includes ones already showing. */
    eligible: visible,
    setOrder,
    isLoaded: loaded,
  };
}
