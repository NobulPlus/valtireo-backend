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

    public function handle(Request $request, Closure $next, string $moduleKey): Response
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

        return $next($request);
    }
}
