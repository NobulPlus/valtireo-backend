<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\OperationAutomationRule;
use App\Models\OperationAutomationRun;
use App\Models\OperationTask;
use App\Models\User;
use App\Services\NotificationDispatchService;
use App\Services\OperationsCenterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OperationsCenterController extends Controller
{
    private const AUTOMATION_TRIGGERS = [
        'employee.status_changed', 'employee.activated', 'employee.exited', 'employee.probation_ending',
        'leave.submitted', 'leave.cancelled',
        'document.submitted', 'document.reviewed', 'document.expiring', 'document.expired',
        'attendance.correction_submitted',
        'ticket.submitted', 'ticket.assigned', 'ticket.resolved', 'ticket.sla_breached',
        'asset.assigned', 'asset.returned',
        'payroll.calculated', 'payroll.exceptions_detected', 'payroll.submitted', 'payroll.finalized',
        'operation.task_overdue',
    ];

    public function __construct(
        private readonly OperationsCenterService $operations,
        private readonly NotificationDispatchService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('operations.view') || $this->operations->canManage($user), 403);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'in_progress', 'completed', 'cancelled'])],
            'category' => ['nullable', 'string', 'max:50'], 'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'critical'])],
            'assigned_user_id' => ['nullable', 'integer'], 'search' => ['nullable', 'string', 'max:150'],
            'due_from' => ['nullable', 'date'], 'due_to' => ['nullable', 'date', 'after_or_equal:due_from'],
            'sort' => ['nullable', Rule::in(['created_at', 'due_at', 'priority', 'status', 'title'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])], 'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json([
            'summary' => $this->operations->summary($user),
            'signals' => $this->operations->signals($user),
            'tasks' => $this->operations->tasks($user, $filters),
        ]);
    }

    public function lookups(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeManage($user);

        $users = User::query()
            ->where('organization_id', $user->organization_id)
            ->with('employee:id,user_id,employee_number,status')
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $candidate) => [
                'id' => $candidate->id,
                'name' => $candidate->name,
                'email' => $candidate->email,
                'employee_number' => $candidate->employee?->employee_number,
                'employee_status' => $candidate->employee?->status,
            ]);

        $employees = Employee::query()
            ->where('organization_id', $user->organization_id)
            ->where('status', 'active')
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name']);

        return response()->json([
            'assignable_users' => $users,
            'subject_employees' => $employees,
        ]);
    }

    public function storeTask(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeManage($user);
        $data = $request->validate($this->taskRules());
        $this->ensureUserBelongsToOrganization($data['assigned_user_id'] ?? null, $user);
        $this->ensureEmployeeBelongsToOrganization($data['subject_employee_id'] ?? null, $user);

        $task = OperationTask::create($data + ['organization_id' => $user->organization_id, 'created_by_id' => $user->id]);
        $this->notifyAssignment($task, $user);

        return response()->json(['task' => $task->load(['assignedUser:id,name,email', 'subjectEmployee:id,first_name,last_name,employee_number'])], 201);
    }

    public function updateTask(Request $request, OperationTask $operationTask): JsonResponse
    {
        $user = $request->user();
        $this->authorizeTask($user, $operationTask, true);
        $data = $request->validate($this->taskRules(true));
        $this->ensureUserBelongsToOrganization($data['assigned_user_id'] ?? null, $user);
        $this->ensureEmployeeBelongsToOrganization($data['subject_employee_id'] ?? null, $user);
        $previousAssignee = $operationTask->assigned_user_id;
        $operationTask->update($data);
        if ($operationTask->assigned_user_id && $operationTask->assigned_user_id !== $previousAssignee) {
            $this->notifyAssignment($operationTask, $user);
        }

        return response()->json(['task' => $operationTask->fresh()->load(['assignedUser:id,name,email', 'subjectEmployee:id,first_name,last_name,employee_number'])]);
    }

    public function taskAction(Request $request, OperationTask $operationTask): JsonResponse
    {
        $user = $request->user();
        $this->authorizeTask($user, $operationTask);
        $data = $request->validate(['action' => ['required', Rule::in(['start', 'complete', 'reopen', 'cancel'])]]);
        $allowed = [
            'open' => ['start', 'complete', 'cancel'],
            'in_progress' => ['complete', 'cancel'],
            'completed' => ['reopen'],
            'cancelled' => ['reopen'],
        ];
        if (! in_array($data['action'], $allowed[$operationTask->status] ?? [], true)) {
            throw ValidationException::withMessages(['action' => ["That action is not available while the task is {$operationTask->status}."]]);
        }

        $values = match ($data['action']) {
            'start' => ['status' => 'in_progress', 'started_at' => $operationTask->started_at ?? now(), 'completed_at' => null, 'completed_by_id' => null],
            'complete' => ['status' => 'completed', 'completed_at' => now(), 'completed_by_id' => $user->id],
            'reopen' => ['status' => 'open', 'completed_at' => null, 'completed_by_id' => null],
            'cancel' => ['status' => 'cancelled', 'completed_at' => now(), 'completed_by_id' => $user->id],
        };
        $operationTask->update($values);
        if ($data['action'] === 'complete' && $operationTask->created_by_id && $operationTask->created_by_id !== $user->id) {
            $creator = User::query()->where('organization_id', $user->organization_id)->find($operationTask->created_by_id);
            if ($creator) {
                $this->notifications->notify($creator, [
                    'category' => 'operations', 'event' => 'operation.task_completed', 'severity' => 'success',
                    'title' => 'Operational task completed', 'message' => $operationTask->title,
                    'action_label' => 'View operations', 'action_url' => '/operations',
                    'entity_type' => 'operation_task', 'entity_id' => $operationTask->id,
                ]);
            }
        }

        return response()->json(['task' => $operationTask->fresh()]);
    }

    public function rules(Request $request): JsonResponse
    {
        $this->authorizeConfigure($request->user());

        return response()->json(['data' => OperationAutomationRule::query()->where('organization_id', $request->user()->organization_id)->withCount('runs')->orderBy('execution_order')->paginate(50)]);
    }

    public function automationCatalog(Request $request): JsonResponse
    {
        $this->authorizeConfigure($request->user());

        return response()->json([
            'triggers' => self::AUTOMATION_TRIGGERS,
            'condition_operators' => ['equals', 'not_equals', 'in', 'not_in', 'present'],
            'action_types' => ['create_task', 'notify_user'],
            'task_statuses' => ['open', 'in_progress', 'completed', 'cancelled'],
            'priorities' => ['low', 'normal', 'high', 'critical'],
        ]);
    }

    public function storeRule(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConfigure($user);
        $rule = OperationAutomationRule::create($request->validate($this->automationRules()) + ['organization_id' => $user->organization_id, 'created_by_id' => $user->id]);

        return response()->json(['rule' => $rule], 201);
    }

    public function updateRule(Request $request, OperationAutomationRule $operationAutomationRule): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConfigure($user);
        abort_unless($operationAutomationRule->organization_id === $user->organization_id, 404);
        $operationAutomationRule->update($request->validate($this->automationRules(true)));

        return response()->json(['rule' => $operationAutomationRule->fresh()]);
    }

    public function runs(Request $request): JsonResponse
    {
        $this->authorizeConfigure($request->user());
        $runs = OperationAutomationRun::query()->where('organization_id', $request->user()->organization_id)
            ->with('rule:id,name,trigger')->latest()->paginate(min((int) $request->input('per_page', 30), 100));

        return response()->json($runs);
    }

    private function taskRules(bool $partial = false): array
    {
        $presence = $partial ? 'sometimes' : 'required';

        return [
            'title' => [$presence, 'string', 'max:255'], 'description' => ['nullable', 'string'],
            'category' => ['sometimes', 'string', 'max:50'], 'priority' => ['sometimes', Rule::in(['low', 'normal', 'high', 'critical'])],
            'assigned_user_id' => ['nullable', 'integer'], 'subject_employee_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'], 'action_url' => ['nullable', 'string', 'max:255'], 'metadata' => ['nullable', 'array'],
        ];
    }

    private function automationRules(bool $partial = false): array
    {
        $presence = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$presence, 'string', 'max:150'], 'trigger' => [$presence, Rule::in(self::AUTOMATION_TRIGGERS)],
            'conditions' => ['nullable', 'array'], 'conditions.*.field' => ['required_with:conditions', 'string'],
            'conditions.*.operator' => ['required_with:conditions', Rule::in(['equals', 'not_equals', 'in', 'not_in', 'present'])],
            'conditions.*.value' => ['nullable'],
            'actions' => [$presence, 'array', 'min:1'], 'actions.*.type' => ['required', Rule::in(['create_task', 'notify_user'])],
            'actions.*.title' => ['nullable', 'string', 'max:255'],
            'actions.*.description' => ['nullable', 'string'], 'actions.*.message' => ['nullable', 'string'],
            'actions.*.category' => ['nullable', 'string', 'max:50'],
            'actions.*.priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'critical'])],
            'actions.*.severity' => ['nullable', Rule::in(['info', 'success', 'warning', 'critical'])],
            'actions.*.assigned_user_id' => ['nullable'], 'actions.*.subject_employee_id' => ['nullable'],
            'actions.*.user_id' => ['nullable'], 'actions.*.due_in_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
            'actions.*.action_label' => ['nullable', 'string', 'max:80'], 'actions.*.action_url' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'], 'execution_order' => ['sometimes', 'integer', 'min:1', 'max:10000'],
        ];
    }

    private function authorizeManage(User $user): void
    {
        abort_unless($this->operations->canManage($user), 403);
    }

    private function authorizeConfigure(User $user): void
    {
        abort_unless($user->is_platform_admin || $user->can('organizations.administer') || $user->can('operations.configure'), 403);
    }

    private function authorizeTask(User $user, OperationTask $task, bool $managementOnly = false): void
    {
        abort_unless($task->organization_id === $user->organization_id, 404);
        abort_unless($this->operations->canManage($user) || (! $managementOnly && $task->assigned_user_id === $user->id), 403);
    }

    private function ensureUserBelongsToOrganization(?int $userId, User $actor): void
    {
        if ($userId) {
            abort_unless(User::query()->where('organization_id', $actor->organization_id)->whereKey($userId)->exists(), 422, 'The assigned user does not belong to this organization.');
        }
    }

    private function ensureEmployeeBelongsToOrganization(?int $employeeId, User $actor): void
    {
        if ($employeeId) {
            abort_unless(Employee::query()->where('organization_id', $actor->organization_id)->whereKey($employeeId)->exists(), 422, 'The employee does not belong to this organization.');
        }
    }

    private function notifyAssignment(OperationTask $task, User $actor): void
    {
        if (! $task->assigned_user_id || $task->assigned_user_id === $actor->id) {
            return;
        }
        $assignee = User::query()->where('organization_id', $actor->organization_id)->find($task->assigned_user_id);
        if ($assignee) {
            $this->notifications->notify($assignee, [
                'category' => 'operations', 'event' => 'operation.task_assigned',
                'severity' => in_array($task->priority, ['high', 'critical'], true) ? 'warning' : 'info',
                'title' => 'Operational task assigned', 'message' => $task->title,
                'action_label' => 'View task', 'action_url' => $task->action_url ?: '/operations',
                'entity_type' => 'operation_task', 'entity_id' => $task->id,
                'metadata' => ['due_at' => $task->due_at?->toISOString(), 'priority' => $task->priority],
            ]);
        }
    }
}
