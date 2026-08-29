<?php

namespace App\Services;

use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DocumentComplianceService
{
    public function __construct(
        private readonly EmployeeProfileActivityService $activities,
        private readonly ApprovalRequestService $approvals,
        private readonly NotificationDispatchService $notifications
    )
    {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function submit(User $actor, array $data): EmployeeDocument
    {
        return DB::transaction(function () use ($actor, $data): EmployeeDocument {
            $employee = $this->targetEmployee($actor, $data['employee_id'] ?? null);
            $documentType = DocumentType::query()
                ->where('organization_id', $actor->organization_id)
                ->findOrFail($data['document_type_id']);
            $requirement = null;

            if (! empty($data['document_requirement_id'])) {
                $requirement = DocumentRequirement::query()
                    ->where('organization_id', $actor->organization_id)
                    ->where('document_type_id', $documentType->id)
                    ->findOrFail($data['document_requirement_id']);
            } else {
                // Self-service uploads (and any admin upload that skips the
                // requirement picker) never send this explicitly — without
                // inferring it, the document is never linked to what it's
                // actually satisfying, and compliance stays "missing"
                // forever even once the document is approved.
                $requirement = $this->inferRequirement($documentType, $employee);
            }

            $originalDocument = null;
            if (! empty($data['replaces_document_id'])) {
                $originalDocument = EmployeeDocument::query()
                    ->where('organization_id', $actor->organization_id)
                    ->where('employee_id', $employee->id)
                    ->findOrFail($data['replaces_document_id']);

                if (! in_array($originalDocument->status, ['awaiting_signature', 'rejected', 'changes_requested'], true)) {
                    throw ValidationException::withMessages([
                        'replaces_document_id' => ['This document is not awaiting a signed copy.'],
                    ]);
                }
            }

            // Replying with a signed copy of your own awaiting-signature
            // document is always allowed for the owning employee, regardless
            // of employee_upload_allowed — that flag governs the original
            // HR-provided file, not the employee's signed reply to it.
            $isSignedCopyReply = $originalDocument !== null;

            if (! $isSignedCopyReply) {
                if (! $actor->can('employee_documents.create') && ! $documentType->employee_upload_allowed) {
                    throw ValidationException::withMessages([
                        'document_type_id' => ['Employees are not allowed to upload this document type.'],
                    ]);
                }

                if ($requirement && ! $actor->can('employee_documents.create') && ! $requirement->employee_upload_allowed) {
                    throw ValidationException::withMessages([
                        'document_requirement_id' => ['Employees are not allowed to upload this required document.'],
                    ]);
                }
            }

            if ($documentType->requires_expiry_date && empty($data['expires_at'])) {
                throw ValidationException::withMessages([
                    'expires_at' => ['The expiry date is required for this document type.'],
                ]);
            }

            $isHrProvided = $actor->employee?->id !== $employee->id;

            // A signed copy always goes through HR review, regardless of the
            // type's own approval_required flag — reviewing it is the whole
            // point of this path (confirming the signature is legitimate).
            $approvalRequired = $isSignedCopyReply
                ? true
                : ($requirement?->approval_required ?? $documentType->approval_required);

            $initialStatus = match (true) {
                $isSignedCopyReply => 'submitted',
                $documentType->signature_method === 'signed_copy' && $isHrProvided => 'awaiting_signature',
                default => $approvalRequired ? 'submitted' : 'approved',
            };

            $document = EmployeeDocument::query()->create([
                'organization_id' => $actor->organization_id,
                'employee_id' => $employee->id,
                'document_type_id' => $documentType->id,
                'document_requirement_id' => $requirement?->id ?? $originalDocument?->document_requirement_id,
                'replaces_document_id' => $originalDocument?->id,
                'uploaded_by_id' => $actor->id,
                'title' => $data['title'],
                'file_name' => $data['file_name'],
                'file_path' => $data['file_path'],
                'mime_type' => $data['mime_type'] ?? null,
                'file_size' => $data['file_size'] ?? null,
                'issued_at' => $data['issued_at'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                'status' => $initialStatus,
                'notes' => $data['notes'] ?? null,
                'submitted_at' => now(),
                'reviewed_at' => $initialStatus === 'approved' ? now() : null,
            ])->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy']);

            if ($originalDocument) {
                $originalDocument->update(['status' => 'superseded']);
            }

            $this->activities->record(
                $employee,
                $actor,
                'document_submitted',
                'Document submitted',
                "{$document->title} was submitted.",
                $document,
                ['status' => $document->status, 'document_type_id' => $document->document_type_id]
            );

            // Gated on the document's own resulting status, not the raw
            // approval_required flag — an "awaiting_signature" original
            // (the blank template HR just sent) has nothing to review yet;
            // only a genuinely "submitted" document (a normal upload, or
            // the employee's signed reply) should ever create a review task.
            if ($initialStatus === 'submitted') {
                $this->approvals->submit(
                    $actor,
                    $document,
                    'employee_documents',
                    'submit',
                    "Review {$document->title}",
                    $employee,
                    ['document_type_id' => $document->document_type_id, 'document_requirement_id' => $document->document_requirement_id]
                );
            }

            // Only when someone else (HR) handed this to the employee — not
            // when the employee is submitting their own document or replying
            // with a signed copy (that reply's review is handled by the
            // approval-submitted notification above, addressed to HR).
            if ($documentType->signature_method === 'acknowledge' && $isHrProvided) {
                $this->notifications->documentNeedsAcknowledgment($document);
            } elseif ($documentType->signature_method === 'signed_copy' && $isHrProvided && ! $isSignedCopyReply) {
                $this->notifications->documentNeedsSignature($document);
            }

            return $document->refresh()->load(['employee', 'documentType', 'requirement', 'replacesDocument', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy', 'approvalRequests.workflow.steps', 'approvalRequests.decisions.actor']);
        });
    }

    public function review(User $actor, EmployeeDocument $document, string $action, ?string $note = null): EmployeeDocument
    {
        if ($document->organization_id !== $actor->organization_id) {
            abort(404);
        }

        return DB::transaction(function () use ($actor, $document, $action, $note): EmployeeDocument {
            $previousStatus = $document->status;
            $approvalRequest = $document->approvalRequests()
                ->where('status', 'pending')
                ->latest()
                ->first();

            if (! $approvalRequest) {
                $approvalRequest = $this->approvals->submit(
                    $actor,
                    $document,
                    'employee_documents',
                    'submit',
                    "Review {$document->title}",
                    $document->employee,
                    ['document_type_id' => $document->document_type_id, 'document_requirement_id' => $document->document_requirement_id]
                );
            }

            $this->approvals->act($actor, $approvalRequest, $action, $note);
            $document = $document->refresh()->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy', 'approvalRequests.workflow.steps', 'approvalRequests.decisions.actor']);

            $this->activities->record(
                $document->employee,
                $actor,
                'document_reviewed',
                'Document reviewed',
                "{$document->title} was {$document->status}.",
                $document,
                ['previous_status' => $previousStatus, 'next_status' => $document->status]
            );

            return $document;
        });
    }

    /**
     * The employee's own confirmation that they've read/received a document
     * — distinct from the HR-side approve/reject review cycle above. Only
     * the owning employee can acknowledge, and only for document types that
     * are actually configured to require it.
     */
    public function acknowledge(User $actor, EmployeeDocument $document): EmployeeDocument
    {
        if ($document->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if ($actor->employee?->id !== $document->employee_id) {
            abort(403);
        }

        $document->loadMissing('documentType');

        if ($document->documentType->signature_method !== 'acknowledge') {
            throw ValidationException::withMessages([
                'status' => ['This document does not require acknowledgment.'],
            ]);
        }

        if ($document->acknowledged_at) {
            throw ValidationException::withMessages([
                'status' => ['This document has already been acknowledged.'],
            ]);
        }

        $document->update(['acknowledged_at' => now()]);
        $document = $document->refresh()->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy']);

        $this->activities->record(
            $document->employee,
            $actor,
            'document_acknowledged',
            'Document acknowledged',
            "{$document->title} was acknowledged.",
            $document,
            []
        );

        $this->notifications->documentAcknowledged($document);

        return $document;
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * Personal compliance rows for one employee's own dashboard — only the
     * requirements that actually need their attention (missing, expired, or
     * expiring soon), not the full org-wide compliance matrix.
     *
     * @return array<int, array<string, mixed>>
     */
    public function complianceForEmployee(Employee $employee): array
    {
        $requirements = DocumentRequirement::query()
            ->where('organization_id', $employee->organization_id)
            ->where('is_active', true)
            ->where('is_required', true)
            ->with('documentType:id,code,name')
            ->get()
            ->filter(fn (DocumentRequirement $requirement) => $this->requirementAppliesToEmployee($requirement, $employee));

        $latestDocuments = EmployeeDocument::query()
            ->where('employee_id', $employee->id)
            ->whereIn('document_requirement_id', $requirements->pluck('id'))
            ->with('documentType:id,signature_method')
            ->orderByDesc('id')
            ->get()
            ->unique('document_requirement_id')
            ->keyBy('document_requirement_id');

        return $requirements
            ->map(function (DocumentRequirement $requirement) use ($latestDocuments) {
                $document = $latestDocuments->get($requirement->id);
                $state = $this->complianceState($document, $requirement->reminder_days);

                return [
                    'requirement' => [
                        'id' => $requirement->id,
                        'name' => $requirement->name,
                        'document_type' => $requirement->documentType->name,
                    ],
                    'state' => $state,
                    'expires_at' => $document?->expires_at,
                    'document_id' => $document?->id,
                ];
            })
            ->filter(fn (array $row): bool => in_array($row['state'], ['missing', 'expired', 'expiring_soon', 'pending_acknowledgment', 'awaiting_signature', 'rejected', 'changes_requested'], true))
            ->values()
            ->all();
    }

    public function compliance(User $actor, array $filters = []): array
    {
        $employees = Employee::query()
            ->where('organization_id', $actor->organization_id)
            ->when($filters['department_id'] ?? null, fn (Builder $query, int $id) => $query->where('department_id', $id))
            ->when($filters['employment_type_id'] ?? null, fn (Builder $query, int $id) => $query->where('employment_type_id', $id))
            ->when($filters['organization_location_id'] ?? null, fn (Builder $query, int $id) => $query->where('organization_location_id', $id))
            ->with(['department:id,code,name', 'employmentType:id,code,name', 'location:id,code,name'])
            ->get();

        $requirements = DocumentRequirement::query()
            ->where('organization_id', $actor->organization_id)
            ->where('is_active', true)
            ->where('is_required', true)
            ->with('documentType:id,code,name,requires_expiry_date,signature_method')
            ->get();

        $rows = [];
        $summary = [
            'employees_checked' => $employees->count(),
            'requirements_checked' => $requirements->count(),
            'missing' => 0,
            'expired' => 0,
            'expiring_soon' => 0,
            'pending_acknowledgment' => 0,
            'awaiting_signature' => 0,
            'submitted' => 0,
            'approved' => 0,
            'rejected' => 0,
            'changes_requested' => 0,
            'superseded' => 0,
        ];

        $latestDocuments = EmployeeDocument::query()
            ->whereIn('employee_id', $employees->pluck('id'))
            ->whereIn('document_requirement_id', $requirements->pluck('id'))
            ->with('documentType:id,signature_method')
            ->orderByDesc('id')
            ->get()
            ->unique(fn (EmployeeDocument $document) => "{$document->employee_id}:{$document->document_requirement_id}")
            ->keyBy(fn (EmployeeDocument $document) => "{$document->employee_id}:{$document->document_requirement_id}");

        foreach ($employees as $employee) {
            foreach ($requirements as $requirement) {
                if (! $this->requirementAppliesToEmployee($requirement, $employee)) {
                    continue;
                }

                $document = $latestDocuments->get("{$employee->id}:{$requirement->id}");

                $state = $this->complianceState($document, $requirement->reminder_days);
                $summary[$state]++;

                $rows[] = [
                    'employee' => [
                        'id' => $employee->id,
                        'employee_number' => $employee->employee_number,
                        'full_name' => trim($employee->first_name.' '.$employee->last_name),
                    ],
                    'requirement' => [
                        'id' => $requirement->id,
                        'name' => $requirement->name,
                        'document_type' => [
                            'id' => $requirement->documentType->id,
                            'code' => $requirement->documentType->code,
                            'name' => $requirement->documentType->name,
                        ],
                    ],
                    'state' => $state,
                    'document' => $document ? [
                        'id' => $document->id,
                        'status' => $document->status,
                        'expires_at' => $document->expires_at,
                    ] : null,
                ];
            }
        }

        return [
            'summary' => $summary,
            'data' => $rows,
        ];
    }

    private function targetEmployee(User $actor, ?int $employeeId): Employee
    {
        if ($actor->can('employee_documents.create') && $employeeId) {
            return Employee::query()
                ->where('organization_id', $actor->organization_id)
                ->findOrFail($employeeId);
        }

        $employee = $actor->employee;

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee_id' => ['An employee record is required to submit documents.'],
            ]);
        }

        return $employee;
    }

    private function requirementAppliesToEmployee(DocumentRequirement $requirement, Employee $employee): bool
    {
        return (! $requirement->department_id || $requirement->department_id === $employee->department_id)
            && (! $requirement->designation_id || $requirement->designation_id === $employee->designation_id)
            && (! $requirement->grade_level_id || $requirement->grade_level_id === $employee->grade_level_id)
            && (! $requirement->employment_type_id || $requirement->employment_type_id === $employee->employment_type_id)
            && (! $requirement->organization_location_id || $requirement->organization_location_id === $employee->organization_location_id);
    }

    /**
     * Whichever single active requirement a freshly-uploaded document of
     * this type actually satisfies for this employee — a person picking
     * "Government ID" as the document type shouldn't also need to know
     * about the separate admin concept of "requirements". Only links when
     * the match is unambiguous; genuinely optional documents, or a type
     * with more than one applicable requirement, are left unlinked rather
     * than guessed.
     */
    private function inferRequirement(DocumentType $documentType, Employee $employee): ?DocumentRequirement
    {
        $candidates = DocumentRequirement::query()
            ->where('organization_id', $employee->organization_id)
            ->where('document_type_id', $documentType->id)
            ->where('is_active', true)
            ->get()
            ->filter(fn (DocumentRequirement $requirement) => $this->requirementAppliesToEmployee($requirement, $employee));

        return $candidates->count() === 1 ? $candidates->first() : null;
    }

    private function complianceState(?EmployeeDocument $document, int $reminderDays): string
    {
        if (! $document) {
            return 'missing';
        }

        if ($document->expires_at && $document->expires_at->isPast()) {
            return 'expired';
        }

        if ($document->documentType->signature_method === 'acknowledge' && ! $document->acknowledged_at) {
            return 'pending_acknowledgment';
        }

        if ($document->expires_at && $document->expires_at->lte(now()->addDays($reminderDays))) {
            return 'expiring_soon';
        }

        return $document->status;
    }
}
