<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOrganizationIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && $user->employee()->whereIn('status', ['suspended', 'exited'])->exists()) {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'This account is not currently allowed to access Valtireo.',
                'code' => 'account_access_revoked',
            ], 401);
        }

        $organization = $user?->organization;

        if (in_array($organization?->status, ['suspended', 'rejected'], true)) {
            $user->tokens()->delete();
            return response()->json([
                'message' => 'This organization is not currently allowed to access Valtireo. Please contact Valtireo support.',
                'code' => 'organization_access_revoked',
            ], 403);
        }

        return $next($request);
    }
}
