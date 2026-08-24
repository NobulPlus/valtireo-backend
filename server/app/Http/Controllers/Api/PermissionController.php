<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\UpdatePermissionRequest;
use App\Http\Resources\PermissionResource;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PermissionController extends Controller
{
    /**
     * The global permission catalog — open to any user who can create or
     * update roles, since they need it to power their own organization's
     * role permission-picker.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless(
            $request->user()->is_platform_admin
                || $request->user()->can('roles.create')
                || $request->user()->can('roles.update'),
            403
        );

        $permissions = Permission::query()
            ->orderBy('group')
            ->orderBy('name')
            ->get();

        return PermissionResource::collection($permissions);
    }

    public function update(UpdatePermissionRequest $request, Permission $permission): JsonResponse
    {
        $permission->update($request->validated());

        return response()->json([
            'permission' => new PermissionResource($permission),
        ]);
    }
}
