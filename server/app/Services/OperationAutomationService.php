<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\OperationAutomationRule;
use App\Models\OperationAutomationRun;
use App\Models\OperationTask;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Throwable;

class OperationAutomationService
{
    public function __construct(private readonly NotificationDispatchService $notifications) {}

    public function dispatch(string $trigger, Model $subject, array $context = []): void
    {
        $organizationId = (int) ($subject->getAttribute('organization_id') ?: data_get($context, 'organization_id'));
        if (! $organizationId) {
            return;
        }

        OperationAutomationRule::query()
            ->where('organization_id', $organizationId)
            ->where('trigger', $trigger)
            ->where('is_active', true)
            ->orderBy('execution_order')
            ->each(function (OperationAutomationRule $rule) use ($organizationId, $trigger, $subject, $context): void {
                $occurrence = (string) data_get($context, 'event_id', $subject->getKey());
                $deduplicationKey = hash('sha256', implode('|', [$trigger, $subject->getMorphClass(), $subject->getKey(), $occurrence]));
                $run = OperationAutomationRun::firstOrCreate([
                    'organization_id' => $organizationId,
                    'operation_automation_rule_id' => $rule->id,
                    'deduplication_key' => $deduplicationKey,
                ], [
                    'subject_type' => $subject->getMorphClass(),
                    'subject_id' => $subject->getKey(),
                    'trigger' => $trigger,
                    'status' => 'running',
                    'context' => $context,
                    'started_at' => now(),
                ]);

                if (! $run->wasRecentlyCreated) {
                    return;
                }

                try {
                    if (! $this->matches($rule->conditions ?? [], $subject, $context)) {
                        $run->update(['status' => 'skipped', 'results' => [], 'completed_at' => now()]);

                        return;
                    }

                    $results = [];
                    foreach ($rule->actions ?? [] as $index => $action) {
                        $results[] = $this->execute($rule, $trigger, $subject, $context, $action, $index);
                    }
                    $run->update(['status' => 'completed', 'results' => $results, 'completed_at' => now()]);
                } catch (Throwable $exception) {
                    report($exception);
                    $run->update(['status' => 'failed', 'error' => $exception->getMessage(), 'completed_at' => now()]);
                }
            });
    }

    private function matches(array $conditions, Model $subject, array $context): bool
    {
        $data = ['subject' => $subject->toArray(), 'context' => $context];
        foreach ($conditions as $condition) {
            $actual = data_get($data, $condition['field'] ?? '');
            $expected = $condition['value'] ?? null;
            $matched = match ($condition['operator'] ?? 'equals') {
                'not_equals' => $actual != $expected,
                'in' => in_array($actual, (array) $expected, true),
                'not_in' => ! in_array($actual, (array) $expected, true),
                'present' => ! is_null($actual) && $actual !== '',
                default => $actual == $expected,
            };
            if (! $matched) {
                return false;
            }
        }

        return true;
    }

    private function execute(OperationAutomationRule $rule, string $trigger, Model $subject, array $context, array $action, int $index): array
    {
        $type = $action['type'] ?? null;
        if ($type === 'create_task') {
            $occurrence = data_get($context, 'event_id', $subject->getKey());
            $key = "automation:{$rule->id}:{$trigger}:{$subject->getMorphClass()}:{$subject->getKey()}:{$occurrence}:{$index}";
            $employeeId = $this->resolve($action['subject_employee_id'] ?? null, $context);
            $assignedUserId = $this->resolve($action['assigned_user_id'] ?? null, $context);
            if ($employeeId && ! Employee::query()->where('organization_id', $rule->organization_id)->whereKey($employeeId)->exists()) {
                throw new \InvalidArgumentException('The automation employee does not belong to this organization.');
            }
            if ($assignedUserId && ! User::query()->where('organization_id', $rule->organization_id)->whereKey($assignedUserId)->exists()) {
                throw new \InvalidArgumentException('The automation assignee does not belong to this organization.');
            }
            $task = OperationTask::firstOrCreate(
                ['organization_id' => $rule->organization_id, 'key' => $key],
                [
                    'source_type' => $subject->getMorphClass(), 'source_id' => $subject->getKey(),
                    'subject_employee_id' => $employeeId,
                    'assigned_user_id' => $assignedUserId,
                    'category' => $action['category'] ?? 'general',
                    'title' => $this->render($action['title'] ?? $rule->name, $subject, $context),
                    'description' => $this->render($action['description'] ?? '', $subject, $context),
                    'priority' => $action['priority'] ?? 'normal', 'status' => 'open',
                    'due_at' => isset($action['due_in_days']) ? now()->addDays((int) $action['due_in_days']) : null,
                    'action_url' => $this->render($action['action_url'] ?? '', $subject, $context),
                    'metadata' => ['automation_rule_id' => $rule->id, 'trigger' => $trigger],
                ]
            );

            return ['type' => $type, 'task_id' => $task->id, 'created' => $task->wasRecentlyCreated];
        }

        if ($type === 'notify_user') {
            $userId = $this->resolve($action['user_id'] ?? null, $context);
            $user = User::query()->where('organization_id', $rule->organization_id)->findOrFail($userId);
            $this->notifications->notify($user, [
                'category' => $action['category'] ?? 'operations', 'event' => $trigger,
                'severity' => $action['severity'] ?? 'info',
                'title' => $this->render($action['title'] ?? $rule->name, $subject, $context),
                'message' => $this->render($action['message'] ?? '', $subject, $context),
                'action_label' => $action['action_label'] ?? null,
                'action_url' => $this->render($action['action_url'] ?? '', $subject, $context),
                'entity_type' => $subject->getMorphClass(), 'entity_id' => $subject->getKey(),
            ]);

            return ['type' => $type, 'user_id' => $user->id];
        }

        throw new \InvalidArgumentException("Unsupported automation action [{$type}].");
    }

    private function resolve(mixed $value, array $context): mixed
    {
        return is_string($value) && Str::startsWith($value, 'context.') ? data_get($context, Str::after($value, 'context.')) : $value;
    }

    private function render(string $template, Model $subject, array $context): string
    {
        return preg_replace_callback('/\{\{\s*([^}]+)\s*\}\}/', fn ($match) => (string) data_get(['subject' => $subject->toArray(), 'context' => $context], trim($match[1]), ''), $template) ?? $template;
    }
}
