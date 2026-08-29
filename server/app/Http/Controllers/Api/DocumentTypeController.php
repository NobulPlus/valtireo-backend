<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Documents\StoreDocumentTypeRequest;
use App\Http\Requests\Documents\UpdateDocumentTypeRequest;
use App\Http\Resources\DocumentTypeResource;
use App\Models\DocumentType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DocumentTypeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('employee_documents.view') || $request->user()->employee !== null, 403);

        $types = DocumentType::query()
            ->withCount('requirements')
            ->where('organization_id', $request->user()->organization_id)
            ->when(
                ! $request->user()->can('employee_documents.create'),
                fn ($query) => $query->where('employee_upload_allowed', true)
            )
            ->when($request->string('search')->toString(), function ($query, string $search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return DocumentTypeResource::collection($types);
    }

    public function store(StoreDocumentTypeRequest $request): DocumentTypeResource
    {
        $type = DocumentType::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return new DocumentTypeResource($type->loadCount('requirements'));
    }

    public function show(Request $request, DocumentType $documentType): DocumentTypeResource
    {
        abort_unless($request->user()->can('employee_documents.view') || $request->user()->employee !== null, 403);
        abort_unless($documentType->organization_id === $request->user()->organization_id, 404);

        return new DocumentTypeResource($documentType->loadCount('requirements'));
    }

    public function update(UpdateDocumentTypeRequest $request, DocumentType $documentType): DocumentTypeResource
    {
        abort_unless($documentType->organization_id === $request->user()->organization_id, 404);

        $documentType->update($request->validated());

        return new DocumentTypeResource($documentType->refresh()->loadCount('requirements'));
    }
}
