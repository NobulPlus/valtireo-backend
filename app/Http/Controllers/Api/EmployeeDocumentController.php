<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Documents\ReviewEmployeeDocumentRequest;
use App\Http\Requests\Documents\SubmitEmployeeDocumentRequest;
use App\Http\Resources\EmployeeDocumentResource;
use App\Models\EmployeeDocument;
use App\Services\DocumentComplianceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeDocumentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('employee_documents.view'), 403);

        $documents = EmployeeDocument::query()
            ->with(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy'])
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->integer('document_type_id'), fn (Builder $query, int $id) => $query->where('document_type_id', $id))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->date('expires_from'), fn (Builder $query, $date) => $query->whereDate('expires_at', '>=', $date->toDateString()))
            ->when($request->date('expires_to'), fn (Builder $query, $date) => $query->whereDate('expires_at', '<=', $date->toDateString()))
            ->latest('id')
            ->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return EmployeeDocumentResource::collection($documents);
    }

    public function store(SubmitEmployeeDocumentRequest $request, DocumentComplianceService $documents): JsonResponse
    {
        $document = $documents->submit($request->user(), $request->validated());

        return response()->json([
            'document' => new EmployeeDocumentResource($document),
        ], 201);
    }

    public function show(Request $request, EmployeeDocument $employeeDocument): EmployeeDocumentResource
    {
        abort_unless($request->user()->can('employee_documents.view'), 403);
        abort_unless($employeeDocument->organization_id === $request->user()->organization_id, 404);

        return new EmployeeDocumentResource($employeeDocument->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy']));
    }

    public function review(
        ReviewEmployeeDocumentRequest $request,
        EmployeeDocument $employeeDocument,
        DocumentComplianceService $documents
    ): JsonResponse {
        $document = $documents->review(
            $request->user(),
            $employeeDocument,
            $request->string('action')->toString(),
            $request->string('note')->toString() ?: null
        );

        return response()->json([
            'document' => new EmployeeDocumentResource($document),
        ]);
    }

    public function compliance(Request $request, DocumentComplianceService $documents): JsonResponse
    {
        abort_unless($request->user()->can('employee_documents.view'), 403);

        return response()->json($documents->compliance($request->user(), [
            'department_id' => $request->integer('department_id') ?: null,
            'employment_type_id' => $request->integer('employment_type_id') ?: null,
            'organization_location_id' => $request->integer('organization_location_id') ?: null,
        ]));
    }
}
