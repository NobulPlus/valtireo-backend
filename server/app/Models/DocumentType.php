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
    'name',
    'code',
    'description',
    'requires_expiry_date',
    'default_reminder_days',
    'employee_upload_allowed',
    'approval_required',
    'signature_method',
    'is_active',
])]
class DocumentType extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function requirements(): HasMany
    {
        return $this->hasMany(DocumentRequirement::class);
    }

    public function employeeDocuments(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requires_expiry_date' => 'boolean',
            'default_reminder_days' => 'integer',
            'employee_upload_allowed' => 'boolean',
            'approval_required' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
