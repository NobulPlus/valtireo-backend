<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitIteration;
use App\Models\OrbitIterationCarryover;
use App\Models\OrbitProject;
use App\Services\OrbitAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrbitIterationController extends Controller
{
    public function __construct(private readonly OrbitAuthorizationService $auth)
    {
    }

    public function index(Request $request, OrbitProject $project): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $project), 404);
        $this->assertScrumProject($project);

        $iterations = $project->iterations()
            ->withCount('workItems')
            ->orderBy('starts_at')
            ->get();

        return response()->json(['data' => $iterations]);
    }

    public function store(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);
        $this->assertScrumProject($project);
        abort_unless($project->mode === 'scrum', 422, 'Sprints are only available on Scrum projects.');

        $data = $this->validatePlan($request);

        $iteration = $project->iterations()->create([
            ...$data,
            'status' => 'planned',
        ]);

        return response()->json(['iteration' => $iteration], 201);
    }

    public function show(Request $request, OrbitIteration $iteration): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $iteration->project), 404);
        $this->assertScrumProject($iteration->project);

        $iteration->load(['workItems.status', 'workItems.assignee:id,name', 'workItems.labels']);
        $iteration->loadCount('workItems');

        return response()->json(['iteration' => $iteration]);
    }

    public function update(Request $request, OrbitIteration $iteration): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $iteration->project), 404);
        abort_unless($this->auth->canAdministerProject($user, $iteration->project), 403);
        $this->assertScrumProject($iteration->project);
        abort_if($iteration->status === 'completed', 422, 'A completed sprint cannot be edited.');

        $data = $this->validatePlan($request, sometimes: true);

        $iteration->update($data);

        return response()->json(['iteration' => $iteration]);
    }

    public function start(Request $request, OrbitIteration $iteration): JsonResponse
    {
        $user = $request->user();
        $project = $iteration->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);
        $this->assertScrumProject($project);
        abort_unless($iteration->status === 'planned', 422, 'Only a planned sprint can be started.');

        abort_if(
            $project->iterations()->where('status', 'active')->where('id', '!=', $iteration->id)->exists(),
            422,
            'This project already has an active sprint. Complete it before starting another.'
        );

        $iteration->update(['status' => 'active', 'started_at' => now()]);

        return response()->json(['iteration' => $iteration]);
    }

    public function complete(Request $request, OrbitIteration $iteration): JsonResponse
    {
        $user = $request->user();
        $project = $iteration->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);
        $this->assertScrumProject($project);
        abort_unless($iteration->status === 'active', 422, 'Only an active sprint can be completed.');

        $data = $request->validate([
            'carry_to_iteration_id' => ['nullable', 'integer'],
        ]);

        $target = null;
        if (! empty($data['carry_to_iteration_id'])) {
            $target = $project->iterations()->where('status', 'planned')->find($data['carry_to_iteration_id']);
            abort_unless($target, 422, 'The sprint to carry items into must be a planned sprint in the same project.');
        }

        $unfinished = $iteration->workItems()->whereHas('status', fn ($q) => $q->where('category', '!=', 'done'))->get();

        foreach ($unfinished as $item) {
            OrbitIterationCarryover::create([
                'from_iteration_id' => $iteration->id,
                'to_iteration_id' => $target?->id,
                'work_item_id' => $item->id,
                'carried_by_id' => $user->id,
            ]);

            $item->update(['iteration_id' => $target?->id]);
        }

        $iteration->update(['status' => 'completed', 'completed_at' => now()]);

        return response()->json(['iteration' => $iteration]);
    }

    public function destroy(Request $request, OrbitIteration $iteration): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $iteration->project), 404);
        abort_unless($this->auth->canAdministerProject($user, $iteration->project), 403);
        $this->assertScrumProject($iteration->project);
        abort_unless($iteration->status === 'planned', 422, 'Only a planned sprint can be deleted.');

        $iteration->delete();

        return response()->json(['message' => 'Sprint removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePlan(Request $request, bool $sometimes = false): array
    {
        $required = $sometimes ? 'sometimes' : 'required';

        $data = $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'goal' => ['nullable', 'string'],
            'starts_at' => [$required, 'date'],
            'ends_at' => [$required, 'date'],
            'capacity_note' => ['nullable', 'string', 'max:255'],
            'capacity_points' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (isset($data['starts_at'], $data['ends_at'])) {
            abort_if($data['ends_at'] < $data['starts_at'], 422, 'A sprint cannot end before it starts.');
        }

        return $data;
    }

    private function assertScrumProject(OrbitProject $project): void
    {
        abort_unless($project->mode === 'scrum', 422, 'Iterations are only available on Scrum projects.');
    }
}
