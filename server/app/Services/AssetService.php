<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\Employee;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetService
{
    /**
     * @param array<string, mixed> $data
     */
    public function create(User $actor, array $data): Asset
    {
        $status = $data['status'] ?? 'available';

        if ($status === 'assigned' && empty($data['assigned_to_employee_id'])) {
            throw ValidationException::withMessages([
                'assigned_to_employee_id' => ['An employee must be selected to mark an asset as assigned.'],
            ]);
        }

        $asset = DB::transaction(function () use ($actor, $data, $status): Asset {
            $asset = Asset::query()->create([
                'organization_id' => $actor->organization_id,
                'name' => $data['name'],
                'asset_tag' => $data['asset_tag'],
                'serial_number' => $data['serial_number'] ?? null,
                'asset_category_id' => $data['asset_category_id'],
                'status' => $status,
                'condition' => $data['condition'] ?? 'good',
                'assigned_to_employee_id' => $data['assigned_to_employee_id'] ?? null,
                'assigned_at' => $status === 'assigned' && ! empty($data['assigned_to_employee_id']) ? now() : null,
                'organization_location_id' => $data['organization_location_id'] ?? null,
                'purchase_date' => $data['purchase_date'] ?? null,
                'warranty_expires_at' => $data['warranty_expires_at'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            if ($asset->status === 'assigned' && $asset->assigned_to_employee_id) {
                $this->recordAssignment($asset, $actor, $asset->assigned_to_employee_id, $asset->condition, $data['notes'] ?? null);
            }

            return $asset;
        });

        return $this->loadAsset($asset);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(User $actor, Asset $asset, array $data): Asset
    {
        $nextStatus = $data['status'] ?? $asset->status;
        $nextEmployeeId = array_key_exists('assigned_to_employee_id', $data) ? $data['assigned_to_employee_id'] : $asset->assigned_to_employee_id;

        if ($nextStatus === 'assigned' && empty($nextEmployeeId)) {
            throw ValidationException::withMessages([
                'assigned_to_employee_id' => ['An employee must be selected to mark an asset as assigned.'],
            ]);
        }

        DB::transaction(function () use ($actor, $asset, &$data, $nextStatus, $nextEmployeeId): void {
            $previousEmployeeId = $asset->assigned_to_employee_id;
            $isDifferentEmployee = $nextEmployeeId !== $previousEmployeeId;

            if ($nextStatus === 'assigned') {
                $becomingAssigned = $asset->status !== 'assigned' || $isDifferentEmployee;
                $data['assigned_at'] = $becomingAssigned ? now() : $asset->assigned_at;

                if ($isDifferentEmployee && $previousEmployeeId) {
                    $this->closeOpenAssignment($asset, $actor, $data['condition'] ?? $asset->condition, 'Asset reassigned.');
                }
            } else {
                if ($asset->assigned_to_employee_id) {
                    $this->closeOpenAssignment($asset, $actor, $data['condition'] ?? $asset->condition, 'Asset unassigned.');
                }

                $data['assigned_to_employee_id'] = null;
                $data['assigned_at'] = null;
            }

            $asset->update($data);

            if ($nextStatus === 'assigned' && $nextEmployeeId && ($asset->status !== 'assigned' || $isDifferentEmployee)) {
                $asset->refresh();
                $this->recordAssignment($asset, $actor, $nextEmployeeId, $asset->condition, $data['notes'] ?? null);
            }
        });

        return $this->loadAsset($asset->refresh());
    }

    /**
     * @param array<string, mixed> $data
     */
    public function assign(User $actor, Asset $asset, array $data): Asset
    {
        if (in_array($asset->status, ['maintenance', 'retired'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only available or already assigned assets can be issued to an employee.'],
            ]);
        }

        $employee = Employee::query()
            ->where('organization_id', $asset->organization_id)
            ->findOrFail($data['employee_id']);

        return DB::transaction(function () use ($actor, $asset, $employee, $data): Asset {
            if ($asset->assigned_to_employee_id && $asset->assigned_to_employee_id !== $employee->id) {
                $this->closeOpenAssignment($asset, $actor, $data['condition'] ?? $asset->condition, 'Asset reassigned.');
            }

            $asset->update([
                'status' => 'assigned',
                'condition' => $data['condition'] ?? $asset->condition,
                'assigned_to_employee_id' => $employee->id,
                'assigned_at' => $data['assigned_at'] ?? now(),
            ]);

            if (! $asset->assignmentHistories()->whereNull('returned_at')->where('employee_id', $employee->id)->exists()) {
                $this->recordAssignment($asset->refresh(), $actor, $employee->id, $asset->condition, $data['note'] ?? null, $data['assigned_at'] ?? null);
            }

            return $this->loadAsset($asset->refresh());
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function returnFromEmployee(User $actor, Asset $asset, array $data): Asset
    {
        if (! $asset->assigned_to_employee_id) {
            throw ValidationException::withMessages([
                'assigned_to_employee_id' => ['This asset is not currently assigned to an employee.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $asset, $data): Asset {
            $nextStatus = $data['condition'] === 'damaged' ? 'maintenance' : 'available';

            $this->closeOpenAssignment($asset, $actor, $data['condition'], $data['note'] ?? null, $data['returned_at'] ?? null);

            $asset->update([
                'status' => $nextStatus,
                'condition' => $data['condition'],
                'assigned_to_employee_id' => null,
                'assigned_at' => null,
            ]);

            if ($nextStatus === 'maintenance') {
                $asset->incidents()->create([
                    'organization_id' => $asset->organization_id,
                    'reported_by_id' => $actor->id,
                    'event' => 'fault_reported',
                    'previous_status' => 'assigned',
                    'new_status' => 'maintenance',
                    'note' => $data['note'] ?? 'Asset returned as damaged.',
                ]);
            }

            return $this->loadAsset($asset->refresh());
        });
    }

    public function reportFault(User $actor, Asset $asset, string $note, ?Ticket $ticket = null): Asset
    {
        $previousStatus = $asset->status;

        $asset->update(['status' => 'maintenance']);

        $asset->incidents()->create([
            'organization_id' => $asset->organization_id,
            'reported_by_id' => $actor->id,
            'ticket_id' => $ticket?->id,
            'event' => 'fault_reported',
            'previous_status' => $previousStatus,
            'new_status' => 'maintenance',
            'note' => $note,
        ]);

        return $this->loadAsset($asset->refresh());
    }

    public function returnToService(User $actor, Asset $asset, string $note, ?Ticket $ticket = null): Asset
    {
        $previousStatus = $asset->status;
        $nextStatus = $asset->assigned_to_employee_id ? 'assigned' : 'available';

        $asset->update(['status' => $nextStatus]);

        $asset->incidents()->create([
            'organization_id' => $asset->organization_id,
            'reported_by_id' => $actor->id,
            'ticket_id' => $ticket?->id,
            'event' => 'returned_to_service',
            'previous_status' => $previousStatus,
            'new_status' => $nextStatus,
            'note' => $note,
        ]);

        return $this->loadAsset($asset->refresh());
    }

    private function recordAssignment(Asset $asset, User $actor, int $employeeId, ?string $condition, ?string $note, mixed $assignedAt = null): void
    {
        $asset->assignmentHistories()->create([
            'organization_id' => $asset->organization_id,
            'employee_id' => $employeeId,
            'assigned_by_id' => $actor->id,
            'assigned_at' => $assignedAt ?: now(),
            'issue_condition' => $condition,
            'issue_note' => $note,
        ]);
    }

    private function closeOpenAssignment(Asset $asset, User $actor, ?string $condition, ?string $note, mixed $returnedAt = null): void
    {
        $asset->assignmentHistories()
            ->whereNull('returned_at')
            ->latest('id')
            ->first()
            ?->update([
                'returned_by_id' => $actor->id,
                'returned_at' => $returnedAt ?: now(),
                'return_condition' => $condition,
                'return_note' => $note,
            ]);
    }

    private function loadAsset(Asset $asset): Asset
    {
        return $asset->load([
            'assignedTo',
            'category',
            'location',
            'assignmentHistories.employee',
            'assignmentHistories.assignedBy',
            'assignmentHistories.returnedBy',
        ]);
    }
}
