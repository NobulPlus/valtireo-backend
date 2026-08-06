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
        $this->assertSame('locked', $modules->firstWhere('key', 'payroll')['visibility']);
        $this->assertFalse($modules->firstWhere('key', 'payroll')['is_subscribed']);
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
        $employee->assignRole('Employee');

        $response = $this->postJson('/api/auth/login', [
            'email' => 'employee@valtireo.test',
            'password' => 'Password1!',
        ]);

        $response->assertOk();

        $moduleKeys = collect($response->json('modules'))->pluck('key');

        $this->assertTrue($moduleKeys->contains('employee_self_service'));
        $this->assertTrue($moduleKeys->contains('leave'));
        $this->assertFalse($moduleKeys->contains('payroll'));
        $this->assertFalse($moduleKeys->contains('users_roles'));
    }
}
