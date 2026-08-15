<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformModuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('Super Admin'), 403);

        $modules = PlatformModule::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'description', 'category'])
            ->values();

        return response()->json(['data' => $modules]);
    }
}
