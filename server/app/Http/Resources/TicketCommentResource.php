<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TicketComment */
class TicketCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null),
            'comment' => $this->comment,
            'visibility' => $this->visibility,
            'attachment_file_name' => $this->attachment_file_name,
            'attachment_mime_type' => $this->attachment_mime_type,
            'attachment_file_size' => $this->attachment_file_size,
            'attachment_download_url' => $this->attachment_file_path ? url("/api/tickets/{$this->ticket_id}/comments/{$this->id}/attachment/download") : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
