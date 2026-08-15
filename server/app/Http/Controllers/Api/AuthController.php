<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\ModuleEntitlementService;
use App\Services\WorkspaceSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace): JsonResponse
    {
        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
        ]);

        $token = $user->createToken(
            $request->string('device_name', 'api')->toString()
        )->plainTextToken;

        return response()->json($this->authPayload($user, $token, $modules, $workspace), 201);
    }

    public function login(LoginRequest $request, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace): JsonResponse
    {
        $user = User::query()
            ->with('organization')
            ->where('email', $request->string('email')->toString())
            ->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->organization?->status === 'suspended') {
            throw ValidationException::withMessages([
                'email' => ['This organization has been suspended. Please contact Valtireo support.'],
            ]);
        }

        $token = $user->createToken(
            $request->string('device_name', 'api')->toString()
        )->plainTextToken;

        return response()->json($this->authPayload($user, $token, $modules, $workspace));
    }

    public function me(Request $request, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace): JsonResponse
    {
        return response()->json($this->sessionPayload($request->user(), $modules, $workspace));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function authPayload(User $user, string $token, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace): array
    {
        return [
            'token' => $token,
            'token_type' => 'Bearer',
            ...$this->sessionPayload($user, $modules, $workspace),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionPayload(User $user, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace): array
    {
        $user->loadMissing('organization', 'roles', 'permissions');

        return [
            'user' => new UserResource($user),
            'organization' => $user->organization ? new OrganizationResource($user->organization) : null,
            'workspace' => $user->organization ? $workspace->forOrganization($user->organization) : null,
            'roles' => $user->getRoleNames()->values(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'modules' => $modules->forUser($user),
        ];
    }
}
