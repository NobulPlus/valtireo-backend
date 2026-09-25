<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'payroll_run_item_id', 'payroll_component_id', 'component_code', 'component_name', 'type', 'quantity', 'rate', 'amount', 'is_taxable', 'is_statutory', 'calculation_snapshot'])]
class PayrollRunItemLine extends Model
{
    public function item(): BelongsTo { return $this->belongsTo(PayrollRunItem::class, 'payroll_run_item_id'); }
    public function component(): BelongsTo { return $this->belongsTo(PayrollComponent::class, 'payroll_component_id'); }
    protected function casts(): array { return ['is_taxable' => 'boolean', 'is_statutory' => 'boolean', 'calculation_snapshot' => 'array']; }
}
