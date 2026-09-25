<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;
use Spatie\Permission\Support\Config as PermissionConfig;

/**
 * Organization-scoped role (Spatie "team" = Organization, team_foreign_key =
 * organization_id — see config/permission.php). `name` is a free-form,
 * organization-owned label; `key` is an internal, never-user-facing slug
 * used only for the handful of places that need to find a specific seeded
 * role again (e.g. "this org's default role for a new hire") without
 * depending on whatever the org has renamed it to. Never read by any
 * authorization check — those are permission-based (see
 * EmployeeRoleAssignmentService).
 */
class Role extends SpatieRole implements AuditableContract
{
    use Auditable;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Overrides Spatie's own `users()` (which resolves the related model via
     * `getModelForGuard(config('auth.defaults.guard'))`) to hardcode
     * App\Models\User directly. Laravel's Authenticate middleware calls
     * Auth::shouldUse('sanctum') on every authenticated API request, which
     * flips the default guard to 'sanctum' for the rest of that request —
     * since config/auth.php has no 'sanctum' guard entry (adding one would
     * itself break every can() check app-wide, as Spatie's permission
     * lookups start filtering by that as the single default guard name,
     * while every Role/Permission row here is seeded with guard_name
     * 'web'), the vendor implementation can't resolve a model and throws.
     * There is only ever one user model in this app, so resolving it
     * dynamically by guard buys nothing — hardcoding it sidesteps the bug
     * entirely without touching global auth config.
     */
    public function users(): BelongsToMany
    {
        return $this->morphedByMany(
            User::class,
            'model',
            PermissionConfig::modelHasRolesTable(),
            app(PermissionRegistrar::class)->pivotRole,
            PermissionConfig::morphKey()
        );
    }
}
