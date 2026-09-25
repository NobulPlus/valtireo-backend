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
    'asset_tag',
    'serial_number',
    'asset_category_id',
    'status',
    'condition',
    'assigned_to_employee_id',
    'assigned_at',
    'organization_location_id',
    'purchase_date',
    'warranty_expires_at',
    'notes',
])]
class Asset extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'asset_category_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_to_employee_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(OrganizationLocation::class, 'organization_location_id');
    }

    public function assignmentHistories(): HasMany
    {
        return $this->hasMany(AssetAssignmentHistory::class)->latest('id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(AssetIncident::class)->latest('id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'purchase_date' => 'date',
            'warranty_expires_at' => 'date',
        ];
    }
}
