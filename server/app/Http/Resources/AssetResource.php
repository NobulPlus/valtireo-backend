<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Asset */
class AssetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'name' => $this->name,
            'asset_tag' => $this->asset_tag,
            'category' => $this->category,
            'status' => $this->status,
            'assigned_to' => $this->whenLoaded('assignedTo', fn () => $this->assignedTo ? [
                'id' => $this->assignedTo->id,
                'employee_number' => $this->assignedTo->employee_number,
                'full_name' => trim($this->assignedTo->first_name.' '.$this->assignedTo->last_name),
            ] : null),
            'assigned_at' => $this->assigned_at,
            'notes' => $this->notes,
            'tickets' => $this->whenLoaded('tickets', fn () => $this->tickets->map(fn ($ticket) => [
                'id' => $ticket->id,
                'subject' => $ticket->subject,
                'status' => $ticket->status,
                'submitted_at' => $ticket->submitted_at,
            ])),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
