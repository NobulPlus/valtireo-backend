<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitWorkspace;
use App\Models\OrbitWorkspaceMember;
use App\Models\User;
use App\Services\OrbitAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrbitWorkspaceController extends Controller
{
    public function __construct(private readonly OrbitAuthorizationService $auth)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $workspaces = OrbitWorkspace::query()
            ->whereNull('archived_at')
            ->where(function ($query) use ($user) {
                $query->where('visibility', 'organization')
                    ->orWhereHas('memberships', fn ($q) => $q->where('user_id', $user->id));
            })
            ->withCount(['projects' => fn ($q) => $q->whereNull('archived_at'), 'memberships'])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $workspaces]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('orbit.workspaces.create') || $user->can('orbit.workspaces.administer'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'visibility' => ['sometimes', Rule::in(['private', 'organization'])],
        ]);

        $workspace = OrbitWorkspace::create([
            'name' => $data['name'],
            'slug' => $this->uniqueSlug($user->organization_id, $data['name']),
            'description' => $data['description'] ?? null,
            'visibility' => $data['visibility'] ?? 'organization',
            'owner_id' => $user->id,
        ]);

        OrbitWorkspaceMember::create([
            'organization_id' => $user->organization_id,
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'role' => 'admin',
        ]);

        return response()->json(['workspace' => $workspace], 201);
    }

    public function show(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);

        $workspace->loadCount(['projects' => fn ($q) => $q->whereNull('archived_at'), 'memberships']);
        $workspace->viewer_role = $this->auth->workspaceRole($user, $workspace);
        $workspace->can_administer = $this->auth->isWorkspaceAdmin($user, $workspace);

        return response()->json(['workspace' => $workspace]);
    }

    public function update(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);
        abort_unless($this->auth->isWorkspaceAdmin($user, $workspace), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'visibility' => ['sometimes', Rule::in(['private', 'organization'])],
        ]);

        $workspace->update($data);

        return response()->json(['workspace' => $workspace]);
    }

    public function archive(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);
        abort_unless($this->auth->isWorkspaceAdmin($user, $workspace), 403);

        $workspace->projects()->whereNull('archived_at')->update(['archived_at' => now()]);
        $workspace->update(['archived_at' => now()]);

        return response()->json(['workspace' => $workspace]);
    }

    public function restore(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->isWorkspaceAdmin($user, $workspace), 403);

        $workspace->update(['archived_at' => null]);

        return response()->json(['workspace' => $workspace]);
    }

    public function members(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        abort_unless($this->auth->canViewWorkspace($request->user(), $workspace), 404);

        $members = $workspace->members()->orderByPivot('created_at', 'desc')->get(['users.id', 'users.name', 'users.email'])
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'role' => $member->pivot->role,
            ]);

        return response()->json(['data' => $members]);
    }

    /**
     * Organization-colleague search for the workspace/project member
     * pickers — deliberately independent of Connect's own `/connect/people`
     * (which is gated behind the Connect module subscription and would
     * break member-adding for an org subscribed to Orbit but not Connect).
     */
    public function people(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        $people = User::query()
            ->where('organization_id', $user->organization_id)
            ->whereKeyNot($user->id)
            ->whereHas('employee', fn ($query) => $query->where('organization_id', $user->organization_id)->where('status', 'active'))
            ->when($data['search'] ?? null, fn ($query, $search) => $query->where('name', 'like', '%'.$search.'%'))
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'email']);

        return response()->json(['data' => $people]);
    }

    public function addMember(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);
        abort_unless($this->auth->isWorkspaceAdmin($user, $workspace), 403);

        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'role' => [Rule::in(['admin', 'member'])],
        ]);

        $member = User::query()->where('organization_id', $user->organization_id)->findOrFail($data['user_id']);

        $membership = OrbitWorkspaceMember::query()->updateOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $member->id],
            ['organization_id' => $user->organization_id, 'role' => $data['role'] ?? 'member']
        );

        return response()->json(['membership' => $membership], 201);
    }

    public function updateMember(Request $request, OrbitWorkspace $workspace, User $member): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);
        abort_unless($this->auth->isWorkspaceAdmin($user, $workspace), 403);
        abort_unless($member->organization_id === $user->organization_id, 404);

        $data = $request->validate(['role' => ['required', Rule::in(['admin', 'member'])]]);

        $membership = OrbitWorkspaceMember::query()->where('workspace_id', $workspace->id)->where('user_id', $member->id)->firstOrFail();

        if ($data['role'] !== 'admin') {
            $this->guardAgainstLastAdminRemoval($workspace, $membership->id);
        }

        $membership->update(['role' => $data['role']]);

        return response()->json(['membership' => $membership]);
    }

    public function removeMember(Request $request, OrbitWorkspace $workspace, User $member): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);
        abort_unless($this->auth->isWorkspaceAdmin($user, $workspace), 403);

        $membership = OrbitWorkspaceMember::query()->where('workspace_id', $workspace->id)->where('user_id', $member->id)->firstOrFail();
        $this->guardAgainstLastAdminRemoval($workspace, $membership->id);
        $membership->delete();

        return response()->json(['message' => 'Member removed.']);
    }

    private function guardAgainstLastAdminRemoval(OrbitWorkspace $workspace, int $excludingMembershipId): void
    {
        $remainingAdmins = OrbitWorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('role', 'admin')
            ->where('id', '!=', $excludingMembershipId)
            ->count();

        abort_if($remainingAdmins === 0, 422, 'A workspace must always have at least one administrator.');
    }

    private function uniqueSlug(int $organizationId, string $name): string
    {
        $base = Str::slug($name) ?: 'workspace';
        $slug = $base;
        $suffix = 1;

        while (OrbitWorkspace::withoutGlobalScopes()->where('organization_id', $organizationId)->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
