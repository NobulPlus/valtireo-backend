<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\LeaveHoliday */
class LeaveHolidayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'organization_location_id' => $this->organization_location_id,
            'name' => $this->name,
            'date' => $this->date,
            'is_recurring' => $this->is_recurring,
            'is_active' => $this->is_active,
            'location' => $this->whenLoaded('location', fn () => $this->location ? [
                'id' => $this->location->id,
                'code' => $this->location->code,
                'name' => $this->location->name,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
