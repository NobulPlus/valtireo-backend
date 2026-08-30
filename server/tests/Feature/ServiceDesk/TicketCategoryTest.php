<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\Organization;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_categories_are_seeded_for_the_demo_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        $this->assertDatabaseHas('ticket_categories', ['organization_id' => $admin->organization_id, 'code' => 'IT']);
        $this->assertDatabaseHas('ticket_categories', ['organization_id' => $admin->organization_id, 'code' => 'FACILITIES']);
        $this->assertDatabaseHas('ticket_categories', ['organization_id' => $admin->organization_id, 'code' => 'HR_POLICY']);
        $this->assertDatabaseHas('ticket_categories', ['organization_id' => $admin->organization_id, 'code' => 'OTHER']);
    }

    public function test_service_desk_view_holder_can_create_and_update_a_category(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $categoryId = $this->postJson('/api/tickets/categories', [
            'name' => 'Payroll',
            'code' => 'payroll',
            'description' => 'Payroll-related questions.',
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'PAYROLL')
            ->json('data.id');

        $this->patchJson("/api/tickets/categories/{$categoryId}", [
            'name' => 'Payroll queries',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Payroll queries')
            ->assertJsonPath('data.code', 'PAYROLL');
    }

    public function test_code_must_be_unique_per_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson('/api/tickets/categories', ['name' => 'IT Again', 'code' => 'IT'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_employee_without_service_desk_view_cannot_create_a_category(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/tickets/categories', ['name' => 'Should fail', 'code' => 'FAIL'])
            ->assertForbidden();
    }

    public function test_employee_without_service_desk_view_only_sees_active_categories(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        TicketCategory::query()->where('organization_id', $admin->organization_id)->where('code', 'OTHER')->update(['is_active' => false]);

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $codes = collect($this->getJson('/api/tickets/categories')->assertOk()->json('data'))->pluck('code');

        $this->assertTrue($codes->contains('IT'));
        $this->assertFalse($codes->contains('OTHER'));
    }

    public function test_resolver_sees_inactive_categories_too(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        TicketCategory::query()->where('organization_id', $admin->organization_id)->where('code', 'OTHER')->update(['is_active' => false]);

        Sanctum::actingAs($admin);

        $codes = collect($this->getJson('/api/tickets/categories')->assertOk()->json('data'))->pluck('code');

        $this->assertTrue($codes->contains('OTHER'));
    }

    public function test_cannot_view_or_update_another_organizations_category(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Category Tenant',
            'code' => 'OTHERCATEGORY',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherCategory = TicketCategory::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other org category',
            'code' => 'OTHERORG',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/tickets/categories/{$otherCategory->id}")->assertNotFound();
        $this->patchJson("/api/tickets/categories/{$otherCategory->id}", ['name' => 'Hacked'])->assertNotFound();
    }

    public function test_there_is_no_destroy_route_categories_deactivate_instead(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $category = TicketCategory::query()->where('organization_id', $admin->organization_id)->where('code', 'OTHER')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/tickets/categories/{$category->id}")->assertStatus(405);

        $this->patchJson("/api/tickets/categories/{$category->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('ticket_categories', ['id' => $category->id]);
    }
}
