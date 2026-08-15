<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function organization(Request $request, DashboardService $dashboard): JsonResponse
    {
        abort_unless($request->user()->can('reports.view'), 403, 'You do not have permission to view the organization dashboard.');

        return response()->json($dashboard->organization($request->user(), $request));
    }

    public function manager(Request $request, DashboardService $dashboard): JsonResponse
    {
        return response()->json($dashboard->manager($request->user(), $request));
    }

    public function me(Request $request, DashboardService $dashboard): JsonResponse
    {
        return response()->json($dashboard->me($request->user()));
    }
}
