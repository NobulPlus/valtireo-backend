<?php

namespace App\Http\Requests\Approvals;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreApprovalWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('approval_workflows.create') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'module' => ['required', 'string', 'max:100'],
            'action' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'require_note_on_reject' => ['sometimes', 'boolean'],
            'require_note_on_request_changes' => ['sometimes', 'boolean'],
            'auto_approve_when_no_steps' => ['sometimes', 'boolean'],
            'conditions' => ['nullable', 'array'],
            'steps' => ['sometimes', 'array'],
            'steps.*.step_order' => ['required_with:steps', 'integer', 'min:1', 'max:20'],
            'steps.*.name' => ['required_with:steps', 'string', 'max:255'],
            'steps.*.approver_type' => ['required_with:steps', Rule::in(['permission', 'role', 'direct_manager', 'department_head'])],
            'steps.*.approver_role' => ['nullable', 'string', 'max:255'],
            'steps.*.approver_permission' => ['nullable', 'string', 'max:255'],
            'steps.*.note_required' => ['sometimes', 'boolean'],
            'steps.*.is_active' => ['sometimes', 'boolean'],
            'steps.*.settings' => ['nullable', 'array'],
        ];
    }
}
