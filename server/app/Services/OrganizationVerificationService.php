<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\OrganizationVerificationDocument;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class OrganizationVerificationService
{
    public const REQUIRED_DOCUMENT_TYPES = [
        'business_registration',
        'authorized_representative_id',
        'proof_of_address',
        'service_agreement',
    ];

    public const OPTIONAL_DOCUMENT_TYPES = [
        'tax_identification',
        'industry_license',
        'other',
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function checklist(Organization $organization): array
    {
        $latestDocuments = $this->latestDocuments($organization);

        return collect(self::REQUIRED_DOCUMENT_TYPES)
            ->merge(self::OPTIONAL_DOCUMENT_TYPES)
            ->map(function (string $type) use ($latestDocuments): array {
                $document = $latestDocuments->get($type);

                return [
                    'type' => $type,
                    'label' => str($type)->replace('_', ' ')->title()->toString(),
                    'required' => in_array($type, self::REQUIRED_DOCUMENT_TYPES, true),
                    'status' => $document?->status ?? 'missing',
                    'document_id' => $document?->id,
                    'submitted_at' => $document?->submitted_at,
                    'reviewed_at' => $document?->reviewed_at,
                    'review_note' => $document?->review_note,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(Organization $organization): array
    {
        $checklist = collect($this->checklist($organization));
        $required = $checklist->where('required', true);
        $approved = $required->where('status', 'approved')->count();
        $submitted = $required->filter(fn (array $item) => in_array($item['status'], ['submitted', 'approved'], true))->count();

        return [
            'status' => $organization->status,
            'required_total' => $required->count(),
            'required_submitted' => $submitted,
            'required_approved' => $approved,
            'is_ready_for_review' => $submitted === $required->count(),
            'is_verified' => $approved === $required->count(),
            'checklist' => $checklist->values()->all(),
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public function createDocument(User $actor, array $data): OrganizationVerificationDocument
    {
        $organization = $actor->organization;

        if (! $organization) {
            throw ValidationException::withMessages([
                'organization' => ['A workspace organization is required before submitting verification documents.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $organization, $data): OrganizationVerificationDocument {
            $document = OrganizationVerificationDocument::query()->create([
                'organization_id' => $organization->id,
                'uploaded_by_id' => $actor->id,
                'document_type' => $data['document_type'],
                'title' => $data['title'],
                'file_name' => $data['file_name'],
                'file_path' => $data['file_path'],
                'mime_type' => $data['mime_type'] ?? null,
                'file_size' => $data['file_size'] ?? null,
                'status' => 'submitted',
                'notes' => $data['notes'] ?? null,
                'submitted_at' => now(),
            ]);

            if (in_array($organization->status, ['invited', 'setup', 'setup_in_progress'], true)) {
                $this->transitionOrganization($organization, $actor, 'setup_in_progress', 'Verification document uploaded.');
            }

            return $document->load(['uploadedBy', 'reviewedBy']);
        });
    }

    public function submitForReview(User $actor): array
    {
        $organization = $actor->organization;

        if (! $organization) {
            throw ValidationException::withMessages([
                'organization' => ['A workspace organization is required before submitting verification documents.'],
            ]);
        }

        $summary = $this->summary($organization);

        if (! $summary['is_ready_for_review']) {
            throw ValidationException::withMessages([
                'documents' => ['Upload all required organization verification documents before submitting for Valtireo review.'],
            ]);
        }

        if (in_array($organization->status, ['active', 'suspended'], true)) {
            throw ValidationException::withMessages([
                'status' => ['This organization status cannot be submitted for verification review.'],
            ]);
        }

        $this->transitionOrganization($organization, $actor, 'pending_approval', 'Organization submitted verification documents for Valtireo review.');

        return $this->summary($organization->refresh());
    }

    public function reviewDocument(User $actor, OrganizationVerificationDocument $document, string $action, ?string $note = null): OrganizationVerificationDocument
    {
        $status = match ($action) {
            'approve' => 'approved',
            'reject' => 'rejected',
            default => 'changes_requested',
        };

        $document->update([
            'status' => $status,
            'reviewed_by_id' => $actor->id,
            'review_note' => $note,
            'reviewed_at' => now(),
        ]);

        $organization = $document->organization;
        if ($organization && in_array($status, ['rejected', 'changes_requested'], true) && $organization->status === 'pending_approval') {
            $this->transitionOrganization($organization, $actor, 'setup_in_progress', $note ?: 'Verification document requires attention.');
        }

        return $document->refresh()->load(['uploadedBy', 'reviewedBy']);
    }

    public function assertReadyForActivation(Organization $organization): void
    {
        if ($this->summary($organization)['is_verified']) {
            return;
        }

        throw ValidationException::withMessages([
            'status' => ['Approve all required organization verification documents before activating this organization.'],
        ]);
    }

    /**
     * @return Collection<string, OrganizationVerificationDocument>
     */
    private function latestDocuments(Organization $organization): Collection
    {
        if (! Schema::hasTable('organization_verification_documents')) {
            return collect();
        }

        return OrganizationVerificationDocument::query()
            ->where('organization_id', $organization->id)
            ->latest('id')
            ->get()
            ->unique('document_type')
            ->keyBy('document_type');
    }

    private function transitionOrganization(Organization $organization, User $actor, string $status, ?string $reason = null): void
    {
        $previousStatus = $organization->status;

        if ($previousStatus === $status) {
            return;
        }

        $organization->update(['status' => $status]);
        $organization->statusHistories()->create([
            'changed_by_id' => $actor->id,
            'previous_status' => $previousStatus,
            'new_status' => $status,
            'reason' => $reason,
        ]);
    }
}
