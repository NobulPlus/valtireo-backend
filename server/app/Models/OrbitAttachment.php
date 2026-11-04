<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'work_item_id', 'comment_id', 'uploaded_by_id', 'file_name', 'file_path', 'mime_type', 'file_size', 'deleted_at'])]
class OrbitAttachment extends Model
{
    use BelongsToOrganization;

    /**
     * Raw storage path never leaves the API — same convention as
     * ConnectMessage::$hidden = ['file_path']. Files are served only
     * through the authenticated OrbitAttachmentController::file() route.
     */
    protected $hidden = ['file_path'];

    public function workItem(): BelongsTo
    {
        return $this->belongsTo(OrbitWorkItem::class, 'work_item_id');
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(OrbitComment::class, 'comment_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }

    protected function casts(): array
    {
        return ['file_size' => 'integer', 'deleted_at' => 'datetime'];
    }
}
