<?php

namespace Tests\Feature\Auth;

use App\Models\Employee;
use App\Models\User;
use App\Notifications\PasswordResetCodeNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_registration_is_disabled_by_default(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@valtireo.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertForbidden()
            ->assertJsonPath('message', 'Public registration is disabled. Valtireo workspaces are created by platform admins.');
    }

    public function test_user_can_register_when_public_registration_is_enabled(): void
    {
        config(['auth.public_registration' => true]);

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

    public function test_session_reflects_the_employees_uploaded_passport_photo(): void
    {
        Storage::fake('public');
        $this->seed();

        $withoutPhoto = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($withoutPhoto);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.photo_url', null);

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employeeUser->employee->profile()->update(['passport_photo_path' => 'employees/3/passport.jpg']);

        Sanctum::actingAs($employeeUser);
        $response = $this->getJson('/api/auth/me')->assertOk();
        $this->assertStringContainsString('employees/3/passport.jpg', $response->json('user.photo_url'));
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

    public function test_forgot_password_emails_a_code_for_a_known_account(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'ada@valtireo.test']);

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', 'If that email has a Valtireo account, we\'ve sent a password reset code to it.');

        Notification::assertSentTo($user, PasswordResetCodeNotification::class);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_forgot_password_gives_the_same_response_for_an_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@valtireo.test'])
            ->assertOk()
            ->assertJsonPath('message', 'If that email has a Valtireo account, we\'ve sent a password reset code to it.');

        Notification::assertNothingSent();
    }

    public function test_user_can_reset_password_with_a_valid_code(): void
    {
        $user = User::factory()->create(['email' => 'ada@valtireo.test', 'password' => 'OldPassword1!']);
        $user->createToken('other-device');
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make('123456'),
            'created_at' => now(),
        ]);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '123456',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk()->assertJsonPath('message', 'Your password has been reset. Please sign in again.');

        $this->assertTrue(Hash::check('NewPassword1!', $user->refresh()->password));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'NewPassword1!'])->assertOk();
    }

    public function test_reset_password_rejects_an_incorrect_code(): void
    {
        $user = User::factory()->create(['email' => 'ada@valtireo.test']);
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make('123456'),
            'created_at' => now(),
        ]);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '999999',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()->assertJsonValidationErrors(['code']);
    }

    public function test_reset_password_rejects_an_expired_code(): void
    {
        $user = User::factory()->create(['email' => 'ada@valtireo.test']);
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make('123456'),
            'created_at' => now()->subMinutes(16),
        ]);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '123456',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()->assertJsonValidationErrors(['code']);

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
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
