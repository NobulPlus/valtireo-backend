<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeavePeriod;
use App\Models\LeaveType;
use Illuminate\Support\Carbon;

class LeaveEntitlementProvisioningService
{
    /**
     * Grants the employee an entitlement, for the current leave period, for
     * every active leave type flagged auto_grant_on_activation. Employees who
     * already have an entitlement for a given type and period are left
     * untouched, so this is safe to call on every activation-lifecycle
     * transition (first activation, reactivation, probation, confirmation)
     * without ever double-granting or overwriting a manually set amount.
     *
     * @return array<int, LeaveEntitlement> the entitlements newly created
     */
    public function grantDefaultsForActivation(Employee $employee): array
    {
        $period = LeavePeriod::query()
            ->where('organization_id', $employee->organization_id)
            ->where('is_active', true)
            ->whereDate('starts_on', '<=', Carbon::today())
            ->whereDate('ends_on', '>=', Carbon::today())
            ->first();

        if (! $period) {
            return [];
        }

        $leaveTypes = LeaveType::query()
            ->where('organization_id', $employee->organization_id)
            ->where('is_active', true)
            ->where('auto_grant_on_activation', true)
            ->whereNotNull('default_days_per_year')
            ->get();

        if ($leaveTypes->isEmpty()) {
            return [];
        }

        $alreadyGrantedTypeIds = LeaveEntitlement::query()
            ->where('employee_id', $employee->id)
            ->where('leave_period_id', $period->id)
            ->pluck('leave_type_id');

        $created = [];

        foreach ($leaveTypes as $leaveType) {
            if ($alreadyGrantedTypeIds->contains($leaveType->id)) {
                continue;
            }

            $created[] = LeaveEntitlement::query()->create([
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'leave_period_id' => $period->id,
                'days_allocated' => $leaveType->default_days_per_year,
                'notes' => 'Granted automatically on activation.',
            ]);
        }

        return $created;
    }
}
