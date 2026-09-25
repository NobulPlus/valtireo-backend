<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\OrganizationVerificationDocument */
class OrganizationVerificationDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'document_type' => $this->document_type,
            'document_type_label' => str($this->document_type)->replace('_', ' ')->title()->toString(),
            'title' => $this->title,
            'file_name' => $this->file_name,
            'download_url' => url("/api/organization-verification/documents/{$this->id}/download"),
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            'status' => $this->status,
            'notes' => $this->notes,
            'review_note' => $this->review_note,
            'submitted_at' => $this->submitted_at,
            'reviewed_at' => $this->reviewed_at,
            'uploaded_by' => $this->whenLoaded('uploadedBy', fn () => $this->uploadedBy ? [
                'id' => $this->uploadedBy->id,
                'name' => $this->uploadedBy->name,
                'email' => $this->uploadedBy->email,
            ] : null),
            'reviewed_by' => $this->whenLoaded('reviewedBy', fn () => $this->reviewedBy ? [
                'id' => $this->reviewedBy->id,
                'name' => $this->reviewedBy->name,
                'email' => $this->reviewedBy->email,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
