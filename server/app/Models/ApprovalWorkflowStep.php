<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'approval_workflow_id',
    'step_order',
    'name',
    'approver_type',
    'approver_role_id',
    'approver_permission',
    'note_required',
    'is_active',
    'settings',
])]
class ApprovalWorkflowStep extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'approval_workflow_id');
    }

    public function approverRole(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'approver_role_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
            'note_required' => 'boolean',
            'is_active' => 'boolean',
            'settings' => 'array',
        ];
    }
}
