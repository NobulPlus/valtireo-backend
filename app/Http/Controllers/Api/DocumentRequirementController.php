<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Documents\StoreDocumentRequirementRequest;
use App\Http\Resources\DocumentRequirementResource;
use App\Models\DocumentRequirement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DocumentRequirementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('employee_documents.view'), 403);

        $requirements = DocumentRequirement::query()
            ->with(['documentType', 'department', 'designation', 'gradeLevel', 'employmentType', 'location'])
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->integer('document_type_id'), fn ($query, int $id) => $query->where('document_type_id', $id))
            ->when($request->integer('department_id'), fn ($query, int $id) => $query->where('department_id', $id))
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return DocumentRequirementResource::collection($requirements);
    }

    public function store(StoreDocumentRequirementRequest $request): DocumentRequirementResource
    {
        $requirement = DocumentRequirement::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return new DocumentRequirementResource($requirement->load(['documentType', 'department', 'designation', 'gradeLevel', 'employmentType', 'location']));
    }

    public function show(Request $request, DocumentRequirement $documentRequirement): DocumentRequirementResource
    {
        abort_unless($request->user()->can('employee_documents.view'), 403);
        abort_unless($documentRequirement->organization_id === $request->user()->organization_id, 404);

        return new DocumentRequirementResource($documentRequirement->load(['documentType', 'department', 'designation', 'gradeLevel', 'employmentType', 'location']));
    }
}
