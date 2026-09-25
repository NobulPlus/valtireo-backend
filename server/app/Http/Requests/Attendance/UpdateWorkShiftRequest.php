<?php

namespace App\Http\Requests\Attendance;

use App\Models\WorkShift;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWorkShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('attendance.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var WorkShift|null $workShift */
        $workShift = $this->route('workShift');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'string',
                'max:50',
                Rule::unique('work_shifts', 'code')
                    ->where('organization_id', $this->user()?->organization_id)
                    ->ignore($workShift?->id),
            ],
            'starts_at' => ['sometimes', 'date_format:H:i'],
            'ends_at' => ['sometimes', 'date_format:H:i'],
            'break_minutes' => ['sometimes', 'integer', 'min:0', 'max:600'],
            'is_overnight' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
