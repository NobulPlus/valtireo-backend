<?php

namespace App\Services;

use App\Models\OrbitIteration;
use App\Models\OrbitIterationCarryover;
use App\Models\OrbitProject;
use Illuminate\Support\Collection;

class OrbitReportingService
{
    public function forProject(OrbitProject $project): array
    {
        $iterations = $project->iterations()->orderBy('ends_at')->get();
        $completedIterations = $iterations->where('status', 'completed')->values();
        $activeIteration = $iterations->firstWhere('status', 'active');

        $workItems = $project->workItems()
            ->whereNull('archived_at')
            ->with('status:id,category')
            ->get(['id', 'type', 'status_id', 'iteration_id', 'estimate', 'started_at', 'completed_at']);

        $carryovers = OrbitIterationCarryover::query()
            ->whereIn('from_iteration_id', $completedIterations->pluck('id'))
            ->with('workItem:id,estimate')
            ->get();

        return [
            'generated_at' => now()->toISOString(),
            'velocity' => $this->velocity($completedIterations, $workItems),
            'sprint_summary' => $this->sprintSummary($completedIterations, $workItems, $carryovers),
            'cycle_time' => $this->cycleTime($workItems),
            'active_sprint_burndown' => $this->activeSprintBurndown($activeIteration, $workItems),
        ];
    }

    private function velocity(Collection $completedIterations, Collection $workItems): array
    {
        $entries = $completedIterations->map(function (OrbitIteration $iteration) use ($workItems) {
            $points = $this->sumEstimate(
                $workItems->where('iteration_id', $iteration->id)->filter(fn ($item) => $item->status?->category === 'done')
            );

            return [
                'id' => $iteration->id,
                'label' => $iteration->name,
                'value' => $points,
                'completed_at' => $iteration->completed_at?->toISOString(),
            ];
        })->values();

        $values = $entries->pluck('value')->all();

        return [
            'entries' => $entries->all(),
            'average_points' => count($values) > 0 ? round(array_sum($values) / count($values), 2) : null,
            'median_points' => $this->median($values),
        ];
    }

    private function sprintSummary(Collection $completedIterations, Collection $workItems, Collection $carryovers): array
    {
        return $completedIterations->map(function (OrbitIteration $iteration) use ($workItems, $carryovers) {
            $doneItems = $workItems->where('iteration_id', $iteration->id)->filter(fn ($item) => $item->status?->category === 'done');
            $donePoints = $this->sumEstimate($doneItems);

            $carriedRows = $carryovers->where('from_iteration_id', $iteration->id);
            $carriedCount = $carriedRows->count();
            $carriedPoints = round((float) $carriedRows->sum(fn ($row) => (float) ($row->workItem->estimate ?? 0)), 2);

            return [
                'iteration_id' => $iteration->id,
                'name' => $iteration->name,
                'starts_at' => $iteration->starts_at?->toDateString(),
                'ends_at' => $iteration->ends_at?->toDateString(),
                'completed_at' => $iteration->completed_at?->toISOString(),
                'committed_count' => $doneItems->count() + $carriedCount,
                'committed_points' => round($donePoints + $carriedPoints, 2),
                'done_count' => $doneItems->count(),
                'done_points' => $donePoints,
                'carried_over_count' => $carriedCount,
                'carried_over_points' => $carriedPoints,
            ];
        })->values()->all();
    }

    private function cycleTime(Collection $workItems): array
    {
        $qualifying = $workItems->filter(fn ($item) => $item->started_at !== null && $item->completed_at !== null);
        $hours = $qualifying->map(fn ($item) => $this->hoursBetween($item->started_at, $item->completed_at))->values();

        $byType = $qualifying->groupBy('type')
            ->map(function (Collection $items, string $type) {
                $typeHours = $items->map(fn ($item) => $this->hoursBetween($item->started_at, $item->completed_at));

                return [
                    'type' => $type,
                    'average_hours' => round($typeHours->avg(), 2),
                    'sample_size' => $items->count(),
                ];
            })
            ->filter(fn (array $row) => $row['sample_size'] > 0)
            ->values()
            ->all();

        return [
            'average_hours' => $hours->count() > 0 ? round($hours->avg(), 2) : null,
            'median_hours' => $this->median($hours->all()),
            'sample_size' => $hours->count(),
            'by_type' => $byType,
        ];
    }

    private function activeSprintBurndown(?OrbitIteration $active, Collection $workItems): ?array
    {
        if ($active === null) {
            return null;
        }

        $items = $workItems->where('iteration_id', $active->id);
        $totalPoints = $this->sumEstimate($items);

        $start = ($active->starts_at ?? $active->created_at)->copy()->startOfDay();
        $end = ($active->ends_at ?? now())->copy()->startOfDay();
        $windowEnd = now()->startOfDay()->lt($end) ? now()->startOfDay() : $end;
        $totalSpanDays = max(1, $start->diffInDays($end));

        $series = [];
        $cursor = $start->copy();

        while ($cursor->lte($windowEnd)) {
            $elapsedDays = $start->diffInDays($cursor);
            $idealRemaining = max(0, $totalPoints - ($totalPoints * $elapsedDays / $totalSpanDays));

            $completedByThisDay = $this->sumEstimate(
                $items->filter(fn ($item) => $item->completed_at !== null && $item->completed_at->lte($cursor->copy()->endOfDay()))
            );
            $actualRemaining = max(0, $totalPoints - $completedByThisDay);

            $series[] = [
                'label' => $cursor->toDateString(),
                'values' => ['ideal' => round($idealRemaining, 2), 'actual' => round($actualRemaining, 2)],
            ];

            $cursor->addDay();
        }

        return [
            'iteration_id' => $active->id,
            'name' => $active->name,
            'starts_at' => $active->starts_at?->toDateString(),
            'ends_at' => $active->ends_at?->toDateString(),
            'total_points' => $totalPoints,
            'series' => $series,
            'approximation_note' => "Burndown uses each item's current estimate and completion timestamp to reconstruct past days, since estimates aren't versioned — changing an item's estimate after the fact changes how earlier days of this chart render.",
        ];
    }

    private function sumEstimate(Collection $items): float
    {
        return round((float) $items->sum(fn ($item) => (float) ($item->estimate ?? 0)), 2);
    }

    private function hoursBetween($start, $end): float
    {
        return max(0, ($end->timestamp - $start->timestamp) / 3600);
    }

    /**
     * @param  array<int, float>  $values
     */
    private function median(array $values): ?float
    {
        $count = count($values);
        if ($count === 0) {
            return null;
        }

        sort($values);
        $middle = intdiv($count, 2);

        if ($count % 2 === 0) {
            return round(($values[$middle - 1] + $values[$middle]) / 2, 2);
        }

        return round($values[$middle], 2);
    }
}
