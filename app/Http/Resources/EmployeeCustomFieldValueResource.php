<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmployeeCustomFieldValue */
class EmployeeCustomFieldValueResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'employee_id' => $this->employee_id,
            'employee_custom_field_id' => $this->employee_custom_field_id,
            'field' => $this->whenLoaded('field', fn () => [
                'id' => $this->field->id,
                'name' => $this->field->name,
                'key' => $this->field->key,
                'type' => $this->field->type,
                'options' => $this->field->options ?? [],
                'is_required' => $this->field->is_required,
                'visible_to_employee' => $this->field->visible_to_employee,
                'editable_by_employee' => $this->field->editable_by_employee,
                'sort_order' => $this->field->sort_order,
            ]),
            'value' => $this->value,
            'updated_by' => $this->whenLoaded('updatedBy', fn () => $this->updatedBy ? [
                'id' => $this->updatedBy->id,
                'name' => $this->updatedBy->name,
                'email' => $this->updatedBy->email,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
