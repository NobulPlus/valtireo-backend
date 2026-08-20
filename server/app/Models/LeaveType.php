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
    'default_days_per_year',
    'auto_grant_on_activation',
    'is_paid',
    'requires_attachment',
    'minimum_notice_days',
    'maximum_days_per_request',
    'is_active',
])]
class LeaveType extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(LeaveEntitlement::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    protected function casts(): array
    {
        return [
            'is_paid' => 'boolean',
            'requires_attachment' => 'boolean',
            'minimum_notice_days' => 'integer',
            'maximum_days_per_request' => 'integer',
            'default_days_per_year' => 'integer',
            'auto_grant_on_activation' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
