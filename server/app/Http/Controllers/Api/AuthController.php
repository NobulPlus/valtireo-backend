<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\PasswordResetCodeNotification;
use App\Services\DashboardService;
use App\Services\ModuleEntitlementService;
use App\Services\OrganizationVerificationService;
use App\Services\WorkspaceSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace, DashboardService $dashboard): JsonResponse
    {
        abort_unless(config('auth.public_registration'), 403, 'Public registration is disabled. Valtireo workspaces are created by platform admins.');

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
        ]);

        $token = $user->createToken(
            $request->string('device_name', 'api')->toString()
        )->plainTextToken;

        return response()->json($this->authPayload($user, $token, $modules, $workspace, $dashboard), 201);
    }

    public function login(LoginRequest $request, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace, DashboardService $dashboard): JsonResponse
    {
        $user = User::query()
            ->with('organization')
            ->where('email', $request->string('email')->toString())
            ->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password) || $user->accessIsBlocked()) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (in_array($user->organization?->status, ['suspended', 'rejected'], true)) {
            throw ValidationException::withMessages([
                'email' => ['This organization is not currently allowed to access Valtireo. Please contact Valtireo support.'],
            ]);
        }

        app(PermissionRegistrar::class)->setPermissionsTeamId($user->organization_id);

        if ($user->organization?->status === 'invited' && $user->can('workspace_settings.update')) {
            $previousStatus = $user->organization->status;
            $user->organization->update(['status' => 'setup_in_progress']);
            $user->organization->statusHistories()->create([
                'changed_by_id' => $user->id,
                'previous_status' => $previousStatus,
                'new_status' => 'setup_in_progress',
                'reason' => 'Organization admin accepted the invitation and signed in.',
            ]);
            $user->organization->refresh();
        }

        $token = $user->createToken(
            $request->string('device_name', 'api')->toString()
        )->plainTextToken;

        return response()->json($this->authPayload($user, $token, $modules, $workspace, $dashboard));
    }

    public function acceptOrganizationAdminInvitation(
        Request $request,
        string $token,
        ModuleEntitlementService $modules,
        WorkspaceSettingsService $workspace,
        DashboardService $dashboard
    ): JsonResponse {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        // Locked so two concurrent accepts of the same token can't both pass
        // the check below before either deletes the row — without this, both
        // requests would succeed and mint a token, same as the employee
        // invitation flow guards against via lockForUpdate() on its own row.
        // The closure returns an outcome rather than throwing, so a rollback
        // (which a thrown exception would trigger) never undoes the expired-
        // token cleanup delete below.
        $outcome = DB::transaction(function () use ($data, $token): string {
            $reset = DB::table('password_reset_tokens')->where('email', $data['email'])->lockForUpdate()->first();

            if (! $reset || ! Hash::check($token, $reset->token)) {
                return 'invalid';
            }

            if (Carbon::parse($reset->created_at)->addHours(24)->isPast()) {
                DB::table('password_reset_tokens')->where('email', $data['email'])->delete();

                return 'expired';
            }

            $user = User::query()
                ->with('organization')
                ->where('email', $data['email'])
                ->first();

            if (! $user || ! $user->organization || $user->accessIsBlocked()) {
                return 'unlinked';
            }

            $user->update(['password' => $data['password']]);
            DB::table('password_reset_tokens')->where('email', $data['email'])->delete();

            return 'ok';
        });

        throw_if($outcome === 'invalid', ValidationException::withMessages([
            'token' => ['This invitation link is invalid or has already been used.'],
        ]));
        throw_if($outcome === 'expired', ValidationException::withMessages([
            'token' => ['This invitation link has expired. Ask Valtireo to resend the organization admin invitation.'],
        ]));
        throw_if($outcome === 'unlinked', ValidationException::withMessages([
            'token' => ['This invitation is not linked to an organization admin account.'],
        ]));

        $user = User::query()
            ->with('organization')
            ->where('email', $data['email'])
            ->first();

        app(PermissionRegistrar::class)->setPermissionsTeamId($user->organization_id);

        if ($user->organization->status === 'invited' && $user->can('workspace_settings.update')) {
            $previousStatus = $user->organization->status;
            $user->organization->update(['status' => 'setup_in_progress']);
            $user->organization->statusHistories()->create([
                'changed_by_id' => $user->id,
                'previous_status' => $previousStatus,
                'new_status' => 'setup_in_progress',
                'reason' => 'Organization admin accepted the invitation and set a password.',
            ]);
            $user->organization->refresh();
        }

        $authToken = $user->createToken('organization-admin-invitation')->plainTextToken;

        return response()->json($this->authPayload($user->refresh(), $authToken, $modules, $workspace, $dashboard));
    }

    /**
     * Minutes a password-reset code stays valid — short-lived since it's
     * emailed as a 6-digit code rather than a long opaque link.
     */
    private const RESET_CODE_TTL_MINUTES = 15;

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString();
        $user = User::query()->where('email', $email)->first();

        // Always the same response whether or not the email is registered,
        // so this endpoint can't be used to probe which emails have accounts.
        if ($user && ! $user->accessIsBlocked()) {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($code), 'created_at' => now()],
            );

            $user->notify(new PasswordResetCodeNotification($code, self::RESET_CODE_TTL_MINUTES));
        }

        return response()->json([
            'message' => 'If that email has a Valtireo account, we\'ve sent a password reset code to it.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString();
        $code = $request->string('code')->toString();
        $password = $request->string('password')->toString();

        // Locked for the same reason as acceptOrganizationAdminInvitation()
        // above: without it, two concurrent submits of the same code could
        // both pass validation before either deletes the row.
        $outcome = DB::transaction(function () use ($email, $code, $password): string {
            $reset = DB::table('password_reset_tokens')->where('email', $email)->lockForUpdate()->first();

            if (! $reset || ! Hash::check($code, $reset->token)) {
                return 'invalid';
            }

            if (Carbon::parse($reset->created_at)->addMinutes(self::RESET_CODE_TTL_MINUTES)->isPast()) {
                DB::table('password_reset_tokens')->where('email', $email)->delete();

                return 'expired';
            }

            $user = User::query()->where('email', $email)->first();

            if (! $user || $user->accessIsBlocked()) {
                return 'invalid';
            }

            $user->update(['password' => $password]);
            // A password reset is a credential-recovery event, so every
            // existing session (every device) is signed out, not just this one.
            $user->tokens()->delete();
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return 'ok';
        });

        throw_if(in_array($outcome, ['invalid', 'expired'], true), ValidationException::withMessages([
            'code' => [$outcome === 'expired' ? 'This code has expired. Request a new one.' : 'That code is incorrect or has already been used.'],
        ]));

        return response()->json([
            'message' => 'Your password has been reset. Please sign in again.',
        ]);
    }

    public function me(Request $request, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace, DashboardService $dashboard): JsonResponse
    {
        return response()->json($this->sessionPayload($request->user(), $modules, $workspace, $dashboard));
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
    private function authPayload(User $user, string $token, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace, DashboardService $dashboard): array
    {
        return [
            'token' => $token,
            'token_type' => 'Bearer',
            ...$this->sessionPayload($user, $modules, $workspace, $dashboard),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionPayload(User $user, ModuleEntitlementService $modules, WorkspaceSettingsService $workspace, DashboardService $dashboard): array
    {
        // login/register sit outside the auth:sanctum route group, so
        // SetPermissionsTeamId middleware never runs for them — this call
        // (which loads roles/permissions below) must be self-sufficient
        // rather than trusting middleware wiring at every possible caller.
        app(PermissionRegistrar::class)->setPermissionsTeamId($user->organization_id);

        $user->loadMissing('organization', 'roles', 'permissions', 'employee.profile');

        return [
            'user' => new UserResource($user),
            'organization' => $user->organization ? new OrganizationResource($user->organization) : null,
            'workspace' => $user->organization ? $workspace->forOrganization($user->organization) : null,
            'organization_verification' => $user->organization ? app(OrganizationVerificationService::class)->summary($user->organization) : null,
            'roles' => $user->getRoleNames()->values(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'is_platform_admin' => $user->is_platform_admin,
            'modules' => $modules->forUser($user),
            'has_manager_scope' => $dashboard->hasManagerScope($user),
        ];
    }
}
