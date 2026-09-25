<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TicketActivity */
class TicketActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event,
            'previous_status' => $this->previous_status,
            'new_status' => $this->new_status,
            'visibility' => $this->visibility,
            'note' => $this->note,
            'metadata' => $this->metadata,
            'actor' => $this->whenLoaded('actor', fn () => $this->actor ? [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
                'email' => $this->actor->email,
            ] : null),
            'created_at' => $this->created_at,
        ];
    }
}
