<?php

namespace App\Services;

use App\Models\Ticket;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class TicketReportingService
{
    private const BREACH_EXCLUDED_STATUSES = ['resolved', 'closed', 'rejected', 'cancelled'];

    /**
     * @return array<string, mixed>
     */
    public function reporting(User $user, Request $request): array
    {
        $organizationId = $user->organization_id;
        [$periodStart, $periodEnd] = $this->period($request);

        $tickets = Ticket::query()
            ->with('category:id,name,code')
            ->where('organization_id', $organizationId)
            ->whereBetween('submitted_at', [$periodStart, $periodEnd])
            ->get([
                'id',
                'ticket_category_id',
                'status',
                'priority',
                'submitted_at',
                'reviewed_at',
                'first_responded_at',
                'resolved_at',
                'closed_at',
                'sla_due_at',
                'escalation_level',
                'satisfaction_rating',
            ]);

        $resolved = $tickets->whereNotNull('resolved_at');
        $responded = $tickets->whereNotNull('first_responded_at');
        $rated = $tickets->whereNotNull('satisfaction_rating');

        return [
            'date_from' => $periodStart->toDateString(),
            'date_to' => $periodEnd->toDateString(),
            'volume_trend' => $this->volumeTrend($tickets, $periodStart, $periodEnd),
            'by_status' => $this->byStatus($tickets),
            'by_category' => $this->byCategory($tickets),
            'by_priority' => $this->byPriority($tickets),
            'average_resolution_hours' => $resolved->isEmpty() ? null : round(
                $resolved->avg(fn (Ticket $ticket) => $ticket->submitted_at->diffInMinutes($ticket->resolved_at) / 60),
                1
            ),
            'average_first_response_hours' => $responded->isEmpty() ? null : round(
                $responded->avg(fn (Ticket $ticket) => $ticket->submitted_at->diffInMinutes($ticket->first_responded_at) / 60),
                1
            ),
            'satisfaction_average' => $rated->isEmpty() ? null : round($rated->avg('satisfaction_rating'), 1),
            'resolved_count' => $resolved->count(),
            'closed_count' => $tickets->where('status', 'closed')->count(),
            'on_hold_count' => $tickets->where('status', 'on_hold')->count(),
            'in_progress_count' => $tickets->where('status', 'in_progress')->count(),
            'escalated_count' => $tickets->where('escalation_level', '>', 0)->count(),
            'sla_breach_count' => $this->breachedTicketsQuery($organizationId)->count(),
        ];
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function period(Request $request): array
    {
        $periodStart = $request->date('date_from')
            ? CarbonImmutable::instance($request->date('date_from'))->startOfDay()
            : CarbonImmutable::now()->startOfYear();
        $periodEnd = $request->date('date_to')
            ? CarbonImmutable::instance($request->date('date_to'))->endOfDay()
            : CarbonImmutable::now()->endOfDay();

        return [$periodStart, $periodEnd];
    }

    /**
     * @param \Illuminate\Support\Collection<int, Ticket> $tickets
     *
     * @return array<string, mixed>
     */
    private function volumeTrend($tickets, CarbonImmutable $periodStart, CarbonImmutable $periodEnd): array
    {
        $daily = $periodStart->diffInDays($periodEnd) <= 62;
        $bucketFormat = $daily ? 'Y-m-d' : 'Y-m';
        $steps = $daily
            ? $periodStart->daysUntil($periodEnd)
            : $periodStart->startOfMonth()->monthsUntil($periodEnd->startOfMonth());

        $submittedCounts = $tickets->countBy(fn (Ticket $ticket) => $ticket->submitted_at->format($bucketFormat));
        $resolvedCounts = $tickets->whereNotNull('resolved_at')->countBy(fn (Ticket $ticket) => $ticket->resolved_at->format($bucketFormat));

        $entries = collect($steps)
            ->map(function (CarbonImmutable $date) use ($daily, $bucketFormat, $submittedCounts, $resolvedCounts): array {
                $key = $date->format($bucketFormat);

                return [
                    'key' => $key,
                    'label' => $daily ? $date->format('M j') : $date->format('M Y'),
                    'submitted' => $submittedCounts->get($key, 0),
                    'resolved' => $resolvedCounts->get($key, 0),
                ];
            })
            ->values()
            ->all();

        return [
            'grain' => $daily ? 'day' : 'month',
            'entries' => $entries,
        ];
    }

    /**
     * @param \Illuminate\Support\Collection<int, Ticket> $tickets
     *
     * @return array<int, array<string, mixed>>
     */
    private function byCategory($tickets): array
    {
        return $tickets
            ->groupBy(fn (Ticket $ticket) => $ticket->category?->name ?? 'Uncategorized')
            ->map(fn ($group, $name) => ['name' => $name, 'total' => $group->count()])
            ->values()
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * @param \Illuminate\Support\Collection<int, Ticket> $tickets
     *
     * @return array<int, array<string, mixed>>
     */
    private function byStatus($tickets): array
    {
        return $tickets
            ->groupBy('status')
            ->map(fn ($group, $status) => ['status' => $status, 'total' => $group->count()])
            ->values()
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * @param \Illuminate\Support\Collection<int, Ticket> $tickets
     *
     * @return array<int, array<string, mixed>>
     */
    private function byPriority($tickets): array
    {
        return $tickets
            ->groupBy('priority')
            ->map(fn ($group, $priority) => ['priority' => $priority, 'total' => $group->count()])
            ->values()
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder<Ticket>
     */
    public function breachedTicketsQuery(int $organizationId)
    {
        return $this->applyBreachPredicate(Ticket::query()->where('organization_id', $organizationId));
    }

    /**
     * Shared "currently SLA-breached" predicate — used both for the live
     * reporting count (org-scoped, see breachedTicketsQuery()) and for the
     * cross-organization breach reminder sweep in ReminderNotificationService.
     *
     * @template TModel of Ticket
     *
     * @param \Illuminate\Database\Eloquent\Builder<TModel> $query
     *
     * @return \Illuminate\Database\Eloquent\Builder<TModel>
     */
    public function applyBreachPredicate($query)
    {
        return $query
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->whereNotIn('status', self::BREACH_EXCLUDED_STATUSES);
    }
}
