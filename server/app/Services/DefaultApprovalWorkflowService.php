<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Role;

class DefaultApprovalWorkflowService
{
    /**
     * Ticket category code -> role key it should route to by default.
     * Categories with no obvious single-role owner (Facilities, Other) fall
     * back to the generic 'service_desk.view' permission pool below.
     *
     * @var array<string, string>
     */
    private const CATEGORY_ROLE_MAP = [
        'IT' => 'ict_admin',
        'HR_POLICY' => 'hr_officer',
    ];

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

        // One workflow per active ticket category, keyed by (service_desk,
        // <lowercased category code>) — ApprovalRequestService::submit()
        // already looks up workflows purely on (module, action), so routing
        // a ticket to a different resolver pool per category is just a
        // matter of seeding one workflow per category action here. Depends
        // on the org's ticket categories already existing (seeded first, by
        // both OrganizationProvisioningService and DatabaseSeeder).
        foreach ($organization->ticketCategories()->where('is_active', true)->get() as $category) {
            $action = strtolower($category->code);

            $serviceDeskWorkflow = $organization->approvalWorkflows()->firstOrCreate(
                [
                    'module' => 'service_desk',
                    'action' => $action,
                    'name' => "Service desk – {$category->name} review",
                ],
                [
                    'description' => "Default approval flow for {$category->name} tickets.",
                    'is_active' => true,
                    'require_note_on_reject' => true,
                    'require_note_on_request_changes' => true,
                    'auto_approve_when_no_steps' => false,
                ]
            );

            $roleKey = self::CATEGORY_ROLE_MAP[$category->code] ?? null;
            $role = $roleKey
                ? Role::query()->where('organization_id', $organization->id)->where('key', $roleKey)->first()
                : null;

            $serviceDeskWorkflow->steps()->firstOrCreate(
                ['step_order' => 1],
                $role
                    ? [
                        'name' => "Routed to {$role->name}",
                        'approver_type' => 'role',
                        'approver_role_id' => $role->id,
                        'note_required' => false,
                        'is_active' => true,
                    ]
                    : [
                        'name' => 'Service desk review',
                        'approver_type' => 'permission',
                        'approver_permission' => 'service_desk.view',
                        'note_required' => false,
                        'is_active' => true,
                    ]
            );
        }
    }
}
