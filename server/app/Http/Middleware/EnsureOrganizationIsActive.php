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

        if ($organization?->status === 'suspended') {
            return response()->json([
                'message' => 'This organization has been suspended. Please contact Valtireo support.',
            ], 403);
        }

        return $next($request);
    }
}
