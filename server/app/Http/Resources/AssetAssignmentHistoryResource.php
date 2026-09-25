<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AssetAssignmentHistory */
class AssetAssignmentHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'employee_id' => $this->employee_id,
            'asset' => $this->whenLoaded('asset', fn () => $this->asset ? [
                'id' => $this->asset->id,
                'name' => $this->asset->name,
                'asset_tag' => $this->asset->asset_tag,
                'status' => $this->asset->status,
            ] : null),
            'employee' => $this->whenLoaded('employee', fn () => $this->employee ? [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
            ] : null),
            'assigned_by' => $this->whenLoaded('assignedBy', fn () => $this->assignedBy ? [
                'id' => $this->assignedBy->id,
                'name' => $this->assignedBy->name,
            ] : null),
            'returned_by' => $this->whenLoaded('returnedBy', fn () => $this->returnedBy ? [
                'id' => $this->returnedBy->id,
                'name' => $this->returnedBy->name,
            ] : null),
            'assigned_at' => $this->assigned_at,
            'returned_at' => $this->returned_at,
            'issue_condition' => $this->issue_condition,
            'return_condition' => $this->return_condition,
            'issue_note' => $this->issue_note,
            'return_note' => $this->return_note,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
