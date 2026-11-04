<?php

namespace App\Services;

use App\Models\OrbitWorkItem;

/**
 * Fractional/decimal ordering for board columns and the backlog, kept
 * deliberately simple (decimal(20,10) midpoint insertion, synchronous
 * renumber when precision runs out) rather than a CRDT or external
 * library — Orbit's board sizes (hundreds, not millions, of cards per
 * column) don't justify more than this.
 */
class OrbitBoardOrderingService
{
    private const GAP = 1024.0;

    public function nextPosition(int $statusId): string
    {
        $max = OrbitWorkItem::query()->where('status_id', $statusId)->max('position');

        return $this->format(((float) ($max ?? 0)) + self::GAP);
    }

    /**
     * Midpoint between two neighboring positions, or null when precision is
     * exhausted (the computed midpoint collapses onto one of its
     * neighbors) — the caller should renumber() and retry in that case.
     */
    public function between(?float $before, ?float $after): ?string
    {
        if ($before === null && $after === null) {
            return $this->format(self::GAP);
        }

        if ($before === null) {
            return $this->format($after / 2);
        }

        if ($after === null) {
            return $this->format($before + self::GAP);
        }

        $mid = ($before + $after) / 2;

        if ($mid <= $before || $mid >= $after) {
            return null;
        }

        return $this->format($mid);
    }

    /**
     * Re-spaces every item in a column evenly. Cheap at Orbit's realistic
     * column sizes — a single UPDATE per row, done synchronously, no
     * queued job needed.
     */
    public function renumber(int $statusId): void
    {
        $items = OrbitWorkItem::query()->where('status_id', $statusId)->orderBy('position')->get();
        $position = self::GAP;

        foreach ($items as $item) {
            $item->forceFill(['position' => $this->format($position)])->saveQuietly();
            $position += self::GAP;
        }
    }

    private function format(float $value): string
    {
        return number_format($value, 10, '.', '');
    }
}
