<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\ApprovalRequest;
use App\Models\AssetCategory;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssetModuleTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
    }

    private function employeeUser(): User
    {
        return User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
    }

    private function categoryId(string $code): int
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        return AssetCategory::query()
            ->where('organization_id', $organization->id)
            ->where('code', $code)
            ->firstOrFail()
            ->id;
    }

    public function test_privileged_user_can_create_asset_and_employee_without_permission_cannot(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $this->postJson('/api/assets', [
            'name' => 'Dell Latitude 5420',
            'asset_tag' => 'AST-0001',
            'asset_category_id' => $this->categoryId('LAPTOP'),
        ])->assertCreated()->assertJsonPath('data.status', 'available');

        Sanctum::actingAs($this->employeeUser());
        $this->postJson('/api/assets', [
            'name' => 'iPhone 15',
            'asset_tag' => 'AST-0002',
            'asset_category_id' => $this->categoryId('PHONE'),
        ])->assertForbidden();
    }

    public function test_asset_tag_must_be_unique_within_organization(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->postJson('/api/assets', ['name' => 'First', 'asset_tag' => 'AST-DUPE', 'asset_category_id' => $this->categoryId('LAPTOP')])->assertCreated();
        $this->postJson('/api/assets', ['name' => 'Second', 'asset_tag' => 'AST-DUPE', 'asset_category_id' => $this->categoryId('LAPTOP')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_tag']);
    }

    public function test_asset_category_validation_rejects_an_unknown_category_id(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->postJson('/api/assets', ['name' => 'Mystery Box', 'asset_tag' => 'AST-0003', 'asset_category_id' => 999999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_category_id']);
    }

    public function test_asset_categories_can_be_listed_created_and_updated(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/assets/categories')
            ->assertOk()
            ->assertJsonFragment(['code' => 'LAPTOP']);

        $categoryId = $this->postJson('/api/assets/categories', [
            'name' => 'Monitor',
            'code' => 'monitor',
            'description' => 'External monitors.',
        ])->assertCreated()->assertJsonPath('data.code', 'MONITOR')->json('data.id');

        $this->patchJson("/api/assets/categories/{$categoryId}", ['name' => 'Monitors'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Monitors')
            ->assertJsonPath('data.code', 'MONITOR');

        $this->postJson('/api/assets/categories', ['name' => 'Duplicate', 'code' => 'monitor'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_employee_without_assets_permission_cannot_create_an_asset_category(): void
    {
        $this->seed();

        Sanctum::actingAs($this->employeeUser());

        $this->postJson('/api/assets/categories', ['name' => 'Monitor', 'code' => 'monitor'])->assertForbidden();
    }

    public function test_assigning_an_asset_stamps_assigned_at_and_unassigning_clears_it(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', ['name' => 'MacBook Pro', 'asset_tag' => 'AST-0004', 'asset_category_id' => $this->categoryId('LAPTOP')])
            ->assertCreated()->json('data.id');

        $this->patchJson("/api/assets/{$assetId}", ['status' => 'assigned', 'assigned_to_employee_id' => $employee->id])
            ->assertOk()
            ->assertJsonPath('data.status', 'assigned')
            ->assertJsonPath('data.assigned_to.id', $employee->id);

        $assignedAt = $this->getJson("/api/assets/{$assetId}")->assertOk()->json('data.assigned_at');
        $this->assertNotNull($assignedAt);

        $this->patchJson("/api/assets/{$assetId}", ['status' => 'available'])
            ->assertOk()
            ->assertJsonPath('data.status', 'available')
            ->assertJsonPath('data.assigned_to', null)
            ->assertJsonPath('data.assigned_at', null);

        $this->assertDatabaseHas('asset_assignment_histories', [
            'asset_id' => $assetId,
            'employee_id' => $employee->id,
            'assigned_by_id' => $admin->id,
            'returned_by_id' => $admin->id,
        ]);
    }

    public function test_asset_can_be_assigned_and_returned_with_assignment_history(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', [
            'name' => 'Lifecycle laptop',
            'asset_tag' => 'AST-LIFE-001',
            'asset_category_id' => $this->categoryId('LAPTOP'),
            'serial_number' => 'SN-LIFE-001',
            'condition' => 'new',
        ])->assertCreated()
            ->assertJsonPath('data.serial_number', 'SN-LIFE-001')
            ->assertJsonPath('data.condition', 'new')
            ->json('data.id');

        $this->patchJson("/api/assets/{$assetId}/assign", [
            'employee_id' => $employee->id,
            'condition' => 'good',
            'note' => 'Issued during onboarding.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'assigned')
            ->assertJsonPath('data.condition', 'good')
            ->assertJsonPath('data.assigned_to.id', $employee->id)
            ->assertJsonPath('data.assignment_history.0.employee.id', $employee->id)
            ->assertJsonPath('data.assignment_history.0.issue_note', 'Issued during onboarding.');

        $this->patchJson("/api/assets/{$assetId}/return", [
            'condition' => 'fair',
            'note' => 'Returned on exit clearance.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'available')
            ->assertJsonPath('data.condition', 'fair')
            ->assertJsonPath('data.assigned_to', null)
            ->assertJsonPath('data.assignment_history.0.return_note', 'Returned on exit clearance.');

        $this->assertDatabaseHas('asset_assignment_histories', [
            'asset_id' => $assetId,
            'employee_id' => $employee->id,
            'issue_condition' => 'good',
            'return_condition' => 'fair',
            'issue_note' => 'Issued during onboarding.',
            'return_note' => 'Returned on exit clearance.',
        ]);
    }

    public function test_employee_detail_includes_current_assets_and_assignment_history(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', [
            'name' => 'Employee detail laptop',
            'asset_tag' => 'AST-DETAIL-001',
            'asset_category_id' => $this->categoryId('LAPTOP'),
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/assets/{$assetId}/assign", [
            'employee_id' => $employee->id,
            'condition' => 'good',
            'note' => 'Visible on employee profile.',
        ])->assertOk();

        $this->getJson("/api/employees/{$employee->id}")
            ->assertOk()
            ->assertJsonPath('data.assets.0.id', $assetId)
            ->assertJsonPath('data.assets.0.name', 'Employee detail laptop')
            ->assertJsonPath('data.asset_assignment_history.0.asset.id', $assetId)
            ->assertJsonPath('data.asset_assignment_history.0.issue_note', 'Visible on employee profile.');
    }

    public function test_employee_cannot_exit_until_assigned_assets_are_returned(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->firstOrFail();
        $employee->update(['status' => 'active']);

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', [
            'name' => 'Exit clearance laptop',
            'asset_tag' => 'AST-EXIT-001',
            'asset_category_id' => $this->categoryId('LAPTOP'),
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/assets/{$assetId}/assign", [
            'employee_id' => $employee->id,
            'condition' => 'good',
        ])->assertOk();

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'exited',
            'effective_date' => now()->toDateString(),
            'reason' => 'Resigned',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['new_status']);

        $this->patchJson("/api/assets/{$assetId}/return", [
            'condition' => 'good',
            'note' => 'Returned before exit.',
        ])->assertOk();

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'exited',
            'effective_date' => now()->toDateString(),
            'reason' => 'Resigned',
        ])->assertCreated()
            ->assertJsonPath('status_history.new_status', 'exited');
    }

    public function test_assigning_without_an_employee_is_rejected(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $assetId = $this->postJson('/api/assets', ['name' => 'Office Chair', 'asset_tag' => 'AST-0005', 'asset_category_id' => $this->categoryId('FURNITURE')])
            ->assertCreated()->json('data.id');

        $this->patchJson("/api/assets/{$assetId}", ['status' => 'assigned'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assigned_to_employee_id']);
    }

    public function test_non_privileged_employee_only_sees_their_own_assigned_assets(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employeeUser = $this->employeeUser();
        $employee = $employeeUser->employee()->firstOrFail();
        $otherEmployee = Employee::query()->where('organization_id', $admin->organization_id)->where('id', '!=', $employee->id)->firstOrFail();

        Sanctum::actingAs($admin);
        $mineId = $this->postJson('/api/assets', ['name' => 'My Laptop', 'asset_tag' => 'AST-0006', 'asset_category_id' => $this->categoryId('LAPTOP')])->json('data.id');
        $othersId = $this->postJson('/api/assets', ['name' => 'Their Laptop', 'asset_tag' => 'AST-0007', 'asset_category_id' => $this->categoryId('LAPTOP')])->json('data.id');

        $this->patchJson("/api/assets/{$mineId}", ['status' => 'assigned', 'assigned_to_employee_id' => $employee->id])->assertOk();
        $this->patchJson("/api/assets/{$othersId}", ['status' => 'assigned', 'assigned_to_employee_id' => $otherEmployee->id])->assertOk();

        Sanctum::actingAs($employeeUser);
        $this->assertSame([$mineId], $this->getJson('/api/assets')->assertOk()->json('data.*.id'));

        $this->getJson("/api/assets/{$othersId}")->assertForbidden();
        $this->getJson("/api/assets/{$mineId}")->assertOk();
    }

    public function test_cannot_access_another_organizations_asset(): void
    {
        $this->seed();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Asset Tenant',
            'code' => 'OTHERASSET',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherCategory = AssetCategory::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Laptop',
            'code' => 'LAPTOP',
        ]);
        $otherAsset = \App\Models\Asset::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Cross-tenant asset',
            'asset_tag' => 'AST-CROSS',
            'asset_category_id' => $otherCategory->id,
            'status' => 'available',
        ]);

        Sanctum::actingAs($this->admin());
        $this->getJson("/api/assets/{$otherAsset->id}")->assertNotFound();
        $this->patchJson("/api/assets/{$otherAsset->id}", ['name' => 'Hijacked'])->assertNotFound();
    }

    public function test_ticket_can_carry_an_asset_id_scoped_to_the_submitters_own_assigned_assets(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employeeUser = $this->employeeUser();
        $employee = $employeeUser->employee()->firstOrFail();
        $category = \App\Models\TicketCategory::query()->where('organization_id', $employee->organization_id)->where('code', 'IT')->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', ['name' => 'Ticket-linked laptop', 'asset_tag' => 'AST-0008', 'asset_category_id' => $this->categoryId('LAPTOP')])->json('data.id');
        $this->patchJson("/api/assets/{$assetId}", ['status' => 'assigned', 'assigned_to_employee_id' => $employee->id])->assertOk();

        $otherAssetId = $this->postJson('/api/assets', ['name' => 'Not mine', 'asset_tag' => 'AST-0009', 'asset_category_id' => $this->categoryId('LAPTOP')])->json('data.id');

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $category->id,
            'subject' => 'Laptop issue',
            'description' => 'Screen flickers.',
            'asset_id' => $assetId,
        ])->assertCreated()->assertJsonPath('ticket.asset.id', $assetId);

        $this->postJson('/api/tickets', [
            'ticket_category_id' => $category->id,
            'subject' => 'Wrong asset',
            'description' => 'Should be rejected.',
            'asset_id' => $otherAssetId,
        ])->assertUnprocessable()->assertJsonValidationErrors(['asset_id']);
    }

    public function test_submitting_a_ticket_against_an_asset_sends_it_to_maintenance_and_logs_an_incident(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employeeUser = $this->employeeUser();
        $employee = $employeeUser->employee()->firstOrFail();
        $category = \App\Models\TicketCategory::query()->where('organization_id', $employee->organization_id)->where('code', 'IT')->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', ['name' => 'Faulty laptop', 'asset_tag' => 'AST-0011', 'asset_category_id' => $this->categoryId('LAPTOP')])->json('data.id');
        $this->patchJson("/api/assets/{$assetId}", ['status' => 'assigned', 'assigned_to_employee_id' => $employee->id])->assertOk();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $category->id,
            'subject' => 'Laptop keeps overheating',
            'description' => 'Shuts down after 10 minutes.',
            'asset_id' => $assetId,
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($admin);
        $this->getJson("/api/assets/{$assetId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'maintenance')
            ->assertJsonPath('data.incidents.0.event', 'fault_reported')
            ->assertJsonPath('data.incidents.0.ticket_id', $ticketId)
            ->assertJsonPath('data.incidents.0.new_status', 'maintenance');

        // Resolving the ticket returns the asset to service — back to
        // "assigned" (not "available"), since it's still with the employee.
        $approval = ApprovalRequest::query()
            ->where('organization_id', $admin->organization_id)
            ->where('module', 'service_desk')
            ->where('approvable_id', $ticketId)
            ->latest()
            ->firstOrFail();
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();

        $this->patchJson("/api/tickets/{$ticketId}/resolve")->assertOk();

        $this->getJson("/api/assets/{$assetId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'assigned')
            ->assertJsonPath('data.incidents.0.event', 'returned_to_service')
            ->assertJsonPath('data.incidents.0.new_status', 'assigned')
            ->assertJsonPath('data.incidents.1.event', 'fault_reported');
    }

    public function test_it_can_send_an_asset_to_maintenance_and_back_directly_without_a_ticket(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $assetId = $this->postJson('/api/assets', ['name' => 'Spare laptop', 'asset_tag' => 'AST-0012', 'asset_category_id' => $this->categoryId('LAPTOP')])
            ->assertCreated()->json('data.id');

        $this->patchJson("/api/assets/{$assetId}/report-fault", ['note' => 'Sent for scheduled maintenance.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'maintenance');

        $this->patchJson("/api/assets/{$assetId}/report-fault", ['note' => 'Already in maintenance.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->patchJson("/api/assets/{$assetId}/return-to-service", ['note' => 'Maintenance complete.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'available');

        $this->assertDatabaseHas('asset_incidents', ['asset_id' => $assetId, 'event' => 'fault_reported', 'ticket_id' => null]);
        $this->assertDatabaseHas('asset_incidents', ['asset_id' => $assetId, 'event' => 'returned_to_service', 'ticket_id' => null]);
    }

    public function test_employee_without_assets_permission_cannot_report_a_fault_directly(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $assetId = $this->postJson('/api/assets', ['name' => 'Guarded laptop', 'asset_tag' => 'AST-0013', 'asset_category_id' => $this->categoryId('LAPTOP')])
            ->assertCreated()->json('data.id');

        Sanctum::actingAs($this->employeeUser());
        $this->patchJson("/api/assets/{$assetId}/report-fault", ['note' => 'Broken.'])->assertForbidden();
    }

    public function test_asset_reporting_reflects_status_category_and_open_incidents(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $laptopId = $this->postJson('/api/assets', ['name' => 'Reported laptop', 'asset_tag' => 'AST-0014', 'asset_category_id' => $this->categoryId('LAPTOP')])
            ->assertCreated()->json('data.id');
        $this->postJson('/api/assets', ['name' => 'Spare furniture', 'asset_tag' => 'AST-0015', 'asset_category_id' => $this->categoryId('FURNITURE')])
            ->assertCreated();

        $this->patchJson("/api/assets/{$laptopId}/report-fault", ['note' => 'Keyboard unresponsive.'])->assertOk();

        $reporting = $this->getJson('/api/assets/reporting')->assertOk()->json('data');

        $this->assertSame(1, collect($reporting['open_incidents'])->count());
        $this->assertSame('Reported laptop', $reporting['open_incidents'][0]['asset_name']);
        $this->assertContains('maintenance', collect($reporting['by_status'])->pluck('status')->all());
        $this->assertContains('Laptop', collect($reporting['by_category'])->pluck('name')->all());
    }

    public function test_organization_dashboard_reflects_asset_counts(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $this->postJson('/api/assets', ['name' => 'Dashboard laptop', 'asset_tag' => 'AST-0016', 'asset_category_id' => $this->categoryId('LAPTOP')])
            ->assertCreated();

        $this->getJson('/api/dashboard/organization')
            ->assertOk()
            ->assertJsonPath('assets.available', fn ($value) => $value >= 1);
    }

    public function test_asset_detail_shows_the_tickets_raised_against_it(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employeeUser = $this->employeeUser();
        $employee = $employeeUser->employee()->firstOrFail();
        $category = \App\Models\TicketCategory::query()->where('organization_id', $employee->organization_id)->where('code', 'IT')->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', ['name' => 'History laptop', 'asset_tag' => 'AST-0010', 'asset_category_id' => $this->categoryId('LAPTOP')])->json('data.id');
        $this->patchJson("/api/assets/{$assetId}", ['status' => 'assigned', 'assigned_to_employee_id' => $employee->id])->assertOk();

        $this->getJson("/api/assets/{$assetId}")->assertOk()->assertJsonPath('data.tickets', []);

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $category->id,
            'subject' => 'Battery drains fast',
            'description' => 'Needs replacement.',
            'asset_id' => $assetId,
        ])->assertCreated();

        Sanctum::actingAs($admin);
        $this->getJson("/api/assets/{$assetId}")
            ->assertOk()
            ->assertJsonPath('data.tickets.0.subject', 'Battery drains fast')
            ->assertJsonPath('data.tickets.0.status', 'submitted');
    }
}
