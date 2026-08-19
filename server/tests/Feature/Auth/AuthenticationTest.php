<?php

namespace Tests\Feature\Auth;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@valtireo.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'token',
                'token_type',
                'user' => ['id', 'name', 'email'],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'ada@valtireo.test',
        ]);
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@valtireo.test',
            'password' => 'Password1!',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'ada@valtireo.test')
            ->assertJsonStructure(['token', 'token_type', 'user']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@valtireo.test',
            'password' => 'Password1!',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_authenticated_user_can_view_me(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure([
                'user',
                'organization',
                'workspace',
                'roles',
                'permissions',
                'modules',
                'has_manager_scope',
            ]);
    }

    public function test_session_has_manager_scope_false_for_organization_admin_without_employee_record(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $this->assertNull($admin->employee);

        Sanctum::actingAs($admin);

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('has_manager_scope', false);
    }

    public function test_session_has_manager_scope_true_for_supervisor_with_real_scope(): void
    {
        $this->seed();

        $supervisorUser = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $supervisor = Employee::query()->where('work_email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        Employee::query()->where('employee_number', 'EMP-OPS-002')->update(['reporting_manager_id' => $supervisor->id]);

        Sanctum::actingAs($supervisorUser);

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('has_manager_scope', true);
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
