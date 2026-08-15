<?php

namespace Tests\Feature\Audit;

use App\Models\ApprovalDecision;
use App\Models\ApprovalRequest;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeProfileActivity;
use App\Models\LeaveType;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use OwenIt\Auditing\Models\Audit;
use Tests\TestCase;

class AuditVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_filtered_audit_logs(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->firstOrFail();

        Audit::query()->create([
            'user_type' => User::class,
            'user_id' => $admin->id,
            'event' => 'updated',
            'auditable_type' => Department::class,
            'auditable_id' => $department->id,
            'old_values' => ['description' => $department->description],
            'new_values' => ['description' => 'Updated for audit visibility test.'],
            'url' => '/api/setup/departments',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'tags' => null,
        ]);

        $this->getJson('/api/audit-logs?event=updated&auditable_type=department')
            ->assertOk()
            ->assertJsonPath('meta.total', fn (int $total) => $total >= 1)
            ->assertJsonFragment(['auditable_type' => 'department'])
            ->assertJsonFragment(['event' => 'updated']);
    }

    public function test_admin_can_view_activity_feed_with_filters(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();

        EmployeeProfileActivity::query()->create([
            'organization_id' => $admin->organization_id,
            'employee_id' => $employee->id,
            'actor_id' => $admin->id,
            'event' => 'audit_visibility_test',
            'title' => 'Audit visibility test',
            'description' => 'Created for audit visibility endpoint test.',
            'metadata' => ['source' => 'test'],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson("/api/activity-feed?event=audit_visibility_test&employee_id={$employee->id}")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.event', 'audit_visibility_test')
            ->assertJsonPath('data.0.employee.employee_number', 'EMP-FIN-001')
            ->assertJsonPath('data.0.actor.email', 'admin@valtireo.test');
    }

    public function test_employee_without_audit_permission_cannot_view_audit_visibility(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());

        $this->getJson('/api/audit-logs')->assertForbidden();
        $this->getJson('/api/activity-feed')->assertForbidden();
    }

    public function test_audit_logs_are_scoped_to_logged_in_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $otherOrganization = Organization::query()->create([
            'name' => 'Other Tenant',
            'code' => 'OTHER',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherDepartment = Department::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Finance',
            'code' => 'OTHER-FIN',
            'is_active' => true,
        ]);

        Audit::query()->create([
            'user_type' => User::class,
            'user_id' => null,
            'event' => 'created',
            'auditable_type' => Department::class,
            'auditable_id' => $otherDepartment->id,
            'old_values' => [],
            'new_values' => ['code' => 'OTHER-FIN'],
            'url' => null,
            'ip_address' => null,
            'user_agent' => null,
            'tags' => null,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/audit-logs?auditable_type=department')
            ->assertOk()
            ->assertJsonMissing(['auditable_id' => $otherDepartment->id]);
    }

    public function test_organization_scoped_reference_data_audits_are_visible(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $leaveType = LeaveType::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Sabbatical',
            'code' => 'SABBATICAL',
            'is_paid' => false,
            'is_active' => true,
        ]);

        Audit::query()->create([
            'user_type' => User::class,
            'user_id' => null,
            'event' => 'created',
            'auditable_type' => LeaveType::class,
            'auditable_id' => $leaveType->id,
            'old_values' => [],
            'new_values' => ['code' => 'SABBATICAL'],
            'url' => null,
            'ip_address' => null,
            'user_agent' => null,
            'tags' => null,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/audit-logs?auditable_type=leave_type')
            ->assertOk()
            ->assertJsonFragment(['auditable_id' => $leaveType->id]);
    }

    public function test_nested_scope_audits_are_visible_and_isolated_by_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $approvalRequest = ApprovalRequest::query()->create([
            'organization_id' => $admin->organization_id,
            'approvable_type' => Department::class,
            'approvable_id' => Department::query()->where('organization_id', $admin->organization_id)->firstOrFail()->id,
            'module' => 'audit_visibility_test',
            'action' => 'submit',
            'title' => 'Nested audit visibility test',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);
        $decision = ApprovalDecision::query()->create([
            'approval_request_id' => $approvalRequest->id,
            'actor_id' => $admin->id,
            'action' => 'approve',
            'previous_status' => 'pending',
            'next_status' => 'approved',
        ]);

        $otherOrganization = Organization::query()->create([
            'name' => 'Nested Other Tenant',
            'code' => 'NESTEDOTHER',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherApprovalRequest = ApprovalRequest::query()->create([
            'organization_id' => $otherOrganization->id,
            'approvable_type' => Department::class,
            'approvable_id' => 0,
            'module' => 'audit_visibility_test',
            'action' => 'submit',
            'title' => 'Other org nested audit visibility test',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);
        $otherDecision = ApprovalDecision::query()->create([
            'approval_request_id' => $otherApprovalRequest->id,
            'action' => 'approve',
            'previous_status' => 'pending',
            'next_status' => 'approved',
        ]);

        foreach ([$decision, $otherDecision] as $record) {
            Audit::query()->create([
                'user_type' => User::class,
                'user_id' => null,
                'event' => 'created',
                'auditable_type' => ApprovalDecision::class,
                'auditable_id' => $record->id,
                'old_values' => [],
                'new_values' => ['action' => 'approve'],
                'url' => null,
                'ip_address' => null,
                'user_agent' => null,
                'tags' => null,
            ]);
        }

        Sanctum::actingAs($admin);

        $this->getJson('/api/audit-logs?auditable_type=approval_decision')
            ->assertOk()
            ->assertJsonFragment(['auditable_id' => $decision->id])
            ->assertJsonMissing(['auditable_id' => $otherDecision->id]);
    }
}
