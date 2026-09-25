<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['organization_id', 'operation_automation_rule_id', 'subject_type', 'subject_id', 'trigger', 'deduplication_key', 'status', 'context', 'results', 'error', 'started_at', 'completed_at'])]
class OperationAutomationRun extends Model
{
    public function rule(): BelongsTo
    {
        return $this->belongsTo(OperationAutomationRule::class, 'operation_automation_rule_id');
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return ['context' => 'array', 'results' => 'array', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
    }
}
