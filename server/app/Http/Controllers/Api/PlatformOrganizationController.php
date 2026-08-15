<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ProvisionOrganizationRequest;
use App\Http\Requests\Platform\UpdateOrganizationStatusRequest;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Services\OrganizationProvisioningService;
use App\Services\PlatformAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlatformOrganizationController extends Controller
{
    public function dashboard(Request $request, PlatformAdminService $platform): JsonResponse
    {
        abort_unless($request->user()->hasRole('Super Admin'), 403);

        return response()->json($platform->dashboard($request));
    }

    public function index(Request $request, PlatformAdminService $platform): JsonResponse
    {
        abort_unless($request->user()->hasRole('Super Admin'), 403);

        return response()->json($platform->organizations($request));
    }

    public function export(Request $request, PlatformAdminService $platform): StreamedResponse
    {
        abort_unless($request->user()->hasRole('Super Admin'), 403);

        return $platform->exportOrganizations($request);
    }

    public function show(
        Request $request,
        Organization $organization,
        PlatformAdminService $platform
    ): JsonResponse {
        abort_unless($request->user()->hasRole('Super Admin'), 403);

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

        $organization->update([
            'status' => $request->validated('status'),
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
