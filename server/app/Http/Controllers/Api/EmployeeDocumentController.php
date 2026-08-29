<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Documents\ReviewEmployeeDocumentRequest;
use App\Http\Requests\Documents\SubmitEmployeeDocumentRequest;
use App\Http\Requests\Documents\SubmitSignedCopyRequest;
use App\Http\Resources\EmployeeDocumentResource;
use App\Models\EmployeeDocument;
use App\Services\DocumentComplianceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeeDocumentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('employee_documents.view'), 403);

        $documents = EmployeeDocument::query()
            ->with(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'approvalRequests.workflow.steps', 'approvalRequests.decisions.actor'])
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
        $data = $request->validated();

        $employeeId = $data['employee_id'] ?? $request->user()->employee?->id;
        abort_if(! $employeeId, 422, 'An employee record is required to upload a document file.');

        $file = $request->file('file');
        $data['file_name'] = $data['file_name'] ?? $file->getClientOriginalName();
        $data['mime_type'] = $file->getClientMimeType();
        $data['file_size'] = $file->getSize();
        $data['file_path'] = $file->store(
            "organizations/{$request->user()->organization_id}/employees/{$employeeId}/documents",
            'local'
        );

        try {
            $document = $documents->submit($request->user(), $data);
        } catch (\Throwable $exception) {
            if (! empty($data['file_path'])) {
                Storage::disk('local')->delete($data['file_path']);
            }

            throw $exception;
        }

        return response()->json([
            'document' => new EmployeeDocumentResource($document),
        ], 201);
    }

    public function show(Request $request, EmployeeDocument $employeeDocument): EmployeeDocumentResource
    {
        $this->authorizeDocumentAccess($request, $employeeDocument);

        return new EmployeeDocumentResource($employeeDocument->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy', 'approvalRequests.workflow.steps', 'approvalRequests.decisions.actor']));
    }

    public function download(Request $request, EmployeeDocument $employeeDocument): StreamedResponse
    {
        $this->authorizeDocumentAccess($request, $employeeDocument);

        abort_unless(Storage::disk('local')->exists($employeeDocument->file_path), 404, 'Document file was not found.');

        return Storage::disk('local')->download($employeeDocument->file_path, $employeeDocument->file_name);
    }

    public function view(Request $request, EmployeeDocument $employeeDocument): BinaryFileResponse
    {
        $this->authorizeDocumentAccess($request, $employeeDocument);

        abort_unless(Storage::disk('local')->exists($employeeDocument->file_path), 404, 'Document file was not found.');

        return response()->file(Storage::disk('local')->path($employeeDocument->file_path), [
            'Content-Type' => $employeeDocument->mime_type ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.$employeeDocument->file_name.'"',
        ]);
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

    public function acknowledge(Request $request, EmployeeDocument $employeeDocument, DocumentComplianceService $documents): JsonResponse
    {
        $document = $documents->acknowledge($request->user(), $employeeDocument);

        return response()->json([
            'document' => new EmployeeDocumentResource($document),
        ]);
    }

    public function signedCopy(SubmitSignedCopyRequest $request, EmployeeDocument $employeeDocument, DocumentComplianceService $documents): JsonResponse
    {
        abort_unless($employeeDocument->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->employee?->id === $employeeDocument->employee_id, 403);

        $file = $request->file('file');
        $filePath = $file->store(
            "organizations/{$request->user()->organization_id}/employees/{$employeeDocument->employee_id}/documents",
            'local'
        );

        try {
            $document = $documents->submit($request->user(), [
                'employee_id' => $employeeDocument->employee_id,
                'document_type_id' => $employeeDocument->document_type_id,
                'document_requirement_id' => $employeeDocument->document_requirement_id,
                'replaces_document_id' => $employeeDocument->id,
                'title' => "{$employeeDocument->title} (signed)",
                'file_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'file_path' => $filePath,
                'notes' => $request->string('notes')->toString() ?: null,
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($filePath);

            throw $exception;
        }

        return response()->json([
            'document' => new EmployeeDocumentResource($document),
        ], 201);
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

    private function authorizeDocumentAccess(Request $request, EmployeeDocument $employeeDocument): void
    {
        abort_unless($employeeDocument->organization_id === $request->user()->organization_id, 404);

        $isOwnDocument = $request->user()->employee?->id === $employeeDocument->employee_id;

        abort_unless($request->user()->can('employee_documents.view') || $isOwnDocument, 403);
    }
}
