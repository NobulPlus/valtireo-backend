<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Models\EmployeeProfile */
class EmployeeProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'date_of_birth' => $this->date_of_birth,
            'gender' => $this->gender,
            'personal_email' => $this->personal_email,
            'residential_address' => $this->residential_address,
            'next_of_kin_name' => $this->next_of_kin_name,
            'next_of_kin_phone' => $this->next_of_kin_phone,
            'passport_photo_path' => $this->passport_photo_path,
            'passport_photo_url' => $this->passport_photo_path ? Storage::disk('public')->url($this->passport_photo_path) : null,
            'completion_status' => $this->completion_status,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
