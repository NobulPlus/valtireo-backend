<?php

namespace Tests\Feature\Foundation;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModuleEntitlementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_login_receives_active_and_locked_modules(): void
    {
        $this->seed();

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@valtireo.test',
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('organization.code', 'VALTIREO')
            ->assertJsonPath('modules.0.key', 'organization_setup');

        $modules = collect($response->json('modules'));

        $this->assertSame('enabled', $modules->firstWhere('key', 'employees')['visibility']);
        $this->assertSame('enabled', $modules->firstWhere('key', 'payroll')['visibility']);
        // 'recruitment' is seeded into the catalog but never subscribed for
        // the VALTIREO demo org — it's the still-locked module now that
        // payroll has been subscribed (see PlatformModuleSeeder::subscribedModuleKeys).
        $this->assertSame('locked', $modules->firstWhere('key', 'recruitment')['visibility']);
        $this->assertFalse($modules->firstWhere('key', 'recruitment')['is_subscribed']);
    }

    public function test_employee_login_only_receives_accessible_subscribed_modules(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = User::factory()->create([
            'organization_id' => $admin->organization_id,
            'email' => 'employee@valtireo.test',
            'password' => 'Password1!',
        ]);
        $this->setPermissionsTeamId($admin->organization_id);
        $employee->assignRole('Employee');

        $response = $this->postJson('/api/auth/login', [
            'email' => 'employee@valtireo.test',
            'password' => 'Password1!',
        ]);

        $response->assertOk();

        $moduleKeys = collect($response->json('modules'))->pluck('key');

        $this->assertTrue($moduleKeys->contains('employee_self_service'));
        $this->assertTrue($moduleKeys->contains('leave'));
        $this->assertTrue($moduleKeys->contains('service_desk'));
        // attendance/assets/payroll have no required_permission because their
        // self-service endpoints (attendance.create, "my own assets" scoping,
        // payroll.payslips.view_own) are already satisfied by the Employee
        // role — this module gate must not be stricter than the endpoints it
        // represents, or the module (and its mobile tab/tile) silently
        // disappears for every ordinary employee even though they can use it.
        $this->assertTrue($moduleKeys->contains('attendance'));
        $this->assertTrue($moduleKeys->contains('assets'));
        $this->assertTrue($moduleKeys->contains('payroll'));
        // Same bug class as attendance/assets/payroll above: EmployeeDocumentController's
        // store/download/view/acknowledge/signed-copy endpoints already allow an employee
        // to act on their own documents without employee_documents.view.
        $this->assertTrue($moduleKeys->contains('documents'));
        // 'users_roles' has no self-service angle at all — genuinely admin-only.
        $this->assertFalse($moduleKeys->contains('users_roles'));
    }
}
