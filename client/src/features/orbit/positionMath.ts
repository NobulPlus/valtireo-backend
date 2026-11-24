/**
 * Midpoint-insertion position math mirroring OrbitBoardOrderingService::between()
 * on the server — the server is the source of truth (it re-derives nothing from
 * this value beyond storing it), this just picks a sensible number to send.
 * Shared by the board (status-scoped `position`) and the backlog
 * (project-scoped `backlog_rank`) — both are decimal(20,10) columns ordered
 * the same way, just scoped differently.
 */
export function computeDropPosition(siblings: Array<{ id: number; rank: string | number }>, overId: number | null): string {
  const sorted = [...siblings].sort((a, b) => Number(a.rank) - Number(b.rank));
  const appendToEnd = () => String((sorted.length ? Number(sorted[sorted.length - 1].rank) : 0) + 1024);

  if (overId === null) return appendToEnd();

  const overIndex = sorted.findIndex((item) => item.id === overId);
  if (overIndex === -1) return appendToEnd();

  const afterRank = Number(sorted[overIndex].rank);
  const beforeRank = overIndex > 0 ? Number(sorted[overIndex - 1].rank) : null;

  if (beforeRank === null) return String(afterRank / 2);

  const mid = (beforeRank + afterRank) / 2;
  if (mid <= beforeRank || mid >= afterRank) return appendToEnd();

  return String(mid);
}
