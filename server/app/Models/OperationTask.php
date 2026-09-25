<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'key', 'source_type', 'source_id', 'subject_employee_id', 'assigned_user_id', 'created_by_id', 'completed_by_id', 'category', 'title', 'description', 'priority', 'status', 'due_at', 'action_url', 'metadata', 'started_at', 'completed_at'])]
class OperationTask extends Model implements AuditableContract
{
    use Auditable;

    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    public function subjectEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'subject_employee_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by_id');
    }

    protected function casts(): array
    {
        return ['metadata' => 'array', 'due_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
    }
}
