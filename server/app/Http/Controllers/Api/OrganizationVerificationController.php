<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReviewOrganizationVerificationDocumentRequest;
use App\Http\Requests\Platform\StoreOrganizationVerificationDocumentRequest;
use App\Http\Resources\OrganizationVerificationDocumentResource;
use App\Models\Organization;
use App\Models\OrganizationVerificationDocument;
use App\Services\OrganizationVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrganizationVerificationController extends Controller
{
    public function show(Request $request, OrganizationVerificationService $verification): JsonResponse
    {
        abort_unless($request->user()->organization, 404);
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $documents = $this->documentsForOrganization((int) $request->user()->organization_id);

        return response()->json([
            'verification' => $verification->summary($request->user()->organization),
            'documents' => OrganizationVerificationDocumentResource::collection($documents),
        ]);
    }

    public function store(
        StoreOrganizationVerificationDocumentRequest $request,
        OrganizationVerificationService $verification
    ): JsonResponse {
        $file = $request->file('file');
        $data = $request->validated();
        $data['file_name'] = $file->getClientOriginalName();
        $data['mime_type'] = $file->getClientMimeType();
        $data['file_size'] = $file->getSize();
        $data['file_path'] = $file->store(
            "organizations/{$request->user()->organization_id}/verification",
            'local'
        );

        try {
            $document = $verification->createDocument($request->user(), $data);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($data['file_path']);

            throw $exception;
        }

        return response()->json([
            'document' => new OrganizationVerificationDocumentResource($document),
            'verification' => $verification->summary($request->user()->organization->refresh()),
        ], 201);
    }

    public function submit(Request $request, OrganizationVerificationService $verification): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        return response()->json([
            'message' => 'Organization verification submitted for Valtireo review.',
            'verification' => $verification->submitForReview($request->user()),
        ]);
    }

    public function download(Request $request, OrganizationVerificationDocument $document): StreamedResponse
    {
        $this->authorizeDocumentAccess($request, $document);

        abort_unless(Storage::disk('local')->exists($document->file_path), 404, 'Verification document file was not found.');

        return Storage::disk('local')->download($document->file_path, $document->file_name);
    }

    public function platformIndex(
        Request $request,
        Organization $organization,
        OrganizationVerificationService $verification
    ): JsonResponse {
        abort_unless($request->user()->is_platform_admin, 403);

        $documents = $this->documentsForOrganization($organization->id);

        return response()->json([
            'verification' => $verification->summary($organization),
            'documents' => OrganizationVerificationDocumentResource::collection($documents),
        ]);
    }

    public function platformReview(
        ReviewOrganizationVerificationDocumentRequest $request,
        Organization $organization,
        OrganizationVerificationDocument $document,
        OrganizationVerificationService $verification
    ): JsonResponse {
        abort_unless($document->organization_id === $organization->id, 404);

        $document = $verification->reviewDocument(
            $request->user(),
            $document,
            $request->string('action')->toString(),
            $request->string('note')->toString() ?: null
        );

        return response()->json([
            'document' => new OrganizationVerificationDocumentResource($document),
            'verification' => $verification->summary($organization->refresh()),
        ]);
    }

    private function authorizeDocumentAccess(Request $request, OrganizationVerificationDocument $document): void
    {
        $isPlatformAdmin = $request->user()?->is_platform_admin === true;
        $isOwnOrganization = $request->user()?->organization_id === $document->organization_id;

        abort_unless($isPlatformAdmin || $isOwnOrganization, 404);
        abort_unless($isPlatformAdmin || $request->user()->can('workspace_settings.update'), 403);
    }

    /**
     * @return Collection<int, OrganizationVerificationDocument>
     */
    private function documentsForOrganization(int $organizationId): Collection
    {
        if (! Schema::hasTable('organization_verification_documents')) {
            return collect();
        }

        return OrganizationVerificationDocument::query()
            ->with(['uploadedBy', 'reviewedBy'])
            ->where('organization_id', $organizationId)
            ->latest('id')
            ->get();
    }
}
