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
            'serial_number' => $this->serial_number,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'code' => $this->category->code,
            ] : null),
            'status' => $this->status,
            'condition' => $this->condition,
            'assigned_to' => $this->whenLoaded('assignedTo', fn () => $this->assignedTo ? [
                'id' => $this->assignedTo->id,
                'employee_number' => $this->assignedTo->employee_number,
                'full_name' => trim($this->assignedTo->first_name.' '.$this->assignedTo->last_name),
            ] : null),
            'assigned_at' => $this->assigned_at,
            'location' => $this->whenLoaded('location', fn () => $this->location ? [
                'id' => $this->location->id,
                'code' => $this->location->code,
                'name' => $this->location->name,
            ] : null),
            'purchase_date' => $this->purchase_date,
            'warranty_expires_at' => $this->warranty_expires_at,
            'notes' => $this->notes,
            'assignment_history' => AssetAssignmentHistoryResource::collection($this->whenLoaded('assignmentHistories')),
            'tickets' => $this->whenLoaded('tickets', fn () => $this->tickets->map(fn ($ticket) => [
                'id' => $ticket->id,
                'subject' => $ticket->subject,
                'status' => $ticket->status,
                'submitted_at' => $ticket->submitted_at,
            ])),
            'incidents' => $this->whenLoaded('incidents', fn () => $this->incidents->map(fn ($incident) => [
                'id' => $incident->id,
                'event' => $incident->event,
                'previous_status' => $incident->previous_status,
                'new_status' => $incident->new_status,
                'note' => $incident->note,
                'ticket_id' => $incident->ticket_id,
                'reported_by' => $incident->reportedBy ? ['id' => $incident->reportedBy->id, 'name' => $incident->reportedBy->name] : null,
                'created_at' => $incident->created_at,
            ])),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
