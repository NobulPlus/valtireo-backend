<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\User;
use App\Services\DefaultRoleSeedingService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RolePermissionSeeder::class);

        $organization = Organization::query()->firstOrCreate(
            ['code' => 'VALTIREO'],
            [
                'name' => 'Valtireo Demo Organization',
                'email' => 'admin@valtireo.test',
                'phone' => '+2340000000000',
                'website' => 'https://valtireo.test',
                'sector' => 'technology',
                'status' => 'active',
                'address' => 'Valtireo Head Office',
                'city' => 'Lagos',
                'state' => 'Lagos',
                'country' => 'Nigeria',
                'settings' => [],
            ]
        );

        if (blank($organization->settings)) {
            $organization->update([
                'settings' => [
                    'identity' => [
                        'welcome_message' => 'Welcome to the Valtireo demo workspace.',
                        'support_email' => 'support@valtireo.test',
                    ],
                    'theme' => [
                        'mode' => 'light',
                        'primary_color' => '#155EEF',
                        'accent_color' => '#12B76A',
                        'sidebar_color' => '#101828',
                        'button_color' => '#155EEF',
                        'font_family' => 'Inter',
                        'radius' => 'soft',
                        'density' => 'comfortable',
                    ],
                    'localization' => [
                        'timezone' => 'Africa/Lagos',
                        'date_format' => 'd/m/Y',
                        'time_format' => '24h',
                        'currency' => 'NGN',
                        'country' => 'Nigeria',
                    ],
                ],
            ]);
        }

        $organization->locations()->firstOrCreate(
            ['code' => 'HQ'],
            [
                'name' => 'Head Office',
                'type' => 'head_office',
                'email' => 'hq@valtireo.test',
                'phone' => '+2340000000000',
                'address' => 'Valtireo Head Office',
                'city' => 'Lagos',
                'state' => 'Lagos',
                'country' => 'Nigeria',
                'is_primary' => true,
                'is_active' => true,
            ]
        );

        $this->call(OrganizationStructureSeeder::class);
        $this->call(PlatformModuleSeeder::class);
        $this->call(ApprovalWorkflowSeeder::class);

        // Roles are organization-owned — seed this org's starter role set
        // (and point Spatie's team context at it) before any assignRole()
        // call below.
        app(PermissionRegistrar::class)->setPermissionsTeamId($organization->id);
        $roles = app(DefaultRoleSeedingService::class)->seedForOrganization($organization);

        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@valtireo.test'],
            [
                'organization_id' => $organization->id,
                'name' => 'Valtireo Admin',
                'password' => 'Password1!',
            ]
        );

        $admin->update([
            'organization_id' => $organization->id,
        ]);

        $admin->syncRoles([$roles->get('organization_admin')]);

        $superAdmin = User::query()->firstOrCreate(
            ['email' => 'superadmin@valtireo.test'],
            [
                'organization_id' => $organization->id,
                'name' => 'Valtireo Super Admin',
                'password' => 'Password1!',
            ]
        );
        // Platform authority is a plain boolean now, independent of the
        // (retired) global "Super Admin" role — see App\Models\User.
        $superAdmin->update(['is_platform_admin' => true]);

        $this->call(RichDemoDataSeeder::class);
        $this->call(EmployeeVarietySeeder::class);
        $this->call(LeaveSeeder::class);
        $this->call(AttendanceSeeder::class);
        $this->call(CustomerOrganizationDemoSeeder::class);
    }
}
