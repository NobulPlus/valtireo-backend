<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'name', 'code', 'frequency', 'pay_day', 'is_active'])]
class PayGroup extends Model implements AuditableContract
{
    use Auditable;
    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
    public function compensations(): HasMany { return $this->hasMany(EmployeeCompensation::class); }
    protected function casts(): array { return ['pay_day' => 'integer', 'is_active' => 'boolean']; }
}
