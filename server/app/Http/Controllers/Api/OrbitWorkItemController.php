<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitProject;
use App\Models\OrbitStatus;
use App\Models\OrbitWorkItem;
use App\Models\User;
use App\Services\NotificationDispatchService;
use App\Services\OrbitAuthorizationService;
use App\Services\OrbitBoardOrderingService;
use App\Services\OrbitWorkItemActivityService;
use App\Services\OrbitWorkItemKeyGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrbitWorkItemController extends Controller
{
    public function __construct(
        private readonly OrbitAuthorizationService $auth,
        private readonly OrbitWorkItemKeyGenerator $keys,
        private readonly OrbitBoardOrderingService $ordering,
        private readonly OrbitWorkItemActivityService $activity,
        private readonly NotificationDispatchService $notifications,
    ) {
    }

    public function index(Request $request, OrbitProject $project): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $project), 404);

        $items = $project->workItems()
            ->with(['status', 'assignee:id,name', 'reporter:id,name', 'labels', 'epic:id,key,title'])
            ->whereNull('archived_at')
            ->when($request->integer('status_id'), fn ($q, $value) => $q->where('status_id', $value))
            ->when($request->integer('assignee_id'), fn ($q, $value) => $q->where('assignee_id', $value))
            ->when($request->string('type')->toString(), fn ($q, $value) => $q->where('type', $value))
            ->when($request->integer('label_id'), fn ($q, $value) => $q->whereHas('labels', fn ($lq) => $lq->where('orbit_labels.id', $value)))
            ->when($request->integer('epic_id'), fn ($q, $value) => $q->where('epic_id', $value))
            ->when($request->integer('iteration_id'), fn ($q, $value) => $q->where('iteration_id', $value))
            ->when($request->string('due_before')->toString(), fn ($q, $value) => $q->whereNotNull('due_at')->where('due_at', '<=', $value))
            ->orderBy('position')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);

        $data = $request->validate([
            'type' => ['required', Rule::in(['epic', 'story', 'bug', 'task', 'subtask'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status_id' => ['sometimes', 'integer'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'assignee_id' => ['nullable', 'integer'],
            'parent_id' => ['nullable', 'integer'],
            'epic_id' => ['nullable', 'integer'],
            'story_template' => ['nullable', 'array'],
            'acceptance_criteria' => ['nullable', 'string'],
            'estimate' => ['nullable', 'numeric', 'min:0'],
            'due_at' => ['nullable', 'date'],
            'start_at' => ['nullable', 'date'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['integer'],
        ]);

        $status = isset($data['status_id'])
            ? $project->statuses()->findOrFail($data['status_id'])
            : $project->statuses()->where('is_default', true)->first() ?? $project->statuses()->orderBy('position')->first();

        abort_unless($status, 422, 'This project has no board columns configured.');

        if (! empty($data['assignee_id'])) {
            User::query()->where('organization_id', $user->organization_id)->findOrFail($data['assignee_id']);
        }

        if (! empty($data['parent_id'])) {
            $project->workItems()->findOrFail($data['parent_id']);
        }

        if (! empty($data['epic_id'])) {
            $project->workItems()->where('type', 'epic')->findOrFail($data['epic_id']);
        }

        $key = $this->keys->next($project);

        $item = OrbitWorkItem::create([
            'organization_id' => $user->organization_id,
            'project_id' => $project->id,
            'key' => $key,
            'type' => $data['type'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'status_id' => $status->id,
            'priority' => $data['priority'] ?? 'medium',
            'reporter_id' => $user->id,
            'assignee_id' => $data['assignee_id'] ?? null,
            'parent_id' => $data['parent_id'] ?? null,
            'epic_id' => $data['epic_id'] ?? null,
            'story_template' => $data['story_template'] ?? null,
            'acceptance_criteria' => $data['acceptance_criteria'] ?? null,
            'estimate' => $data['estimate'] ?? null,
            'remaining_estimate' => $data['estimate'] ?? null,
            'due_at' => $data['due_at'] ?? null,
            'start_at' => $data['start_at'] ?? null,
            'position' => $this->ordering->nextPosition($status->id),
        ]);

        if (! empty($data['label_ids'])) {
            $validLabelIds = $project->labels()->whereIn('id', $data['label_ids'])->pluck('id');
            $item->labels()->sync($validLabelIds);
        }

        $this->activity->record($item, $user, 'created', "{$user->name} created this item.");

        if ($item->assignee_id) {
            $this->notifications->orbitWorkItemAssigned($item);
        }

        return response()->json(['work_item' => $item->load('status', 'assignee:id,name', 'labels')], 201);
    }

    public function show(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $workItem->project), 404);

        $workItem->load([
            'status', 'assignee:id,name', 'reporter:id,name', 'labels',
            'parent:id,key,title', 'epic:id,key,title', 'project:id,name,key_prefix,mode',
            'attachments' => fn ($query) => $query->whereNull('deleted_at')->with('uploadedBy:id,name'),
        ]);

        return response()->json(['work_item' => $workItem]);
    }

    public function update(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        $project = $workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);

        $data = $request->validate([
            'version' => ['required', 'integer'],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'assignee_id' => ['nullable', 'integer'],
            'epic_id' => ['nullable', 'integer'],
            'acceptance_criteria' => ['nullable', 'string'],
            'definition_of_done' => ['nullable', 'string'],
            'estimate' => ['nullable', 'numeric', 'min:0'],
            'remaining_estimate' => ['nullable', 'numeric', 'min:0'],
            'due_at' => ['nullable', 'date'],
            'start_at' => ['nullable', 'date'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['integer'],
        ]);

        $this->assertVersion($workItem, $data['version']);

        $previousAssignee = $workItem->assignee_id;
        $previousPriority = $workItem->priority;

        if (! empty($data['assignee_id'])) {
            User::query()->where('organization_id', $user->organization_id)->findOrFail($data['assignee_id']);
        }

        $update = array_diff_key($data, ['version' => null, 'label_ids' => null]);
        $update['version'] = $workItem->version + 1;
        $workItem->update($update);

        if (array_key_exists('label_ids', $data)) {
            $validLabelIds = $project->labels()->whereIn('id', $data['label_ids'])->pluck('id');
            $workItem->labels()->sync($validLabelIds);
        }

        if (array_key_exists('assignee_id', $data) && $data['assignee_id'] !== $previousAssignee) {
            $this->activity->record($workItem, $user, 'assigned', "{$user->name} changed the assignee.", ['assignee_id' => $previousAssignee], ['assignee_id' => $workItem->assignee_id]);

            if ($workItem->assignee_id) {
                $this->notifications->orbitWorkItemAssigned($workItem);
            }
        }

        if (array_key_exists('priority', $data) && $data['priority'] !== $previousPriority) {
            $this->activity->record($workItem, $user, 'priority_changed', "{$user->name} changed the priority.", ['priority' => $previousPriority], ['priority' => $workItem->priority]);
        }

        return response()->json(['work_item' => $workItem->fresh(['status', 'assignee:id,name', 'labels'])]);
    }

    public function move(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        $project = $workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);

        $data = $request->validate([
            'status_id' => ['required', 'integer'],
            'position' => ['required', 'numeric'],
            'version' => ['required', 'integer'],
        ]);

        $this->assertVersion($workItem, $data['version']);

        $newStatus = $project->statuses()->findOrFail($data['status_id']);
        $previousStatusId = $workItem->status_id;

        $workItem->update([
            'status_id' => $newStatus->id,
            'position' => $data['position'],
            'version' => $workItem->version + 1,
            'started_at' => $workItem->started_at ?? ($newStatus->category === 'in_progress' ? now() : null),
            'completed_at' => $newStatus->category === 'done' ? ($workItem->completed_at ?? now()) : null,
        ]);

        if ($previousStatusId !== $newStatus->id) {
            $this->activity->record(
                $workItem,
                $user,
                'moved',
                "{$user->name} moved this item to {$newStatus->name}.",
                ['status_id' => $previousStatusId],
                ['status_id' => $newStatus->id]
            );

            $this->notifications->orbitWorkItemStatusChanged($workItem, $user);
        } else {
            $this->activity->record(
                $workItem,
                $user,
                'reordered',
                "{$user->name} reordered this item within {$newStatus->name}.",
            );
        }

        return response()->json(['work_item' => $workItem->fresh('status')]);
    }

    public function archive(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        $project = $workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);

        $workItem->update(['archived_at' => now()]);
        $this->activity->record($workItem, $user, 'archived', "{$user->name} archived this item.");

        return response()->json(['work_item' => $workItem]);
    }

    public function watch(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $workItem->project), 404);

        $workItem->watchers()->syncWithoutDetaching([$user->id]);

        return response()->json(['message' => 'Watching.']);
    }

    public function unwatch(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $workItem->project), 404);

        $workItem->watchers()->detach($user->id);

        return response()->json(['message' => 'No longer watching.']);
    }

    private function assertVersion(OrbitWorkItem $workItem, int $version): void
    {
        if ($workItem->version !== $version) {
            abort(409, 'This work item was changed by someone else. Refresh and try again.');
        }
    }
}
