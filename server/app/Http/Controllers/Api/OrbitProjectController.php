<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitStatus;
use App\Models\OrbitWorkspace;
use App\Models\User;
use App\Services\OrbitAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrbitProjectController extends Controller
{
    public function __construct(private readonly OrbitAuthorizationService $auth)
    {
    }

    public function index(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);

        $projects = $workspace->projects()
            ->whereNull('archived_at')
            ->where(function ($query) use ($user) {
                $query->where('visibility', 'organization')
                    ->orWhereHas('memberships', fn ($q) => $q->where('user_id', $user->id));
            })
            ->withCount(['workItems' => fn ($q) => $q->whereNull('archived_at')])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $projects]);
    }

    public function store(Request $request, OrbitWorkspace $workspace): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewWorkspace($user, $workspace), 404);
        abort_unless($this->auth->canCreateProjectIn($user, $workspace), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'key_prefix' => ['required', 'string', 'max:10', 'alpha', 'uppercase'],
            'description' => ['nullable', 'string'],
            'mode' => ['required', Rule::in(['kanban', 'scrum', 'simple'])],
            'visibility' => ['sometimes', Rule::in(['private', 'organization'])],
        ]);

        abort_if(
            OrbitProject::query()->where('organization_id', $user->organization_id)->where('key_prefix', $data['key_prefix'])->exists(),
            422,
            "The key \"{$data['key_prefix']}\" is already used by another project in this organization. Choose a different one."
        );

        $project = OrbitProject::create([
            'organization_id' => $user->organization_id,
            'workspace_id' => $workspace->id,
            'name' => $data['name'],
            'key_prefix' => $data['key_prefix'],
            'description' => $data['description'] ?? null,
            'mode' => $data['mode'],
            'visibility' => $data['visibility'] ?? 'organization',
        ]);

        foreach ([
            ['name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true],
            ['name' => 'In Progress', 'category' => 'in_progress', 'position' => 2, 'is_default' => false],
            ['name' => 'Done', 'category' => 'done', 'position' => 3, 'is_default' => false],
        ] as $status) {
            OrbitStatus::create([...$status, 'project_id' => $project->id]);
        }

        OrbitProjectMember::create([
            'organization_id' => $user->organization_id,
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => 'admin',
        ]);

        return response()->json(['project' => $project->load('statuses')], 201);
    }

    public function show(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);

        $project->load('statuses', 'labels', 'workspace:id,name');
        $project->loadCount(['workItems' => fn ($q) => $q->whereNull('archived_at')]);
        $project->overdue_count = $project->workItems()
            ->whereNull('archived_at')
            ->whereNotNull('due_at')
            ->where('due_at', '<', now()->toDateString())
            ->whereHas('status', fn ($q) => $q->where('category', '!=', 'done'))
            ->count();
        $project->viewer_role = $this->auth->projectRole($user, $project);
        $project->can_administer = $this->auth->canAdministerProject($user, $project);
        $project->can_edit_work_items = $this->auth->canEditWorkItems($user, $project);

        return response()->json(['project' => $project]);
    }

    public function update(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'visibility' => ['sometimes', Rule::in(['private', 'organization'])],
        ]);

        $project->update($data);

        return response()->json(['project' => $project]);
    }

    public function archive(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);

        $project->update(['archived_at' => now()]);

        return response()->json(['project' => $project]);
    }

    public function restore(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canAdministerProject($user, $project), 403);

        $project->update(['archived_at' => null]);

        return response()->json(['project' => $project]);
    }

    public function members(Request $request, OrbitProject $project): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $project), 404);

        $members = $project->members()->orderByPivot('created_at', 'desc')->get(['users.id', 'users.name', 'users.email'])
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'role' => $member->pivot->role,
            ]);

        return response()->json(['data' => $members]);
    }

    public function addMember(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canManageProjectMembers($user, $project), 403);

        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'role' => [Rule::in(['admin', 'contributor', 'viewer'])],
        ]);

        $member = User::query()->where('organization_id', $user->organization_id)->findOrFail($data['user_id']);

        $membership = OrbitProjectMember::query()->updateOrCreate(
            ['project_id' => $project->id, 'user_id' => $member->id],
            ['organization_id' => $user->organization_id, 'role' => $data['role'] ?? 'contributor']
        );

        return response()->json(['membership' => $membership], 201);
    }

    public function updateMember(Request $request, OrbitProject $project, User $member): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canManageProjectMembers($user, $project), 403);
        abort_unless($member->organization_id === $user->organization_id, 404);

        $data = $request->validate(['role' => ['required', Rule::in(['admin', 'contributor', 'viewer'])]]);

        $membership = OrbitProjectMember::query()->where('project_id', $project->id)->where('user_id', $member->id)->firstOrFail();

        if ($data['role'] !== 'admin') {
            $this->guardAgainstLastAdminRemoval($project, $membership->id);
        }

        $membership->update(['role' => $data['role']]);

        return response()->json(['membership' => $membership]);
    }

    public function removeMember(Request $request, OrbitProject $project, User $member): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canManageProjectMembers($user, $project), 403);

        $membership = OrbitProjectMember::query()->where('project_id', $project->id)->where('user_id', $member->id)->firstOrFail();
        $this->guardAgainstLastAdminRemoval($project, $membership->id);
        $membership->delete();

        return response()->json(['message' => 'Member removed.']);
    }

    public function statuses(Request $request, OrbitProject $project): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $project), 404);

        return response()->json(['data' => $project->statuses]);
    }

    public function storeStatus(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(['todo', 'in_progress', 'done'])],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);

        $status = OrbitStatus::create([
            'project_id' => $project->id,
            'name' => $data['name'],
            'category' => $data['category'],
            'position' => $data['position'] ?? ($project->statuses()->max('position') + 1),
        ]);

        return response()->json(['status' => $status], 201);
    }

    public function updateStatus(Request $request, OrbitProject $project, OrbitStatus $status): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);
        abort_unless($status->project_id === $project->id, 404);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', Rule::in(['todo', 'in_progress', 'done'])],
            'position' => ['sometimes', 'integer', 'min:0'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $status->update($data);

        return response()->json(['status' => $status]);
    }

    public function destroyStatus(Request $request, OrbitProject $project, OrbitStatus $status): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);
        abort_unless($status->project_id === $project->id, 404);

        abort_if($status->workItems()->exists(), 422, 'This column still has work items on it. Move them first.');

        $status->delete();

        return response()->json(['message' => 'Column removed.']);
    }

    private function guardAgainstLastAdminRemoval(OrbitProject $project, int $excludingMembershipId): void
    {
        $remainingAdmins = OrbitProjectMember::query()
            ->where('project_id', $project->id)
            ->where('role', 'admin')
            ->where('id', '!=', $excludingMembershipId)
            ->count();

        abort_if($remainingAdmins === 0, 422, 'A project must always have at least one administrator.');
    }
}
