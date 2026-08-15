<?php

namespace Tests\Feature\Employees;

use App\Models\Employee;
use App\Models\EmployeeEmergencyContact;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeProfileExtensionTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_manage_employee_emergency_contacts(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $contactId = $this->postJson('/api/employee-profile/emergency-contacts', [
            'employee_id' => $employee->id,
            'name' => 'Grace Okafor',
            'relationship' => 'Sibling',
            'phone' => '08090000001',
            'email' => 'grace.okafor@example.com',
            'is_primary' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('emergency_contact.name', 'Grace Okafor')
            ->assertJsonPath('emergency_contact.is_primary', true)
            ->json('emergency_contact.id');

        $this->patchJson("/api/employee-profile/emergency-contacts/{$contactId}", [
            'alternate_phone' => '08090000002',
        ])
            ->assertOk()
            ->assertJsonPath('emergency_contact.alternate_phone', '08090000002');

        $this->getJson("/api/employee-profile/emergency-contacts?employee_id={$employee->id}")
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Grace Okafor');
    }

    public function test_employee_can_manage_own_dependents(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $dependentId = $this->postJson('/api/employee-profile/dependents', [
            'name' => 'Zara Bello',
            'relationship' => 'Child',
            'date_of_birth' => '2020-06-10',
            'gender' => 'female',
            'is_beneficiary' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('dependent.name', 'Zara Bello')
            ->assertJsonPath('dependent.is_beneficiary', true)
            ->json('dependent.id');

        $this->patchJson("/api/employee-profile/dependents/{$dependentId}", [
            'phone' => '08090000003',
        ])
            ->assertOk()
            ->assertJsonPath('dependent.phone', '08090000003');

        $this->getJson('/api/employee-profile/dependents')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Zara Bello']);
    }

    public function test_employee_cannot_update_another_employee_emergency_contact(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $otherEmployee = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();
        $contact = EmployeeEmergencyContact::query()->create([
            'organization_id' => $otherEmployee->organization_id,
            'employee_id' => $otherEmployee->id,
            'name' => 'Private Contact',
            'relationship' => 'Sibling',
            'phone' => '08090000004',
        ]);

        Sanctum::actingAs($employeeUser);

        $this->patchJson("/api/employee-profile/emergency-contacts/{$contact->id}", [
            'phone' => '08090000005',
        ])
            ->assertForbidden();
    }

    public function test_employee_detail_includes_profile_extension_records(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson("/api/employees/{$employee->id}")
            ->assertOk()
            ->assertJsonPath('data.emergency_contacts.0.name', 'Usman Bello')
            ->assertJsonPath('data.dependents.0.name', 'Amira Bello');
    }
}
