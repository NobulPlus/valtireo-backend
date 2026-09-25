<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\OperationTask;
use App\Models\PayrollRun;
use App\Models\Ticket;

class OperationalAutomationScanner
{
    public function __construct(private readonly OperationAutomationService $automations) {}

    /** @return array<string, int> */
    public function scan(int $windowDays = 30): array
    {
        $counts = ['documents' => 0, 'probations' => 0, 'ticket_slas' => 0, 'payroll_exceptions' => 0, 'overdue_tasks' => 0];

        EmployeeDocument::query()->whereNotNull('expires_at')->whereDate('expires_at', '<', today())
            ->chunkById(200, function ($documents) use (&$counts): void {
                foreach ($documents as $document) {
                    $this->automations->dispatch('document.expired', $document, $this->deadlineContext(
                        $document->expires_at->toDateString(),
                        ['subject_employee_id' => $document->employee_id],
                    ));
                    $counts['documents']++;
                }
            });

        EmployeeDocument::query()->whereNotNull('expires_at')->whereBetween('expires_at', [today(), today()->addDays($windowDays)])
            ->chunkById(200, function ($documents) use (&$counts): void {
                foreach ($documents as $document) {
                    $this->automations->dispatch('document.expiring', $document, $this->deadlineContext(
                        $document->expires_at->toDateString(),
                        ['subject_employee_id' => $document->employee_id],
                    ));
                    $counts['documents']++;
                }
            });

        Employee::query()->where('status', 'active')->where('confirmation_status', 'probation')->whereNotNull('probation_ends_at')
            ->whereBetween('probation_ends_at', [today(), today()->addDays($windowDays)])
            ->chunkById(200, function ($employees) use (&$counts): void {
                foreach ($employees as $employee) {
                    $this->automations->dispatch('employee.probation_ending', $employee, $this->deadlineContext(
                        $employee->probation_ends_at->toDateString(),
                        [
                            'subject_employee_id' => $employee->id,
                            'assigned_user_id' => $employee->user_id,
                        ],
                    ));
                    $counts['probations']++;
                }
            });

        Ticket::query()->whereNotIn('status', ['resolved', 'closed', 'cancelled'])->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())
            ->chunkById(200, function ($tickets) use (&$counts): void {
                foreach ($tickets as $ticket) {
                    $this->automations->dispatch('ticket.sla_breached', $ticket, $this->deadlineContext(
                        $ticket->sla_due_at->toISOString(),
                        [
                            'subject_employee_id' => $ticket->employee_id,
                            'assigned_user_id' => $ticket->assigned_to_user_id,
                        ],
                    ));
                    $counts['ticket_slas']++;
                }
            });

        PayrollRun::query()->where('status', 'calculated')->whereHas('items', fn ($query) => $query->where('status', 'exception'))
            ->chunkById(100, function ($runs) use (&$counts): void {
                foreach ($runs as $run) {
                    $this->automations->dispatch('payroll.exceptions_detected', $run, ['event_id' => "calculation:{$run->calculated_at?->timestamp}"]);
                    $counts['payroll_exceptions']++;
                }
            });

        OperationTask::query()->whereIn('status', ['open', 'in_progress'])->whereNotNull('due_at')->where('due_at', '<', now())
            ->chunkById(200, function ($tasks) use (&$counts): void {
                foreach ($tasks as $task) {
                    $this->automations->dispatch('operation.task_overdue', $task, $this->deadlineContext(
                        $task->due_at->toISOString(),
                        [
                            'subject_employee_id' => $task->subject_employee_id,
                            'assigned_user_id' => $task->assigned_to_user_id,
                        ],
                    ));
                    $counts['overdue_tasks']++;
                }
            });

        return $counts;
    }

    private function deadlineContext(string $deadline, array $context = []): array
    {
        return [
            'event_id' => "deadline:{$deadline}",
            'deadline' => $deadline,
            ...array_filter($context, fn ($value) => $value !== null),
        ];
    }
}
