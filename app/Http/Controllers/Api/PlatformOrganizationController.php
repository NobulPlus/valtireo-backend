<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ProvisionOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\UserResource;
use App\Services\OrganizationProvisioningService;
use Illuminate\Http\JsonResponse;

class PlatformOrganizationController extends Controller
{
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
