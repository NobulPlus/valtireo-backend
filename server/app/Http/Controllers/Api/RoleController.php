<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Roles\StoreRoleRequest;
use App\Http\Requests\Roles\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Services\RoleManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RoleController extends Controller
{
    public function index(Request $request, RoleManagementService $roles): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('roles.view'), 403);

        return RoleResource::collection($roles->listFor($request->user()));
    }

    public function store(StoreRoleRequest $request, RoleManagementService $roles): JsonResponse
    {
        $role = $roles->create($request->user(), $request->validated());

        return response()->json([
            'role' => new RoleResource($role->loadCount('users')),
        ], 201);
    }

    public function update(UpdateRoleRequest $request, Role $role, RoleManagementService $roles): JsonResponse
    {
        $role = $roles->update($request->user(), $role, $request->validated());

        return response()->json([
            'role' => new RoleResource($role->loadCount('users')),
        ]);
    }

    public function destroy(Request $request, Role $role, RoleManagementService $roles): JsonResponse
    {
        abort_unless($request->user()->can('roles.delete'), 403);

        $roles->delete($request->user(), $role);

        return response()->json(['message' => 'Role deleted.']);
    }
}
