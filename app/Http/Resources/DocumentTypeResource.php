<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\DocumentType */
class DocumentTypeResource extends JsonResource
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
            'requires_expiry_date' => $this->requires_expiry_date,
            'default_reminder_days' => $this->default_reminder_days,
            'employee_upload_allowed' => $this->employee_upload_allowed,
            'approval_required' => $this->approval_required,
            'is_active' => $this->is_active,
            'requirements_count' => $this->whenCounted('requirements'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
