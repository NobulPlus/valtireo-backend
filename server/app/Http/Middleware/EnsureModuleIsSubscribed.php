<?php

namespace App\Http\Middleware;

use App\Models\PlatformModule;
use App\Services\ModuleEntitlementService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleIsSubscribed
{
    public function __construct(private readonly ModuleEntitlementService $modules)
    {
    }

    /**
     * $enforcePermission is opt-in (default 'false') and must stay that way: several
     * modules (reports, employees, ...) deliberately keep their routes reachable to
     * everyone in a subscribed org and do their own finer-grained, often
     * narrower-than-required_permission filtering inside the controller — e.g.
     * GET /reports intentionally returns 200 with an empty list rather than 403 for
     * a user without reports.view, and employee directory/org-chart browsing is
     * gated by org settings, not employees.view. Orbit has no such per-route
     * fallback, so it's the one group that opts in (see routes/api.php).
     */
    public function handle(Request $request, Closure $next, string $moduleKey, string $enforcePermission = 'false'): Response
    {
        $user = $request->user();

        if (! $user || $user->is_platform_admin) {
            return $next($request);
        }

        $organization = $user->organization;

        if (! $organization) {
            return response()->json([
                'message' => 'This action requires an organization workspace.',
            ], 403);
        }

        $module = PlatformModule::query()
            ->where('key', $moduleKey)
            ->where('is_active', true)
            ->first();

        if (! $module) {
            return response()->json([
                'message' => 'This module is not available on the platform.',
                'module' => $moduleKey,
            ], 403);
        }

        if (! $this->modules->organizationHasActiveSubscription($organization, $moduleKey)) {
            return response()->json([
                'message' => "Your organization is not subscribed to the {$module->name} module.",
                'module' => $moduleKey,
            ], 403);
        }

        if (filter_var($enforcePermission, FILTER_VALIDATE_BOOLEAN) && ! $this->modules->userHasRequiredPermission($user, $module)) {
            return response()->json([
                'message' => "You do not have access to the {$module->name} module.",
                'module' => $moduleKey,
            ], 403);
        }

        return $next($request);
    }
}
