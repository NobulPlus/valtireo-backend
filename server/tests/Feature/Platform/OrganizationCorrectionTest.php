<?php

namespace Tests\Feature\Platform;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrganizationCorrectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_can_correct_company_and_invitation_without_sending_mail(): void
    {
        $this->seed();
        Notification::fake();
        Sanctum::actingAs(User::where('email', 'superadmin@valtireo.test')->firstOrFail());
        $result = $this->postJson('/api/platform/organizations', [
            'organization' => ['name' => 'Correction Co', 'code' => 'CORRECT', 'country' => 'Nigeria'],
            'admin' => ['name' => 'Wrong Name', 'email' => 'wrong@correction.test'],
            'modules' => ['organization_setup'],
        ])->assertCreated()->json();
        $id = $result['organization']['id'];
        $adminId = $result['admin']['id'];
        $oldToken = basename(parse_url($result['invitation']['setup_url'], PHP_URL_PATH));
        Notification::fake();

        $this->patchJson("/api/platform/organizations/{$id}/invited-admin/{$adminId}", [
            'name' => 'Duplicate', 'email' => 'superadmin@valtireo.test',
        ])->assertUnprocessable();
        $otherAdmin = User::where('email', 'admin@valtireo.test')->firstOrFail();
        $this->patchJson("/api/platform/organizations/{$id}/invited-admin/{$otherAdmin->id}", [
            'name' => 'Wrong Company', 'email' => 'other@correction.test',
        ])->assertNotFound();
        $this->patchJson("/api/platform/organizations/{$id}/workspace", ['code' => 'VALTIREO'])->assertUnprocessable();

        $this->patchJson("/api/platform/organizations/{$id}/workspace", [
            'name' => 'Correct Company', 'code' => 'corrected', 'country' => 'Ghana',
            'email' => 'contact@correction.test', 'phone' => '123', 'website' => 'https://example.com',
            'sector' => 'technology', 'state' => 'Greater Accra', 'city' => 'Accra', 'address' => '1 Main Road',
        ])->assertOk()->assertJsonPath('organization.code', 'CORRECTED')->assertJsonPath('organization.address', '1 Main Road');
        $this->patchJson("/api/platform/organizations/{$id}/invited-admin/{$adminId}", [
            'name' => 'Correct Admin', 'email' => 'correct@correction.test',
        ])->assertOk();
        Notification::assertNothingSent();
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'wrong@correction.test']);
        $this->assertDatabaseHas('users', ['id' => $adminId, 'email' => 'correct@correction.test']);
        $this->postJson("/api/organization-admin-invitations/{$oldToken}/accept", [
            'email' => 'wrong@correction.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable();
        $newUrl = $this->postJson("/api/platform/organizations/{$id}/resend-admin-invitation")
            ->assertOk()->json('invitation.setup_url');
        $newToken = basename(parse_url($newUrl, PHP_URL_PATH));
        $this->postJson("/api/organization-admin-invitations/{$newToken}/accept", [
            'email' => 'correct@correction.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk();
        $this->patchJson("/api/platform/organizations/{$id}/invited-admin/{$adminId}", [
            'name' => 'Too Late', 'email' => 'late@correction.test',
        ])->assertUnprocessable();
    }

    public function test_non_platform_admin_cannot_correct_company_or_admin(): void
    {
        $this->seed();
        $admin = User::where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);
        $this->patchJson("/api/platform/organizations/{$admin->organization_id}/workspace", ['name' => 'Changed'])->assertForbidden();
        $this->patchJson("/api/platform/organizations/{$admin->organization_id}/invited-admin/{$admin->id}", ['name' => 'Changed', 'email' => 'new@example.test'])->assertForbidden();
    }
}
