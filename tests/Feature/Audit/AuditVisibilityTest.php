<?php

namespace Tests\Feature\Audit;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeProfileActivity;
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
}
