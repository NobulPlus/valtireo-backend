<?php

namespace Tests\Verification;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/** Focused verification against real bearer tokens, without Sanctum::actingAs. */
class MobileSessionContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_mobile_login_returns_a_usable_device_named_bearer_token(): void
    {
        $user = User::factory()->create(['password' => 'Password1!']);
        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Password1!',
            'device_name' => 'verification-mobile-device',
        ])->assertOk()->assertJsonPath('token_type', 'Bearer');

        $this->assertSame('verification-mobile-device', $user->tokens()->firstOrFail()->name);
        Auth::forgetGuards();
        $this->withToken($response->json('token'))->getJson('/api/auth/me')
            ->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_expired_bearer_token_is_rejected_with_json_401(): void
    {
        config(['sanctum.expiration' => 1440]);
        $user = User::factory()->create();
        $issued = $user->createToken('expired-device');
        $issued->accessToken->forceFill(['created_at' => now()->subMinutes(1441)])->save();
        $this->assertTrue($issued->accessToken->fresh()->created_at->lt(now()->subMinutes(1440)));

        Auth::forgetGuards();
        $this->withToken($issued->plainTextToken)->getJson('/api/auth/me')
            ->assertUnauthorized()->assertJsonStructure(['message']);
    }

    public function test_logout_revokes_only_current_device_and_rejects_reuse(): void
    {
        $user = User::factory()->create();
        $mobile = $user->createToken('mobile')->plainTextToken;
        $web = $user->createToken('web')->plainTextToken;

        $this->withToken($mobile)->postJson('/api/auth/logout')->assertOk();
        $this->assertSame(1, $user->tokens()->count());
        Auth::forgetGuards();
        $this->withToken($mobile)->getJson('/api/auth/me')->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken($web)->getJson('/api/auth/me')->assertOk();
    }

    public function test_missing_auth_and_invalid_login_have_machine_readable_errors(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized()->assertJsonStructure(['message']);
        Auth::forgetGuards();
        $this->postJson('/api/auth/login', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }
}
