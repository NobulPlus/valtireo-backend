<?php

namespace App\Models;

use Database\Factories\GradeLevelFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'name',
    'code',
    'rank',
    'description',
    'is_active',
])]
class GradeLevel extends Model implements AuditableContract
{
    /** @use HasFactory<GradeLevelFactory> */
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rank' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
