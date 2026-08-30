<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Ticket */
class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'employee_id' => $this->employee_id,
            'requested_by_id' => $this->requested_by_id,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'code' => $this->category->code,
            ] : null),
            'asset' => $this->whenLoaded('asset', fn () => $this->asset ? [
                'id' => $this->asset->id,
                'name' => $this->asset->name,
                'asset_tag' => $this->asset->asset_tag,
            ] : null),
            'department' => $this->whenLoaded('department', fn () => $this->department ? [
                'id' => $this->department->id,
                'name' => $this->department->name,
                'code' => $this->department->code,
            ] : null),
            'subject' => $this->subject,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'escalation_level' => $this->escalation_level,
            'escalated_at' => $this->escalated_at,
            'sla_due_at' => $this->sla_due_at,
            'attachment_file_name' => $this->attachment_file_name,
            'attachment_mime_type' => $this->attachment_mime_type,
            'attachment_file_size' => $this->attachment_file_size,
            'attachment_download_url' => $this->attachment_file_path ? url("/api/tickets/{$this->id}/attachment/download") : null,
            'submitted_at' => $this->submitted_at,
            'reviewed_at' => $this->reviewed_at,
            'first_responded_at' => $this->first_responded_at,
            'resolved_at' => $this->resolved_at,
            'on_hold_at' => $this->on_hold_at,
            'hold_reason' => $this->hold_reason,
            'closed_at' => $this->closed_at,
            'satisfaction_rating' => $this->satisfaction_rating,
            'satisfaction_comment' => $this->satisfaction_comment,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
                'work_email' => $this->employee->work_email,
            ]),
            'requested_by' => $this->whenLoaded('requestedBy', fn () => $this->requestedBy ? [
                'id' => $this->requestedBy->id,
                'name' => $this->requestedBy->name,
                'email' => $this->requestedBy->email,
            ] : null),
            'assigned_to' => $this->whenLoaded('assignedTo', fn () => $this->assignedTo ? [
                'id' => $this->assignedTo->id,
                'name' => $this->assignedTo->name,
                'email' => $this->assignedTo->email,
            ] : null),
            'comments' => TicketCommentResource::collection($this->whenLoaded('comments', function () use ($request) {
                $canViewInternal = $request->user()?->can('service_desk.view') === true;

                return $this->comments
                    ->filter(fn ($comment) => $comment->visibility !== 'internal' || $canViewInternal)
                    ->values();
            })),
            'activities' => TicketActivityResource::collection($this->whenLoaded('activities', function () use ($request) {
                $canViewInternal = $request->user()?->can('service_desk.view') === true;

                return $this->activities
                    ->filter(fn ($activity) => $activity->visibility !== 'internal' || $canViewInternal)
                    ->values();
            })),
            'watchers' => TicketWatcherResource::collection($this->whenLoaded('watchers')),
            'approval_requests' => ApprovalRequestResource::collection($this->whenLoaded('approvalRequests')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
