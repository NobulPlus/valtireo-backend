<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EmployeeProfileActivityResource;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeProfileActivityController extends Controller
{
    public function index(Request $request, Employee $employee): AnonymousResourceCollection
    {
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('employees.view'), 403);

        return EmployeeProfileActivityResource::collection(
            $employee->profileActivities()->with('actor')->paginate(min(max($request->integer('per_page', 15), 1), 100))
        );
    }

    public function myIndex(Request $request): AnonymousResourceCollection
    {
        $employee = $request->user()->employee()->firstOrFail();

        return EmployeeProfileActivityResource::collection(
            $employee->profileActivities()->with('actor')->paginate(min(max($request->integer('per_page', 15), 1), 100))
        );
    }
}
