<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SystemErrorLog */
class SystemErrorLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'level' => $this->level,
            'status_code' => $this->status_code,
            'exception_class' => $this->exception_class,
            'message' => 'Unhandled '.$this->exception_class,
            'file' => $this->file,
            'line' => $this->line,
            'method' => $this->method,
            'url' => null,
            'route' => null,
            'ip_address' => $this->ip_address,
            'user_agent' => null,
            'request_id' => null,
            'fingerprint' => $this->fingerprint,
            'context' => ['privacy_version' => 2],
            'trace_excerpt' => $this->trace_excerpt,
            'is_resolved' => $this->resolved_at !== null,
            'resolved_at' => $this->resolved_at,
            'resolution_note' => $this->resolution_note,
            'organization' => $this->whenLoaded('organization', fn () => $this->organization ? [
                'id' => $this->organization->id,
                'name' => $this->organization->name,
                'code' => $this->organization->code,
            ] : null),
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null),
            'resolved_by' => $this->whenLoaded('resolvedBy', fn () => $this->resolvedBy ? [
                'id' => $this->resolvedBy->id,
                'name' => $this->resolvedBy->name,
                'email' => $this->resolvedBy->email,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
