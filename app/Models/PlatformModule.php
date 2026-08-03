<?php

namespace App\Models;

use Database\Factories\PlatformModuleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'name',
    'key',
    'description',
    'category',
    'required_permission',
    'is_active',
    'sort_order',
])]
class PlatformModule extends Model implements AuditableContract
{
    /** @use HasFactory<PlatformModuleFactory> */
    use Auditable, HasFactory;

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'organization_modules', 'platform_module_id', 'organization_id')
            ->withPivot(['status', 'starts_at', 'expires_at', 'settings'])
            ->withTimestamps();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
