<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\User;
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

        $asset = Asset::query()->create([
            'organization_id' => $actor->organization_id,
            'name' => $data['name'],
            'asset_tag' => $data['asset_tag'],
            'category' => $data['category'],
            'status' => $status,
            'assigned_to_employee_id' => $data['assigned_to_employee_id'] ?? null,
            'assigned_at' => $status === 'assigned' && ! empty($data['assigned_to_employee_id']) ? now() : null,
            'notes' => $data['notes'] ?? null,
        ]);

        return $asset->load('assignedTo');
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(Asset $asset, array $data): Asset
    {
        $nextStatus = $data['status'] ?? $asset->status;
        $nextEmployeeId = array_key_exists('assigned_to_employee_id', $data) ? $data['assigned_to_employee_id'] : $asset->assigned_to_employee_id;

        if ($nextStatus === 'assigned' && empty($nextEmployeeId)) {
            throw ValidationException::withMessages([
                'assigned_to_employee_id' => ['An employee must be selected to mark an asset as assigned.'],
            ]);
        }

        if ($nextStatus === 'assigned') {
            $becomingAssigned = $asset->status !== 'assigned' || $nextEmployeeId !== $asset->assigned_to_employee_id;
            $data['assigned_at'] = $becomingAssigned ? now() : $asset->assigned_at;
        } else {
            $data['assigned_to_employee_id'] = null;
            $data['assigned_at'] = null;
        }

        $asset->update($data);

        return $asset->refresh()->load('assignedTo');
    }
}
