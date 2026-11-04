<?php

namespace App\Services;

use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkspace;
use App\Models\OrbitWorkspaceMember;
use App\Models\User;

/**
 * Resolves Orbit's workspace/project membership-role layer — the one real
 * addition this module makes to the permission model. Spatie's org-wide
 * "team" permissions (see RolePermissionSeeder's orbit.* strings) answer
 * "can this user use Orbit at all / create workspaces or projects"; this
 * service answers the question Spatie's teams can't: "what can this
 * specific user do on this specific workspace or project." A plain service
 * class, not a Laravel Policy, matching the rest of this codebase's
 * convention (see EmployeeVisibility) over introducing a pattern nothing
 * else here uses.
 */
class OrbitAuthorizationService
{
    public function workspaceRole(User $user, OrbitWorkspace $workspace): ?string
    {
        return OrbitWorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->value('role');
    }

    public function isWorkspaceMember(User $user, OrbitWorkspace $workspace): bool
    {
        return $this->workspaceRole($user, $workspace) !== null;
    }

    public function isWorkspaceAdmin(User $user, OrbitWorkspace $workspace): bool
    {
        return $this->workspaceRole($user, $workspace) === 'admin' || $user->can('orbit.workspaces.administer');
    }

    public function canViewWorkspace(User $user, OrbitWorkspace $workspace): bool
    {
        if ($workspace->visibility === 'organization') {
            return true;
        }

        return $this->isWorkspaceMember($user, $workspace) || $user->can('orbit.workspaces.administer');
    }

    public function canCreateProjectIn(User $user, OrbitWorkspace $workspace): bool
    {
        if ($this->isWorkspaceAdmin($user, $workspace)) {
            return true;
        }

        return $this->isWorkspaceMember($user, $workspace) && $user->can('orbit.projects.create');
    }

    /**
     * A Workspace Administrator can administer any project in their
     * workspace without a separate orbit_project_members row — this is an
     * administrative-reach override, not membership. It never adds them to
     * a project's member list (see projectRole(), which only ever reads the
     * real membership row for that purpose).
     */
    public function projectRole(User $user, OrbitProject $project): ?string
    {
        $direct = OrbitProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->value('role');

        if ($direct !== null) {
            return $direct;
        }

        return $this->isWorkspaceAdmin($user, $project->workspace) ? 'admin' : null;
    }

    public function isProjectMember(User $user, OrbitProject $project): bool
    {
        return OrbitProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    public function canViewProject(User $user, OrbitProject $project): bool
    {
        if ($project->visibility === 'organization') {
            return true;
        }

        return $this->projectRole($user, $project) !== null;
    }

    public function canAdministerProject(User $user, OrbitProject $project): bool
    {
        return $this->projectRole($user, $project) === 'admin';
    }

    public function canEditWorkItems(User $user, OrbitProject $project): bool
    {
        return in_array($this->projectRole($user, $project), ['admin', 'contributor'], true);
    }

    public function canManageProjectMembers(User $user, OrbitProject $project): bool
    {
        return $this->canAdministerProject($user, $project);
    }
}
