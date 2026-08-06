<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\UpdateWorkspaceSettingsRequest;
use App\Services\WorkspaceSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceController extends Controller
{
    public function show(Request $request, WorkspaceSettingsService $workspace): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.view'), 403);

        $organization = $request->user()->organization;

        abort_unless($organization, 404, 'Workspace not found.');

        return response()->json([
            'workspace' => $workspace->forOrganization($organization),
        ]);
    }

    public function update(UpdateWorkspaceSettingsRequest $request, WorkspaceSettingsService $workspace): JsonResponse
    {
        $organization = $request->user()->organization;

        abort_unless($organization, 404, 'Workspace not found.');

        return response()->json([
            'workspace' => $workspace->update($organization, $request->validated()),
        ]);
    }
}
