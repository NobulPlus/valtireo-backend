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
    public function __construct(private readonly EmployeeProfileActivityService $activities)
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
            }

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

            if ($documentType->requires_expiry_date && empty($data['expires_at'])) {
                throw ValidationException::withMessages([
                    'expires_at' => ['The expiry date is required for this document type.'],
                ]);
            }

            $approvalRequired = $requirement?->approval_required ?? $documentType->approval_required;

            $document = EmployeeDocument::query()->create([
                'organization_id' => $actor->organization_id,
                'employee_id' => $employee->id,
                'document_type_id' => $documentType->id,
                'document_requirement_id' => $requirement?->id,
                'uploaded_by_id' => $actor->id,
                'title' => $data['title'],
                'file_name' => $data['file_name'],
                'file_path' => $data['file_path'],
                'mime_type' => $data['mime_type'] ?? null,
                'file_size' => $data['file_size'] ?? null,
                'issued_at' => $data['issued_at'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                'status' => $approvalRequired ? 'submitted' : 'approved',
                'notes' => $data['notes'] ?? null,
                'submitted_at' => now(),
                'reviewed_at' => $approvalRequired ? null : now(),
            ])->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy']);

            $this->activities->record(
                $employee,
                $actor,
                'document_submitted',
                'Document submitted',
                "{$document->title} was submitted.",
                $document,
                ['status' => $document->status, 'document_type_id' => $document->document_type_id]
            );

            return $document;
        });
    }

    public function review(User $actor, EmployeeDocument $document, string $action, ?string $note = null): EmployeeDocument
    {
        if ($document->organization_id !== $actor->organization_id) {
            abort(404);
        }

        $nextStatus = match ($action) {
            'approve' => 'approved',
            'reject' => 'rejected',
            'request_changes' => 'changes_requested',
        };

        return DB::transaction(function () use ($actor, $document, $action, $note, $nextStatus): EmployeeDocument {
            $previousStatus = $document->status;

            $document->update([
                'status' => $nextStatus,
                'reviewed_by_id' => $actor->id,
                'review_note' => $note,
                'reviewed_at' => now(),
            ]);

            $document->reviews()->create([
                'reviewed_by_id' => $actor->id,
                'action' => $action,
                'previous_status' => $previousStatus,
                'next_status' => $nextStatus,
                'note' => $note,
            ]);

            $this->activities->record(
                $document->employee,
                $actor,
                'document_reviewed',
                'Document reviewed',
                "{$document->title} was {$nextStatus}.",
                $document,
                ['previous_status' => $previousStatus, 'next_status' => $nextStatus]
            );

            return $document->refresh()->load(['employee', 'documentType', 'requirement', 'uploadedBy', 'reviewedBy', 'reviews.reviewedBy']);
        });
    }

    /**
     * @return array<string, mixed>
     */
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
            ->with('documentType:id,code,name,requires_expiry_date')
            ->get();

        $rows = [];
        $summary = [
            'employees_checked' => $employees->count(),
            'requirements_checked' => $requirements->count(),
            'missing' => 0,
            'expired' => 0,
            'expiring_soon' => 0,
            'submitted' => 0,
            'approved' => 0,
            'rejected' => 0,
            'changes_requested' => 0,
        ];

        foreach ($employees as $employee) {
            foreach ($requirements as $requirement) {
                if (! $this->requirementAppliesToEmployee($requirement, $employee)) {
                    continue;
                }

                $document = EmployeeDocument::query()
                    ->where('employee_id', $employee->id)
                    ->where('document_requirement_id', $requirement->id)
                    ->latest('id')
                    ->first();

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

    private function complianceState(?EmployeeDocument $document, int $reminderDays): string
    {
        if (! $document) {
            return 'missing';
        }

        if ($document->expires_at && $document->expires_at->isPast()) {
            return 'expired';
        }

        if ($document->expires_at && $document->expires_at->lte(now()->addDays($reminderDays))) {
            return 'expiring_soon';
        }

        return $document->status;
    }
}
