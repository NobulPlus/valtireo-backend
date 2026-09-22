<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'name', 'code', 'type', 'calculation_type', 'default_value', 'percentage_of_component_id', 'is_taxable', 'is_statutory', 'is_recurring', 'is_active', 'sort_order'])]
class PayrollComponent extends Model implements AuditableContract
{
    use Auditable;
    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
    public function percentageBase(): BelongsTo { return $this->belongsTo(self::class, 'percentage_of_component_id'); }
    protected function casts(): array { return ['default_value' => 'decimal:4', 'is_taxable' => 'boolean', 'is_statutory' => 'boolean', 'is_recurring' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'integer']; }
}
