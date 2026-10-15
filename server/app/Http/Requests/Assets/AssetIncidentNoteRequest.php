<?php

namespace App\Http\Requests\Assets;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;

/** Shared by reportFault (an employee may report a fault on their own assigned asset) and returnToService (manager-only — gated separately in AssetController). */
class AssetIncidentNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->user()?->can('assets.update') === true) {
            return true;
        }

        $asset = $this->route('asset');

        return $asset instanceof Asset && $asset->assigned_to_employee_id === $this->user()?->employee?->id;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'note' => ['required', 'string', 'max:2000'],
        ];
    }
}
