<?php

namespace Tests\Feature\Operations;

use App\Models\Employee;
use App\Models\OperationAutomationRule;
use App\Models\OperationAutomationRun;
use App\Models\OperationTask;
use App\Models\Organization;
use App\Models\User;
use App\Services\OperationalAutomationScanner;
use App\Services\OperationAutomationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationsCenterTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_assign_work_and_assignee_can_complete_it(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $this->setPermissionsTeamId($admin->organization_id);
        $assignee = User::query()
            ->where('organization_id', $admin->organization_id)
            ->whereHas('employee')
            ->whereHas('roles', fn ($query) => $query->where('key', 'employee'))
            ->firstOrFail();

        $this->actingAsInOrganization($admin);
        $this->getJson('/api/operations/lookups')
            ->assertOk()
            ->assertJsonFragment(['id' => $assignee->id, 'name' => $assignee->name, 'email' => $assignee->email]);
        $taskId = $this->postJson('/api/operations/tasks', [
            'title' => 'Complete employee verification', 'category' => 'compliance',
            'priority' => 'high', 'assigned_user_id' => $assignee->id, 'due_at' => now()->addDay()->toISOString(),
        ])->assertCreated()->assertJsonPath('task.assigned_user.id', $assignee->id)->json('task.id');

        $this->actingAsInOrganization($assignee);
        $this->getJson('/api/operations/lookups')->assertForbidden();
        $this->getJson('/api/operations/center')->assertOk()->assertJsonPath('tasks.data.0.id', $taskId);
        $this->postJson("/api/operations/tasks/{$taskId}/actions", ['action' => 'complete'])
            ->assertOk()->assertJsonPath('task.status', 'completed');
        $this->assertDatabaseHas('operation_tasks', ['id' => $taskId, 'completed_by_id' => $assignee->id, 'status' => 'completed']);
    }

    public function test_operations_records_are_isolated_between_organizations(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $otherOrganization = Organization::factory()->create();
        $otherTask = OperationTask::create(['organization_id' => $otherOrganization->id, 'title' => 'Private task']);

        $this->actingAsInOrganization($admin);
        $this->patchJson("/api/operations/tasks/{$otherTask->id}", ['title' => 'Changed'])->assertNotFound();
        $this->getJson('/api/operations/center')->assertOk()->assertJsonMissing(['title' => 'Private task']);
    }

    public function test_organization_automation_creates_one_idempotent_task_and_records_each_run(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->firstOrFail();
        $this->actingAsInOrganization($admin);

        $this->postJson('/api/operations/automation-rules', [
            'name' => 'Active employee follow-up', 'trigger' => 'employee.activated',
            'conditions' => [['field' => 'context.new_status', 'operator' => 'equals', 'value' => 'active']],
            'actions' => [[
                'type' => 'create_task', 'title' => 'Prepare access for {{subject.first_name}}',
                'category' => 'onboarding', 'priority' => 'high', 'assigned_user_id' => $admin->id,
                'subject_employee_id' => 'context.subject_employee_id', 'due_in_days' => 2,
            ]],
        ])->assertCreated();

        $context = ['organization_id' => $admin->organization_id, 'new_status' => 'active', 'subject_employee_id' => $employee->id];
        app(OperationAutomationService::class)->dispatch('employee.activated', $employee, $context);
        app(OperationAutomationService::class)->dispatch('employee.activated', $employee, $context);

        $this->assertSame(1, OperationTask::query()->where('organization_id', $admin->organization_id)->where('title', "Prepare access for {$employee->first_name}")->count());
        $this->assertSame(1, OperationAutomationRun::query()->where('organization_id', $admin->organization_id)->where('status', 'completed')->count());
    }

    public function test_employee_status_endpoint_dispatches_organization_automation(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        $this->actingAsInOrganization($admin);

        $this->postJson('/api/operations/automation-rules', [
            'name' => 'Suspension review', 'trigger' => 'employee.status_changed',
            'conditions' => [['field' => 'context.new_status', 'operator' => 'equals', 'value' => 'suspended']],
            'actions' => [[
                'type' => 'create_task', 'title' => 'Review suspension for {{subject.first_name}}',
                'category' => 'employee_lifecycle', 'assigned_user_id' => $admin->id,
                'subject_employee_id' => 'context.subject_employee_id',
            ]],
        ])->assertCreated();

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'suspended', 'effective_date' => today()->toDateString(), 'reason' => 'Administrative review',
        ])->assertCreated();

        $this->assertDatabaseHas('operation_tasks', [
            'organization_id' => $admin->organization_id, 'subject_employee_id' => $employee->id,
            'assigned_user_id' => $admin->id, 'title' => "Review suspension for {$employee->first_name}",
        ]);
    }

    public function test_scheduled_scanner_dispatches_overdue_task_once(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $source = OperationTask::query()->create([
            'organization_id' => $admin->organization_id,
            'title' => 'Overdue source task',
            'due_at' => now()->subDay(),
            'status' => 'open',
        ]);
        OperationAutomationRule::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Escalate overdue work',
            'trigger' => 'operation.task_overdue',
            'actions' => [[
                'type' => 'create_task',
                'title' => 'Escalate {{subject.title}}',
                'priority' => 'critical',
                'assigned_user_id' => $admin->id,
            ]],
            'is_active' => true,
            'created_by_id' => $admin->id,
        ]);

        app(OperationalAutomationScanner::class)->scan();
        app(OperationalAutomationScanner::class)->scan();

        $this->assertDatabaseHas('operation_tasks', [
            'organization_id' => $admin->organization_id,
            'title' => "Escalate {$source->title}",
            'priority' => 'critical',
        ]);
        $this->assertSame(1, OperationAutomationRun::query()->where('trigger', 'operation.task_overdue')->count());
    }
}
