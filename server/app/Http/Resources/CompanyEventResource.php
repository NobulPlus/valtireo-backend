<?php

namespace App\Http\Resources;

use App\Services\CompanyEventService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\CompanyEvent */
class CompanyEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'department_id' => $this->department_id,
            'title' => $this->title,
            'description' => $this->description,
            'starts_on' => $this->starts_on,
            'ends_on' => $this->ends_on,
            'is_active' => $this->is_active,
            'scope' => $this->department_id ? 'department' : 'organization',
            'can_manage' => $request->user()
                ? app(CompanyEventService::class)->canManage($request->user(), $this->resource)
                : false,
            'department' => $this->whenLoaded('department', fn () => $this->department ? [
                'id' => $this->department->id,
                'code' => $this->department->code,
                'name' => $this->department->name,
            ] : null),
            'created_by' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'name' => $this->createdBy->name,
                'email' => $this->createdBy->email,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
