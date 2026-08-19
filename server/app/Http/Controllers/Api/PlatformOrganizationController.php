<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ProvisionOrganizationRequest;
use App\Http\Requests\Platform\UpdateOrganizationModuleRequest;
use App\Http\Requests\Platform\UpdateOrganizationStatusRequest;
use App\Http\Requests\Platform\UpdateOrganizationWorkspaceRequest;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\PlatformModule;
use App\Services\OrganizationProvisioningService;
use App\Services\PlatformAdminService;
use App\Services\WorkspaceSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlatformOrganizationController extends Controller
{
    public function dashboard(Request $request, PlatformAdminService $platform): JsonResponse
    {
        abort_unless($request->user()->is_platform_admin, 403);

        return response()->json($platform->dashboard($request));
    }

    public function index(Request $request, PlatformAdminService $platform): JsonResponse
    {
        abort_unless($request->user()->is_platform_admin, 403);

        return response()->json($platform->organizations($request));
    }

    public function export(Request $request, PlatformAdminService $platform): StreamedResponse
    {
        abort_unless($request->user()->is_platform_admin, 403);

        return $platform->exportOrganizations($request);
    }

    public function show(
        Request $request,
        Organization $organization,
        PlatformAdminService $platform
    ): JsonResponse {
        abort_unless($request->user()->is_platform_admin, 403);

        return response()->json($platform->organization($organization));
    }

    public function updateStatus(
        UpdateOrganizationStatusRequest $request,
        Organization $organization,
        PlatformAdminService $platform
    ): JsonResponse {
        if ($organization->is($request->user()->organization)) {
            return response()->json([
                'message' => 'You cannot suspend or reactivate your own platform organization.',
            ], 422);
        }

        $previousStatus = $organization->status;

        $organization->update([
            'status' => $request->validated('status'),
        ]);

        $organization->statusHistories()->create([
            'changed_by_id' => $request->user()->id,
            'previous_status' => $previousStatus,
            'new_status' => $request->validated('status'),
            'reason' => $request->validated('reason'),
        ]);

        if ($request->validated('status') === 'suspended') {
            $organization->users()->each(fn ($user) => $user->tokens()->delete());
        }

        return response()->json([
            'message' => $request->validated('status') === 'suspended'
                ? 'Organization suspended successfully.'
                : 'Organization reactivated successfully.',
            ...$platform->organization($organization->refresh()),
        ]);
    }

    public function updateWorkspace(
        UpdateOrganizationWorkspaceRequest $request,
        Organization $organization,
        WorkspaceSettingsService $workspaceSettings,
        PlatformAdminService $platform
    ): JsonResponse {
        if ($request->has('name')) {
            $organization->update(['name' => $request->validated('name')]);
        }

        $settings = [];

        if ($request->has('support_email')) {
            $settings['identity']['support_email'] = $request->validated('support_email');
        }

        if ($request->has('timezone')) {
            $settings['localization']['timezone'] = $request->validated('timezone');
        }

        if ($settings !== []) {
            $workspaceSettings->update($organization, $settings);
        }

        return response()->json([
            'message' => "Workspace identity updated for {$organization->name}.",
            ...$platform->organization($organization->refresh()),
        ]);
    }

    public function updateModule(
        UpdateOrganizationModuleRequest $request,
        Organization $organization,
        PlatformModule $platformModule,
        PlatformAdminService $platform
    ): JsonResponse {
        $status = $request->validated('status');

        $subscription = $organization->moduleSubscriptions()->firstOrNew([
            'platform_module_id' => $platformModule->id,
        ]);

        $subscription->status = $status;
        $subscription->starts_at ??= now();
        $subscription->settings ??= [];

        $subscription->expires_at = match ($request->validated('duration')) {
            'one_year' => now()->addYear(),
            'custom' => $request->validated('expires_at'),
            default => null,
        };

        $subscription->save();

        return response()->json([
            'message' => $status === 'suspended'
                ? "{$platformModule->name} disabled for {$organization->name}."
                : "{$platformModule->name} enabled for {$organization->name}.",
            ...$platform->organization($organization->refresh()),
        ]);
    }

    public function store(
        ProvisionOrganizationRequest $request,
        OrganizationProvisioningService $provisioning
    ): JsonResponse {
        $result = $provisioning->provision(
            $request->user(),
            $request->validated('organization'),
            $request->validated('admin'),
            $request->validated('modules'),
            $request->validated('workspace', [])
        );

        return response()->json([
            'organization' => new OrganizationResource($result['organization']),
            'main_location' => [
                'id' => $result['location']->id,
                'code' => $result['location']->code,
                'name' => $result['location']->name,
                'type' => $result['location']->type,
                'is_primary' => $result['location']->is_primary,
            ],
            'admin' => new UserResource($result['admin']),
            'modules' => $result['modules']->map(fn ($module) => [
                'id' => $module->id,
                'key' => $module->key,
                'name' => $module->name,
                'category' => $module->category,
            ])->values(),
            'workspace' => $result['workspace'],
            'invitation' => $result['invitation'],
            'created_by' => $result['created_by'],
        ], 201);
    }
}
