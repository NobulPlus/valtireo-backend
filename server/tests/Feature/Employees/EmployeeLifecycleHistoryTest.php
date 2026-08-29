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
        $employee->profile()->update([
            'date_of_birth' => '1994-05-12',
            'gender' => 'male',
            'residential_address' => '24 Operations Street',
            'next_of_kin_name' => 'Grace Adeyemi',
            'next_of_kin_phone' => '08030000002',
        ]);
        $employee->emergencyContacts()->create([
            'organization_id' => $employee->organization_id,
            'name' => 'Grace Adeyemi',
            'phone' => '08030000002',
        ]);
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

    public function test_draft_employee_status_change_to_invited_creates_invitation(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();
        $employee->update([
            'status' => 'draft',
            'user_id' => null,
            'invited_at' => null,
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'invited',
            'effective_date' => '2026-08-07',
            'reason' => 'Send onboarding invitation.',
        ])
            ->assertCreated()
            ->assertJsonPath('status_history.previous_status', 'draft')
            ->assertJsonPath('status_history.new_status', 'invited');

        $employee->refresh();

        $this->assertSame('invited', $employee->status);
        $this->assertNotNull($employee->user_id);
        $this->assertNotNull($employee->invited_at);
        $this->assertDatabaseHas('employee_invitations', [
            'employee_id' => $employee->id,
            'email' => $employee->work_email,
            'status' => 'pending',
            'invited_by_user_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $employee->user_id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $admin->id,
        ]);
    }

    public function test_employee_without_work_email_cannot_be_invited_from_status_action(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();
        $employee->update([
            'status' => 'draft',
            'work_email' => '',
            'user_id' => null,
            'invited_at' => null,
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'invited',
            'effective_date' => '2026-08-07',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['new_status']);

        $this->assertDatabaseMissing('employee_invitations', [
            'employee_id' => $employee->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'draft',
            'invited_at' => null,
        ]);
    }

    public function test_active_lifecycle_employee_cannot_move_back_to_pre_active_status(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $employee->update(['status' => 'active']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'onboarding',
            'effective_date' => '2026-08-07',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['new_status']);

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
        ]);
    }

    public function test_employee_cannot_be_activated_when_three_or_fewer_required_biodata_fields_are_missing(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $employee->update(['status' => 'onboarding']);
        $employee->profile()->update([
            'date_of_birth' => null,
            'gender' => null,
            'residential_address' => '12 Finance Road',
            'next_of_kin_name' => 'Jane Bello',
            'next_of_kin_phone' => '08030000001',
        ]);
        $employee->emergencyContacts()->create([
            'organization_id' => $employee->organization_id,
            'name' => 'Jane Bello',
            'phone' => '08030000001',
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'active',
            'effective_date' => '2026-08-07',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['new_status'])
            ->assertJsonPath('errors.new_status.0', 'Cannot activate employee. Missing biodata: Date of birth, Gender.');

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'onboarding',
        ]);
    }

    public function test_employee_cannot_be_activated_when_more_than_three_required_biodata_fields_are_missing(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();
        $employee->update(['status' => 'onboarding']);
        $employee->profile()->update([
            'date_of_birth' => null,
            'gender' => null,
            'residential_address' => null,
            'next_of_kin_name' => null,
            'next_of_kin_phone' => null,
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'active',
            'effective_date' => '2026-08-07',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['new_status'])
            ->assertJsonPath('errors.new_status.0', 'Cannot activate employee. Important biodata is missing. Review the employee biodata before activation.');

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'onboarding',
        ]);
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
