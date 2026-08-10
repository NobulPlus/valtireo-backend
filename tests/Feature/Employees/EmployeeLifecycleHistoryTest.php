<?php

namespace Tests\Feature\Employees;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeLifecycleHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_change_employee_status_and_history_is_recorded(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'active',
            'effective_date' => '2026-08-07',
            'reason' => 'Completed onboarding.',
            'note' => 'Activated after HR verification.',
        ])
            ->assertCreated()
            ->assertJsonPath('status_history.previous_status', 'draft')
            ->assertJsonPath('status_history.new_status', 'active')
            ->assertJsonPath('status_history.changed_by.email', 'admin@valtireo.test');

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
        ]);

        $this->getJson("/api/employees/{$employee->id}/status-history")
            ->assertOk()
            ->assertJsonPath('data.0.new_status', 'active');
    }

    public function test_hr_admin_can_change_reporting_manager_and_history_is_recorded(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $manager = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/reporting-history", [
            'new_manager_id' => $manager->id,
            'effective_date' => '2026-08-07',
            'reason' => 'Finance now reports to HR Director for demo.',
            'note' => 'Temporary reporting alignment.',
        ])
            ->assertCreated()
            ->assertJsonPath('reporting_history.new_manager.employee_number', 'EMP-HR-001')
            ->assertJsonPath('reporting_history.changed_by.email', 'admin@valtireo.test');

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'reporting_manager_id' => $manager->id,
        ]);

        $this->getJson("/api/employees/{$employee->id}/reporting-history")
            ->assertOk()
            ->assertJsonPath('data.0.new_manager.employee_number', 'EMP-HR-001');
    }

    public function test_employee_cannot_change_lifecycle_history(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'suspended',
            'effective_date' => '2026-08-07',
        ])
            ->assertForbidden();
    }

    public function test_employee_cannot_be_assigned_to_report_to_self(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/reporting-history", [
            'new_manager_id' => $employee->id,
            'effective_date' => '2026-08-07',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['new_manager_id']);
    }

    public function test_employee_detail_includes_lifecycle_history(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-HR-002')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson("/api/employees/{$employee->id}")
            ->assertOk()
            ->assertJsonPath('data.status_history.0.new_status', 'active')
            ->assertJsonPath('data.reporting_history.0.new_manager.employee_number', 'EMP-HR-001');
    }
}
