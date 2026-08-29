<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Employee */
class EmployeeDirectoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => trim($this->first_name.' '.$this->last_name),
            'employee_number' => $this->employee_number,
            'work_email' => $this->work_email,
            'phone' => $this->phone,
            'department' => $this->department ? [
                'id' => $this->department->id,
                'name' => $this->department->name,
            ] : null,
            'unit' => $this->unit ? [
                'id' => $this->unit->id,
                'name' => $this->unit->name,
            ] : null,
            'designation' => $this->designation?->name,
            'location' => $this->location?->name,
        ];
    }
}
