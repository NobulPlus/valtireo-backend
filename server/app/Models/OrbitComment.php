<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['organization_id', 'work_item_id', 'author_id', 'body', 'reply_to_id', 'mentions', 'edited_at', 'deleted_at'])]
class OrbitComment extends Model
{
    use BelongsToOrganization;

    public function workItem(): BelongsTo
    {
        return $this->belongsTo(OrbitWorkItem::class, 'work_item_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'reply_to_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(OrbitAttachment::class, 'comment_id');
    }

    protected function casts(): array
    {
        return ['mentions' => 'array', 'edited_at' => 'datetime', 'deleted_at' => 'datetime'];
    }
}
