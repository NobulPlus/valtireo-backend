<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\UpdateWorkspaceLogoRequest;
use App\Http\Requests\Workspace\UpdateWorkspaceSettingsRequest;
use App\Models\Organization;
use App\Services\WorkspaceSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

    public function updateLogo(UpdateWorkspaceLogoRequest $request, WorkspaceSettingsService $workspace): JsonResponse
    {
        $organization = $request->user()->organization;

        abort_unless($organization, 404, 'Workspace not found.');

        $this->deleteStoredLogo($organization, $workspace);

        $path = $request->file('logo')->store(
            "organizations/{$organization->id}/branding",
            'public'
        );

        return response()->json([
            'workspace' => $workspace->update($organization, [
                'identity' => ['logo_url' => Storage::disk('public')->url($path)],
            ]),
        ]);
    }

    public function removeLogo(Request $request, WorkspaceSettingsService $workspace): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $organization = $request->user()->organization;

        abort_unless($organization, 404, 'Workspace not found.');

        $this->deleteStoredLogo($organization, $workspace);

        return response()->json([
            'workspace' => $workspace->update($organization, [
                'identity' => ['logo_url' => null],
            ]),
        ]);
    }

    private function deleteStoredLogo(Organization $organization, WorkspaceSettingsService $workspace): void
    {
        $currentUrl = $workspace->forOrganization($organization)['identity']['logo_url'] ?? null;

        if (! $currentUrl || ! str_contains($currentUrl, '/storage/')) {
            return;
        }

        $path = ltrim(parse_url($currentUrl, PHP_URL_PATH) ?? '', '/');
        $path = preg_replace('#^storage/#', '', $path);

        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }
}
