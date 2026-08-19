<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

/**
 * Scopes every hasRole()/hasAnyRole()/can()/assignRole()/syncRoles() call for
 * the rest of this request to the authenticated user's own organization
 * (Spatie's "team" concept). Must run after auth:sanctum (needs
 * $request->user()) — registered explicitly in both authenticated route
 * groups in routes/api.php, deliberately not via a global middleware group,
 * since global registration in this Laravel version runs before route-level
 * middleware resolves the user.
 *
 * Login/register set this themselves inline (see AuthController::
 * sessionPayload) since those routes have no token yet and never pass
 * through this middleware at all.
 */
class SetPermissionsTeamId
{
    public function handle(Request $request, Closure $next): Response
    {
        $organizationId = $request->user()?->organization_id;

        if ($organizationId !== null) {
            app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);
        }

        return $next($request);
    }
}
