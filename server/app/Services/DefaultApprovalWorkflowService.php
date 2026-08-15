<?php

namespace App\Services;

use App\Models\Organization;

class DefaultApprovalWorkflowService
{
    public function seedForOrganization(Organization $organization): void
    {
        $workflow = $organization->approvalWorkflows()->firstOrCreate(
            [
                'module' => 'employee_documents',
                'action' => 'submit',
                'name' => 'Employee document review',
            ],
            [
                'description' => 'Default approval flow for submitted employee documents.',
                'is_active' => true,
                'require_note_on_reject' => true,
                'require_note_on_request_changes' => true,
                'auto_approve_when_no_steps' => false,
            ]
        );

        $workflow->steps()->firstOrCreate(
            ['step_order' => 1],
            [
                'name' => 'HR or compliance review',
                'approver_type' => 'permission',
                'approver_permission' => 'employee_documents.update',
                'note_required' => false,
                'is_active' => true,
            ]
        );

        $leaveWorkflow = $organization->approvalWorkflows()->firstOrCreate(
            [
                'module' => 'leave',
                'action' => 'submit',
                'name' => 'Leave request approval',
            ],
            [
                'description' => 'Default approval flow for employee leave requests.',
                'is_active' => true,
                'require_note_on_reject' => true,
                'require_note_on_request_changes' => true,
                'auto_approve_when_no_steps' => false,
            ]
        );

        $leaveWorkflow->steps()->firstOrCreate(
            ['step_order' => 1],
            [
                'name' => 'Manager or HR approval',
                'approver_type' => 'permission',
                'approver_permission' => 'leave_requests.approve',
                'note_required' => false,
                'is_active' => true,
            ]
        );

        $attendanceWorkflow = $organization->approvalWorkflows()->firstOrCreate(
            [
                'module' => 'attendance',
                'action' => 'correction',
                'name' => 'Attendance correction approval',
            ],
            [
                'description' => 'Default approval flow for attendance correction requests.',
                'is_active' => true,
                'require_note_on_reject' => true,
                'require_note_on_request_changes' => true,
                'auto_approve_when_no_steps' => false,
            ]
        );

        $attendanceWorkflow->steps()->firstOrCreate(
            ['step_order' => 1],
            [
                'name' => 'Manager or HR attendance review',
                'approver_type' => 'permission',
                'approver_permission' => 'attendance.update',
                'note_required' => false,
                'is_active' => true,
            ]
        );
    }
}
