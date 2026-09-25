<?php

namespace Tests\Feature\Employees;

use App\Models\Employee;
use App\Models\EmployeeCustomField;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeCustomFieldTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_create_custom_field_and_update_employee_values(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $fieldId = $this->postJson('/api/employee-profile/custom-fields', [
            'name' => 'Laptop Asset Tag',
            'key' => 'laptop_asset_tag',
            'type' => 'text',
            'visible_to_employee' => true,
            'editable_by_employee' => false,
            'sort_order' => 40,
        ])
            ->assertCreated()
            ->assertJsonPath('custom_field.key', 'laptop_asset_tag')
            ->json('custom_field.id');

        $this->putJson("/api/employees/{$employee->id}/custom-field-values", [
            'values' => [
                ['field_id' => $fieldId, 'value' => 'LAP-2026-001'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('custom_field_values.0.field.key', 'laptop_asset_tag')
            ->assertJsonPath('custom_field_values.0.value', 'LAP-2026-001');

        $this->getJson("/api/employees/{$employee->id}/custom-field-values")
            ->assertOk()
            ->assertJsonFragment(['value' => 'LAP-2026-001']);

        $this->assertDatabaseHas('employee_profile_activities', [
            'employee_id' => $employee->id,
            'event' => 'custom_fields_updated',
        ]);
    }

    public function test_employee_can_only_update_editable_visible_custom_fields(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->putJson('/api/employee-profile/custom-field-values', [
            'values' => [
                ['key' => 'shirt_size', 'value' => 'L'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('custom_field_values.0.field.key', 'shirt_size')
            ->assertJsonPath('custom_field_values.0.value', 'L');

        $this->putJson('/api/employee-profile/custom-field-values', [
            'values' => [
                ['key' => 'pension_number', 'value' => 'PEN-SHOULD-NOT-CHANGE'],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['values']);
    }

    public function test_profile_overview_includes_extensions_and_timeline(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson("/api/employees/{$employee->id}/profile-overview")
            ->assertOk()
            ->assertJsonPath('employee.id', $employee->id)
            ->assertJsonPath('emergency_contacts.0.name', 'Usman Bello')
            ->assertJsonPath('dependents.0.name', 'Amira Bello')
            ->assertJsonFragment(['key' => 'pension_number'])
            ->assertJsonFragment(['event' => 'profile_seeded']);
    }

    public function test_employee_sees_self_service_profile_overview(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/employee-profile/overview')
            ->assertOk()
            ->assertJsonPath('employee.work_email', 'aisha.bello@valtireo.test')
            ->assertJsonFragment(['key' => 'shirt_size']);
    }

    public function test_employee_cannot_create_custom_field_definitions(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/employee-profile/custom-fields', [
            'name' => 'Private HR Field',
            'key' => 'private_hr_field',
            'type' => 'text',
        ])
            ->assertForbidden();

        $this->assertDatabaseMissing('employee_custom_fields', [
            'key' => 'private_hr_field',
        ]);
    }
}
