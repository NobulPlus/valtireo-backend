<?php

namespace App\Http\Middleware;

use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeDependent;
use App\Models\EmployeeDocument;
use App\Models\EmployeeEmergencyContact;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Services\EmployeeVisibility;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureEmployeeVisibility
{
    public function handle(Request $request, Closure $next): Response
    {
        $actor = $request->user();
        $visibility = app(EmployeeVisibility::class);
        foreach ($request->route()->parameters() as $record) {
            if ($record instanceof Employee) {
                abort_unless($visibility->allows($actor, $record->id), 404);
            } elseif ($record instanceof EmployeeDocument || $record instanceof EmployeeDependent
                || $record instanceof EmployeeEmergencyContact || $record instanceof AttendanceRecord
                || $record instanceof AttendanceCorrectionRequest || $record instanceof LeaveEntitlement
                || $record instanceof LeaveRequest) {
                // Leave recipients retain the existing handover access; the controller
                // still distinguishes handover downloads from private evidence.
                $handover = $record instanceof LeaveRequest
                    && in_array($request->method(), ['GET', 'HEAD'], true)
                    && $record->organization_id === $actor->organization_id
                    && $actor->employee?->id === $record->handover_to_employee_id;
                abort_unless($handover || $visibility->allows($actor, $record->employee_id), 404);
            }
        }

        return $next($request);
    }
}
