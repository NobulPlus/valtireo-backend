<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'employee_document_id',
    'reviewed_by_id',
    'action',
    'previous_status',
    'next_status',
    'note',
])]
class EmployeeDocumentReview extends Model implements AuditableContract
{
    use Auditable;

    public function employeeDocument(): BelongsTo
    {
        return $this->belongsTo(EmployeeDocument::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }
}
