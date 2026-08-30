<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TicketCategory */
class TicketCategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'response_sla_hours' => $this->response_sla_hours,
            'resolution_sla_hours' => $this->resolution_sla_hours,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
