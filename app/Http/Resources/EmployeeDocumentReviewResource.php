<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmployeeDocumentReview */
class EmployeeDocumentReviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_document_id' => $this->employee_document_id,
            'action' => $this->action,
            'previous_status' => $this->previous_status,
            'next_status' => $this->next_status,
            'note' => $this->note,
            'reviewed_by' => $this->whenLoaded('reviewedBy', fn () => $this->reviewedBy ? [
                'id' => $this->reviewedBy->id,
                'name' => $this->reviewedBy->name,
                'email' => $this->reviewedBy->email,
            ] : null),
            'created_at' => $this->created_at,
        ];
    }
}
