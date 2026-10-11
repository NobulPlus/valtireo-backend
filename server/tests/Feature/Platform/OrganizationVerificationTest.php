<?php

namespace Tests\Feature\Platform;

use App\Models\Organization;
use App\Models\OrganizationVerificationDocument;
use App\Models\User;
use App\Services\OrganizationVerificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrganizationVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_invited_admin_login_moves_organization_to_setup_in_progress(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $setupUrl = $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Atlas Verification Ltd',
                'code' => 'ATLASVERIFY',
                'country' => 'Nigeria',
            ],
            'admin' => [
                'name' => 'Ada Verified',
                'email' => 'ada.verified@atlas.test',
            ],
            'modules' => ['organization_setup', 'employees'],
        ])
            ->assertCreated()
            ->assertJsonPath('organization.status', 'invited')
            ->json('invitation.setup_url');

        $setupToken = basename((string) parse_url($setupUrl, PHP_URL_PATH));

        $this->postJson("/api/organization-admin-invitations/{$setupToken}/accept", [
            'email' => 'ada.verified@atlas.test',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])
            ->assertOk()
            ->assertJsonPath('organization.status', 'setup_in_progress')
            ->assertJsonPath('organization_verification.required_total', 4)
            ->assertJsonPath('organization_verification.is_verified', false);

        $organization = Organization::query()->where('code', 'ATLASVERIFY')->firstOrFail();

        $this->assertSame('setup_in_progress', $organization->status);
        $this->assertDatabaseHas('organization_status_histories', [
            'organization_id' => $organization->id,
            'previous_status' => 'invited',
            'new_status' => 'setup_in_progress',
        ]);
    }

    public function test_organization_verification_documents_gate_activation(): void
    {
        $this->seed();
        Storage::fake('local');

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $setupUrl = $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Pioneer Trust Services',
                'code' => 'PIONEERTRUST',
                'country' => 'Nigeria',
            ],
            'admin' => [
                'name' => 'Tola Admin',
                'email' => 'tola.admin@pioneer.test',
            ],
            'modules' => ['organization_setup', 'employees'],
        ])
            ->assertCreated()
            ->json('invitation.setup_url');

        $setupToken = basename((string) parse_url($setupUrl, PHP_URL_PATH));

        $login = $this->postJson("/api/organization-admin-invitations/{$setupToken}/accept", [
            'email' => 'tola.admin@pioneer.test',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $admin = User::query()->where('email', 'tola.admin@pioneer.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'PIONEERTRUST')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/status", [
            'status' => 'active',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        Sanctum::actingAs($admin);

        foreach (OrganizationVerificationService::REQUIRED_DOCUMENT_TYPES as $type) {
            $this->post('/api/organization-verification/documents', [
                'document_type' => $type,
                'title' => str($type)->replace('_', ' ')->title()->toString(),
                'file' => UploadedFile::fake()->create("{$type}.pdf", 120, 'application/pdf'),
            ])
                ->assertCreated()
                ->assertJsonPath('document.document_type', $type)
                ->assertJsonPath('document.status', 'submitted');
        }

        $this->postJson('/api/organization-verification/submit')
            ->assertOk()
            ->assertJsonPath('verification.is_ready_for_review', true)
            ->assertJsonPath('verification.is_verified', false);

        $this->assertSame('pending_approval', $organization->refresh()->status);

        Sanctum::actingAs($superAdmin);

        $this->getJson("/api/platform/organizations/{$organization->id}/verification-documents")
            ->assertOk()
            ->assertJsonPath('verification.required_submitted', 4)
            ->assertJsonPath('verification.required_approved', 0);

        OrganizationVerificationDocument::query()
            ->where('organization_id', $organization->id)
            ->get()
            ->each(function (OrganizationVerificationDocument $document) use ($organization): void {
                $this->patchJson("/api/platform/organizations/{$organization->id}/verification-documents/{$document->id}", [
                    'action' => 'approve',
                    'note' => 'Verified by platform review.',
                ])
                    ->assertOk()
                    ->assertJsonPath('document.status', 'approved');
            });

        $this->patchJson("/api/platform/organizations/{$organization->id}/status", [
            'status' => 'active',
            'reason' => 'Verification approved.',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Organization activated successfully.')
            ->assertJsonPath('organization.status', 'active')
            ->assertJsonPath('verification.is_verified', true);

        $this->assertSame('active', $organization->refresh()->status);
        $this->assertSame($login->json('user.email'), $admin->email);
    }

    public function test_an_already_reviewed_document_cannot_be_reviewed_again(): void
    {
        $this->seed();
        Storage::fake('local');

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $setupUrl = $this->postJson('/api/platform/organizations', [
            'organization' => ['name' => 'Redecision Guard Ltd', 'code' => 'REDECISION', 'country' => 'Nigeria'],
            'admin' => ['name' => 'Guard Admin', 'email' => 'guard.admin@redecision.test'],
            'modules' => ['organization_setup', 'employees'],
        ])->assertCreated()->json('invitation.setup_url');

        $setupToken = basename((string) parse_url($setupUrl, PHP_URL_PATH));
        $this->postJson("/api/organization-admin-invitations/{$setupToken}/accept", [
            'email' => 'guard.admin@redecision.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $admin = User::query()->where('email', 'guard.admin@redecision.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'REDECISION')->firstOrFail();

        Sanctum::actingAs($admin);
        $documentId = $this->post('/api/organization-verification/documents', [
            'document_type' => 'business_registration',
            'title' => 'Business Registration',
            'file' => UploadedFile::fake()->create('business_registration.pdf', 120, 'application/pdf'),
        ])->assertCreated()->json('document.id');

        Sanctum::actingAs($superAdmin);
        $this->patchJson("/api/platform/organizations/{$organization->id}/verification-documents/{$documentId}", [
            'action' => 'approve', 'note' => 'Looks good.',
        ])->assertOk()->assertJsonPath('document.status', 'approved');

        // A second decision on the same, already-reviewed document row must
        // be rejected — the organization has to resubmit for another round,
        // not have an admin silently flip an already-recorded decision.
        $this->patchJson("/api/platform/organizations/{$organization->id}/verification-documents/{$documentId}", [
            'action' => 'reject', 'note' => 'Changed my mind.',
        ])->assertUnprocessable()->assertJsonValidationErrors(['action']);

        $this->assertDatabaseHas('organization_verification_documents', ['id' => $documentId, 'status' => 'approved']);
    }

    public function test_an_approved_or_pending_document_cannot_be_replaced_by_the_organization(): void
    {
        $this->seed();
        Storage::fake('local');

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $setupUrl = $this->postJson('/api/platform/organizations', [
            'organization' => ['name' => 'No Silent Replace Ltd', 'code' => 'NOSILENTREPLACE', 'country' => 'Nigeria'],
            'admin' => ['name' => 'Replace Admin', 'email' => 'replace.admin@nosilent.test'],
            'modules' => ['organization_setup', 'employees'],
        ])->assertCreated()->json('invitation.setup_url');

        $setupToken = basename((string) parse_url($setupUrl, PHP_URL_PATH));
        $this->postJson("/api/organization-admin-invitations/{$setupToken}/accept", [
            'email' => 'replace.admin@nosilent.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $admin = User::query()->where('email', 'replace.admin@nosilent.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'NOSILENTREPLACE')->firstOrFail();

        Sanctum::actingAs($admin);
        $documentId = $this->post('/api/organization-verification/documents', [
            'document_type' => 'business_registration',
            'title' => 'Business Registration',
            'file' => UploadedFile::fake()->create('business_registration.pdf', 120, 'application/pdf'),
        ])->assertCreated()->json('document.id');

        // Still pending review — the org cannot quietly swap the file for a
        // different one before Valtireo has even looked at the first.
        $this->post('/api/organization-verification/documents', [
            'document_type' => 'business_registration',
            'title' => 'Business Registration (replacement)',
            'file' => UploadedFile::fake()->create('replacement.pdf', 120, 'application/pdf'),
        ])->assertUnprocessable()->assertJsonValidationErrors(['document_type']);

        Sanctum::actingAs($superAdmin);
        $this->patchJson("/api/platform/organizations/{$organization->id}/verification-documents/{$documentId}", [
            'action' => 'approve',
        ])->assertOk();

        // Now approved — the org cannot silently swap an approved document
        // for different content either, which would otherwise let the
        // recorded "approved" decision cover a file Valtireo never reviewed.
        Sanctum::actingAs($admin);
        $this->post('/api/organization-verification/documents', [
            'document_type' => 'business_registration',
            'title' => 'Business Registration (swapped)',
            'file' => UploadedFile::fake()->create('swapped.pdf', 120, 'application/pdf'),
        ])->assertUnprocessable()->assertJsonValidationErrors(['document_type']);

        $this->assertDatabaseCount('organization_verification_documents', 1);
    }

    public function test_rejected_organization_cannot_login(): void
    {
        $this->seed();

        $organization = Organization::factory()->create([
            'status' => 'rejected',
            'code' => 'REJECTEDCO',
        ]);

        User::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Rejected Admin',
            'email' => 'rejected.admin@example.test',
            'password' => 'Password1!',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'rejected.admin@example.test',
            'password' => 'Password1!',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }
}
