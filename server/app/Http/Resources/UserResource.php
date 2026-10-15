<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $photoPath = $this->whenLoaded('employee', fn () => $this->employee?->profile?->passport_photo_path);
        $employeeId = $this->whenLoaded('employee', fn () => $this->employee?->id);

        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at,
            // An authenticated, organization-scoped endpoint — never a public storage URL.
            'photo_url' => is_string($photoPath) && $employeeId ? url("/api/employees/{$employeeId}/photo") : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
