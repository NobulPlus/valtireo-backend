<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitLabel;
use App\Models\OrbitProject;
use App\Services\OrbitAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrbitLabelController extends Controller
{
    public function __construct(private readonly OrbitAuthorizationService $auth)
    {
    }

    public function index(Request $request, OrbitProject $project): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $project), 404);

        return response()->json(['data' => $project->labels()->orderBy('name')->get()]);
    }

    public function store(Request $request, OrbitProject $project): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('orbit_labels', 'name')->where('project_id', $project->id)],
            'color' => ['required', 'string', 'max:20'],
        ]);

        $label = OrbitLabel::create(['project_id' => $project->id, 'name' => $data['name'], 'color' => $data['color']]);

        return response()->json(['label' => $label], 201);
    }

    public function update(Request $request, OrbitProject $project, OrbitLabel $label): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);
        abort_unless($label->project_id === $project->id, 404);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('orbit_labels', 'name')->where('project_id', $project->id)->ignore($label->id)],
            'color' => ['sometimes', 'string', 'max:20'],
        ]);

        $label->update($data);

        return response()->json(['label' => $label]);
    }

    public function destroy(Request $request, OrbitProject $project, OrbitLabel $label): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canAdministerProject($user, $project), 403);
        abort_unless($label->project_id === $project->id, 404);

        $label->delete();

        return response()->json(['message' => 'Label removed.']);
    }
}
