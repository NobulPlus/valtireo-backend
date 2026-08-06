<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'employee_id',
    'document_type_id',
    'document_requirement_id',
    'uploaded_by_id',
    'reviewed_by_id',
    'title',
    'file_name',
    'file_path',
    'mime_type',
    'file_size',
    'issued_at',
    'expires_at',
    'status',
    'notes',
    'review_note',
    'submitted_at',
    'reviewed_at',
])]
class EmployeeDocument extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }

    public function requirement(): BelongsTo
    {
        return $this->belongsTo(DocumentRequirement::class, 'document_requirement_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(EmployeeDocumentReview::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'issued_at' => 'date',
            'expires_at' => 'date',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }
}
