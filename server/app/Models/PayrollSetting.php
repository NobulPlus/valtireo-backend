<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'currency', 'decimal_places', 'default_pay_frequency', 'pay_day', 'prorate_joiners', 'prorate_leavers', 'proration_basis', 'statutory_rules'])]
class PayrollSetting extends Model implements AuditableContract
{
    use Auditable;

    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }

    protected function casts(): array
    {
        return ['decimal_places' => 'integer', 'pay_day' => 'integer', 'prorate_joiners' => 'boolean', 'prorate_leavers' => 'boolean', 'statutory_rules' => 'array'];
    }
}
