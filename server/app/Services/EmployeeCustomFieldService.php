<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeCustomField;
use App\Models\EmployeeCustomFieldValue;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class EmployeeCustomFieldService
{
    public function __construct(private readonly EmployeeProfileActivityService $activities)
    {
    }

    /**
     * @param array<int, array<string, mixed>> $values
     * @return Collection<int, EmployeeCustomFieldValue>
     */
    public function upsertValues(User $actor, Employee $employee, array $values, bool $selfService = false): Collection
    {
        if ($employee->organization_id !== $actor->organization_id) {
            abort(404);
        }

        return DB::transaction(function () use ($actor, $employee, $values, $selfService): Collection {
            $saved = collect();

            foreach ($values as $item) {
                $field = $this->resolveField($actor, $item, $selfService);
                $value = $this->normalizeValue($field, $item['value'] ?? null);

                $record = EmployeeCustomFieldValue::query()->updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'employee_custom_field_id' => $field->id,
                    ],
                    [
                        'organization_id' => $employee->organization_id,
                        'updated_by_id' => $actor->id,
                        'value' => $value,
                    ]
                );

                $saved->push($record->load(['field', 'updatedBy']));
            }

            if ($saved->isNotEmpty()) {
                $this->activities->record(
                    $employee,
                    $actor,
                    'custom_fields_updated',
                    'Custom profile fields updated',
                    $selfService ? 'Employee updated custom profile information.' : 'HR updated custom profile information.',
                    null,
                    ['field_keys' => $saved->pluck('field.key')->values()->all()]
                );
            }

            return $saved;
        });
    }

    /**
     * @param array<string, mixed> $item
     */
    private function resolveField(User $actor, array $item, bool $selfService): EmployeeCustomField
    {
        $query = EmployeeCustomField::query()
            ->where('organization_id', $actor->organization_id)
            ->where('is_active', true);

        if (! empty($item['field_id'])) {
            $query->whereKey($item['field_id']);
        } else {
            $query->where('key', $item['key'] ?? '');
        }

        $field = $query->firstOrFail();

        if ($selfService && (! $field->visible_to_employee || ! $field->editable_by_employee)) {
            throw ValidationException::withMessages([
                'values' => ["The {$field->key} field cannot be updated by employees."],
            ]);
        }

        return $field;
    }

    private function normalizeValue(EmployeeCustomField $field, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            if ($field->is_required) {
                throw ValidationException::withMessages([
                    'values' => ["The {$field->key} field is required."],
                ]);
            }

            return null;
        }

        if ($field->type === 'boolean') {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ? '1' : '0';
        }

        if ($field->type === 'number' && ! is_numeric($value)) {
            throw ValidationException::withMessages([
                'values' => ["The {$field->key} field must be numeric."],
            ]);
        }

        if (in_array($field->type, ['select', 'multi_select'], true) && $field->options) {
            $allowed = collect($field->options)->map(fn ($option) => is_array($option) ? ($option['value'] ?? $option['label'] ?? null) : $option)
                ->filter()
                ->map(fn ($option) => (string) $option)
                ->values();
            $submitted = $field->type === 'multi_select' ? collect((array) $value)->map(fn ($item) => (string) $item) : collect([(string) $value]);

            if ($submitted->diff($allowed)->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'values' => ["The {$field->key} field contains an invalid option."],
                ]);
            }

            return $field->type === 'multi_select' ? json_encode($submitted->values()->all()) : $submitted->first();
        }

        if (is_array($value)) {
            return json_encode($value);
        }

        return (string) $value;
    }
}
