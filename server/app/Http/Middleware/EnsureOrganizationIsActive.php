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
        $organization = $user?->organization;

        if (in_array($organization?->status, ['suspended', 'rejected'], true)) {
            return response()->json([
                'message' => 'This organization is not currently allowed to access Valtireo. Please contact Valtireo support.',
            ], 403);
        }

        return $next($request);
    }
}
