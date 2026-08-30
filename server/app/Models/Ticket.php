<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'employee_id',
    'requested_by_id',
    'assigned_to_user_id',
    'ticket_category_id',
    'department_id',
    'asset_id',
    'subject',
    'description',
    'status',
    'priority',
    'escalation_level',
    'escalated_at',
    'attachment_file_name',
    'attachment_file_path',
    'attachment_mime_type',
    'attachment_file_size',
    'submitted_at',
    'reviewed_at',
    'first_responded_at',
    'resolved_at',
    'on_hold_at',
    'hold_reason',
    'sla_due_at',
    'closed_at',
    'satisfaction_rating',
    'satisfaction_comment',
])]
class Ticket extends Model implements AuditableContract
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

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class, 'ticket_category_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function approvalRequests(): MorphMany
    {
        return $this->morphMany(ApprovalRequest::class, 'approvable');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TicketComment::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(TicketActivity::class);
    }

    public function watchers(): HasMany
    {
        return $this->hasMany(TicketWatcher::class);
    }

    public function watcherUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ticket_watchers')->withTimestamps();
    }

    protected function casts(): array
    {
        return [
            'escalation_level' => 'integer',
            'satisfaction_rating' => 'integer',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'first_responded_at' => 'datetime',
            'resolved_at' => 'datetime',
            'on_hold_at' => 'datetime',
            'sla_due_at' => 'datetime',
            'escalated_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
