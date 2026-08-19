<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

class OrganizationProvisioningService
{
    public function __construct(
        private readonly NotificationDispatchService $notifications,
        private readonly DefaultRoleSeedingService $roleSeeding,
    ) {
    }
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
            $roles = $this->roleSeeding->seedForOrganization($organization);

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

            app(PermissionRegistrar::class)->setPermissionsTeamId($organization->id);
            $admin->assignRole($roles->get('organization_admin'));

            $deliveryStatus = $this->deliverAdminInvitation($admin, $organization, $temporaryPassword, $createdBy);

            return [
                'organization' => $organization->refresh(),
                'location' => $location->refresh(),
                'admin' => $admin->refresh(),
                'modules' => $modules->values(),
                'workspace' => $workspace,
                'invitation' => [
                    'email' => $admin->email,
                    'temporary_password' => $temporaryPassword,
                    'login_hint' => 'The admin can sign in with this temporary password and should change it after first login.',
                    'delivery_status' => $deliveryStatus,
                ],
                'created_by' => [
                    'id' => $createdBy->id,
                    'name' => $createdBy->name,
                    'email' => $createdBy->email,
                ],
            ];
        });
    }

    private function deliverAdminInvitation(
        User $admin,
        Organization $organization,
        string $temporaryPassword,
        User $createdBy
    ): string {
        if (! config('services.valtireo_notifications.mail_enabled')) {
            return 'skipped';
        }

        try {
            $this->notifications->organizationAdminInvited(
                $admin,
                $organization,
                $temporaryPassword,
                $createdBy
            );

            return 'sent';
        } catch (\Throwable) {
            return 'failed';
        }
    }
}
