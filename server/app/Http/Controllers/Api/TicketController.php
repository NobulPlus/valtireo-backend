<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceDesk\AssignTicketRequest;
use App\Http\Requests\ServiceDesk\CancelTicketRequest;
use App\Http\Requests\ServiceDesk\CloseTicketRequest;
use App\Http\Requests\ServiceDesk\EscalateTicketRequest;
use App\Http\Requests\ServiceDesk\HoldTicketRequest;
use App\Http\Requests\ServiceDesk\ReopenTicketRequest;
use App\Http\Requests\ServiceDesk\ResolveTicketRequest;
use App\Http\Requests\ServiceDesk\ResumeTicketRequest;
use App\Http\Requests\ServiceDesk\StartTicketRequest;
use App\Http\Requests\ServiceDesk\StoreTicketRequest;
use App\Http\Requests\ServiceDesk\UpdateTicketPriorityRequest;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Models\User;
use App\Services\TicketReportingService;
use App\Services\TicketService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TicketController extends Controller
{
    public function resolvers(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('service_desk.view') || $request->user()->can('service_desk.create'),
            403
        );

        $resolvers = User::query()
            ->where('organization_id', $request->user()->organization_id)
            ->with('employee.department')
            ->get()
            ->filter(fn (User $user) => $user->can('service_desk.view'))
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'department' => $user->employee?->department ? [
                    'id' => $user->employee->department->id,
                    'name' => $user->employee->department->name,
                ] : null,
            ])
            ->values();

        return response()->json(['data' => $resolvers]);
    }

    public function reporting(Request $request, TicketReportingService $reporting): JsonResponse
    {
        abort_unless($request->user()->can('service_desk.view'), 403);

        return response()->json(['data' => $reporting->reporting($request->user(), $request)]);
    }

    public function index(Request $request, TicketService $tickets): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('service_desk.view') || $request->user()->can('service_desk.create'), 403);

        $query = Ticket::query()
            ->with($tickets->relations())
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('q')->toString(), function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('subject', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhereHas('employee', function (Builder $query) use ($search): void {
                            $query
                                ->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%")
                                ->orWhere('employee_number', 'like', "%{$search}%")
                                ->orWhere('work_email', 'like', "%{$search}%");
                        });
                });
            })
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('priority')->toString(), fn (Builder $query, string $priority) => $query->where('priority', $priority))
            ->when($request->integer('ticket_category_id'), fn (Builder $query, int $categoryId) => $query->where('ticket_category_id', $categoryId))
            ->when($request->integer('department_id'), fn (Builder $query, int $departmentId) => $query->where('department_id', $departmentId))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->where('submitted_at', '>=', $date->startOfDay()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->where('submitted_at', '<=', $date->endOfDay()))
            ->when($request->boolean('sla_breached'), fn (Builder $query) => $query
                ->whereNotNull('sla_due_at')
                ->where('sla_due_at', '<', now())
                ->whereNotIn('status', ['resolved', 'closed', 'rejected', 'cancelled']));

        if (! $request->user()->can('service_desk.view')) {
            $query->where('employee_id', $request->user()->employee?->id);
        } else {
            if ($request->integer('employee_id')) {
                $query->where('employee_id', $request->integer('employee_id'));
            }

            if ($request->string('assigned_to_user_id')->toString() === 'unassigned') {
                $query->whereNull('assigned_to_user_id');
            } elseif ($request->integer('assigned_to_user_id')) {
                $query->where('assigned_to_user_id', $request->integer('assigned_to_user_id'));
            }

            if ($request->boolean('watching')) {
                $query->whereHas('watchers', fn (Builder $query) => $query->where('user_id', $request->user()->id));
            }
        }

        $sortBy = $request->string('sort_by')->toString();
        $sortDirection = $request->string('sort_direction')->toString() === 'asc' ? 'asc' : 'desc';
        $sortable = ['submitted_at', 'sla_due_at', 'priority', 'status', 'escalation_level'];

        if (in_array($sortBy, $sortable, true)) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->latest('id');
        }

        return TicketResource::collection($query->paginate(min(max($request->integer('per_page', 15), 1), 100)));
    }

    public function store(StoreTicketRequest $request, TicketService $tickets): JsonResponse
    {
        $data = $request->validated();
        if ($request->hasFile('attachment')) {
            $data['attachment'] = $request->file('attachment');
        }

        $ticket = $tickets->submit($request->user(), $data);

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ], 201);
    }

    public function show(Request $request, Ticket $ticket, TicketService $tickets): TicketResource
    {
        abort_unless($ticket->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('service_desk.view') || $request->user()->employee?->id === $ticket->employee_id, 403);

        return new TicketResource($ticket->load($tickets->relations()));
    }

    public function downloadAttachment(Request $request, Ticket $ticket): StreamedResponse
    {
        abort_unless($ticket->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('service_desk.view') || $request->user()->employee?->id === $ticket->employee_id, 403);
        abort_unless(filled($ticket->attachment_file_path) && Storage::disk('local')->exists($ticket->attachment_file_path), 404);

        return Storage::disk('local')->download($ticket->attachment_file_path, $ticket->attachment_file_name);
    }

    public function cancel(CancelTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->cancel($request->user(), $ticket);

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function assign(AssignTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->assign($request->user(), $ticket, $request->integer('assigned_to_user_id') ?: null);

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function updatePriority(UpdateTicketPriorityRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->updatePriority($request->user(), $ticket, $request->string('priority')->toString());

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function start(StartTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->start($request->user(), $ticket, $request->input('note'));

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function hold(HoldTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->hold($request->user(), $ticket, $request->string('reason')->toString());

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function resume(ResumeTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->resume($request->user(), $ticket, $request->input('note'));

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function escalate(EscalateTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->escalate(
            $request->user(),
            $ticket,
            $request->integer('assigned_to_user_id') ?: null,
            $request->input('priority'),
            $request->input('note')
        );

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function resolve(ResolveTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->resolve($request->user(), $ticket, $request->input('note'));

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function close(CloseTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->close(
            $request->user(),
            $ticket,
            $request->integer('satisfaction_rating') ?: null,
            $request->input('satisfaction_comment')
        );

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function reopen(ReopenTicketRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->reopen($request->user(), $ticket, $request->string('reason')->toString());

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function watch(Request $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->watch($request->user(), $ticket);

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }

    public function unwatch(Request $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $ticket = $tickets->unwatch($request->user(), $ticket);

        return response()->json([
            'ticket' => new TicketResource($ticket),
        ]);
    }
}
