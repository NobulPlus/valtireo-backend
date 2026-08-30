<?php

namespace Tests\Feature\ServiceDesk;

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

    public function test_privileged_user_can_create_asset_and_employee_without_permission_cannot(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $this->postJson('/api/assets', [
            'name' => 'Dell Latitude 5420',
            'asset_tag' => 'AST-0001',
            'category' => 'laptop',
        ])->assertCreated()->assertJsonPath('data.status', 'available');

        Sanctum::actingAs($this->employeeUser());
        $this->postJson('/api/assets', [
            'name' => 'iPhone 15',
            'asset_tag' => 'AST-0002',
            'category' => 'phone',
        ])->assertForbidden();
    }

    public function test_asset_tag_must_be_unique_within_organization(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->postJson('/api/assets', ['name' => 'First', 'asset_tag' => 'AST-DUPE', 'category' => 'laptop'])->assertCreated();
        $this->postJson('/api/assets', ['name' => 'Second', 'asset_tag' => 'AST-DUPE', 'category' => 'laptop'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_tag']);
    }

    public function test_category_validation_rejects_unlisted_values(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->postJson('/api/assets', ['name' => 'Mystery Box', 'asset_tag' => 'AST-0003', 'category' => 'spaceship'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);
    }

    public function test_assigning_an_asset_stamps_assigned_at_and_unassigning_clears_it(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', ['name' => 'MacBook Pro', 'asset_tag' => 'AST-0004', 'category' => 'laptop'])
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
    }

    public function test_assigning_without_an_employee_is_rejected(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $assetId = $this->postJson('/api/assets', ['name' => 'Office Chair', 'asset_tag' => 'AST-0005', 'category' => 'furniture'])
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
        $mineId = $this->postJson('/api/assets', ['name' => 'My Laptop', 'asset_tag' => 'AST-0006', 'category' => 'laptop'])->json('data.id');
        $othersId = $this->postJson('/api/assets', ['name' => 'Their Laptop', 'asset_tag' => 'AST-0007', 'category' => 'laptop'])->json('data.id');

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
        $otherAsset = \App\Models\Asset::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Cross-tenant asset',
            'asset_tag' => 'AST-CROSS',
            'category' => 'laptop',
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
        $assetId = $this->postJson('/api/assets', ['name' => 'Ticket-linked laptop', 'asset_tag' => 'AST-0008', 'category' => 'laptop'])->json('data.id');
        $this->patchJson("/api/assets/{$assetId}", ['status' => 'assigned', 'assigned_to_employee_id' => $employee->id])->assertOk();

        $otherAssetId = $this->postJson('/api/assets', ['name' => 'Not mine', 'asset_tag' => 'AST-0009', 'category' => 'laptop'])->json('data.id');

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

    public function test_asset_detail_shows_the_tickets_raised_against_it(): void
    {
        $this->seed();

        $admin = $this->admin();
        $employeeUser = $this->employeeUser();
        $employee = $employeeUser->employee()->firstOrFail();
        $category = \App\Models\TicketCategory::query()->where('organization_id', $employee->organization_id)->where('code', 'IT')->firstOrFail();

        Sanctum::actingAs($admin);
        $assetId = $this->postJson('/api/assets', ['name' => 'History laptop', 'asset_tag' => 'AST-0010', 'category' => 'laptop'])->json('data.id');
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
