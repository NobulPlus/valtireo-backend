<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditVisibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditVisibilityController extends Controller
{
    public function auditLogs(Request $request, AuditVisibilityService $audit): JsonResponse
    {
        abort_unless($request->user()->can('audit_logs.view'), 403);

        return response()->json($audit->auditLogs($request->user(), $request));
    }

    public function activityFeed(Request $request, AuditVisibilityService $audit): JsonResponse
    {
        abort_unless($request->user()->can('audit_logs.view'), 403);

        return response()->json($audit->activityFeed($request->user(), $request));
    }
}
