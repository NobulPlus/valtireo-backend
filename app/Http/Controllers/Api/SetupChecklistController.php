<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SetupChecklistService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SetupChecklistController extends Controller
{
    public function show(Request $request, SetupChecklistService $checklist): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        return response()->json($checklist->forUser($request->user()));
    }
}
