<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemErrorLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'organization_id',
        'user_id',
        'resolved_by_id',
        'level',
        'status_code',
        'exception_class',
        'message',
        'file',
        'line',
        'method',
        'url',
        'route',
        'ip_address',
        'user_agent',
        'request_id',
        'fingerprint',
        'context',
        'trace_excerpt',
        'resolved_at',
        'resolution_note',
    ];

    protected $casts = [
        'context' => 'array',
        'trace_excerpt' => 'array',
        'resolved_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_id');
    }
}
