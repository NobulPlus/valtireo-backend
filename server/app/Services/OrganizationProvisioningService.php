<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrganizationProvisioningService
{
    /**
     * @param array<string, mixed> $organizationData
     * @param array<string, string> $adminData
     * @param array<int, string> $moduleKeys
     * @param array<string, mixed> $workspaceSettings
     *
     * @return array<string, mixed>
     */
    public function provision(
        User $createdBy,
        array $organizationData,
        array $adminData,
        array $moduleKeys,
        array $workspaceSettings = []
    ): array {
        return DB::transaction(function () use ($createdBy, $organizationData, $adminData, $moduleKeys, $workspaceSettings): array {
            $organization = Organization::query()->create([
                'name' => $organizationData['name'],
                'code' => strtoupper($organizationData['code']),
                'email' => $organizationData['email'] ?? null,
                'phone' => $organizationData['phone'] ?? null,
                'website' => $organizationData['website'] ?? null,
                'sector' => $organizationData['sector'] ?? null,
                'status' => 'invited',
                'address' => $organizationData['address'] ?? null,
                'city' => $organizationData['city'] ?? null,
                'state' => $organizationData['state'] ?? null,
                'country' => $organizationData['country'],
                'settings' => [],
            ]);

            $location = $organization->locations()->create([
                'name' => 'Main Office',
                'code' => 'MAIN',
                'type' => 'head_office',
                'email' => $organization->email,
                'phone' => $organization->phone,
                'address' => $organization->address,
                'city' => $organization->city,
                'state' => $organization->state,
                'country' => $organization->country,
                'is_primary' => true,
                'is_active' => true,
            ]);

            $workspace = app(WorkspaceSettingsService::class)->update($organization, $workspaceSettings);
            app(DefaultApprovalWorkflowService::class)->seedForOrganization($organization);

            $modules = PlatformModule::query()
                ->whereIn('key', array_values(array_unique($moduleKeys)))
                ->where('is_active', true)
                ->get();

            foreach ($modules as $module) {
                $organization->moduleSubscriptions()->create([
                    'platform_module_id' => $module->id,
                    'status' => 'active',
                    'starts_at' => now(),
                    'expires_at' => null,
                    'settings' => [],
                ]);
            }

            $temporaryPassword = 'Temp@'.Str::random(16).'1';

            $admin = User::query()->create([
                'organization_id' => $organization->id,
                'name' => $adminData['name'],
                'email' => $adminData['email'],
                'password' => $temporaryPassword,
            ]);

            $admin->assignRole('Organization Admin');

            return [
                'organization' => $organization->refresh(),
                'location' => $location->refresh(),
                'admin' => $admin->refresh(),
                'modules' => $modules->values(),
                'workspace' => $workspace,
                'invitation' => [
                    'email' => $admin->email,
                    'temporary_password' => $temporaryPassword,
                    'login_hint' => 'Use this temporary password until the mail/password setup flow is connected.',
                    'delivery_status' => 'pending_mail_provider',
                ],
                'created_by' => [
                    'id' => $createdBy->id,
                    'name' => $createdBy->name,
                    'email' => $createdBy->email,
                ],
            ];
        });
    }
}
