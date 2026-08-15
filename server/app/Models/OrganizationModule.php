<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'platform_module_id',
    'status',
    'starts_at',
    'expires_at',
    'settings',
])]
class OrganizationModule extends Model implements AuditableContract
{
    use Auditable;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function platformModule(): BelongsTo
    {
        return $this->belongsTo(PlatformModule::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'settings' => 'array',
        ];
    }
}
