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
    'module',
    'action',
    'name',
    'description',
    'is_active',
    'require_note_on_reject',
    'require_note_on_request_changes',
    'auto_approve_when_no_steps',
    'conditions',
])]
class ApprovalWorkflow extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalWorkflowStep::class)->orderBy('step_order');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'require_note_on_reject' => 'boolean',
            'require_note_on_request_changes' => 'boolean',
            'auto_approve_when_no_steps' => 'boolean',
            'conditions' => 'array',
        ];
    }
}
