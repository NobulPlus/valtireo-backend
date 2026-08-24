<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ApprovalWorkflowService
{
    /**
     * @param array<string, mixed> $data
     */
    public function create(User $actor, array $data): ApprovalWorkflow
    {
        return DB::transaction(function () use ($actor, $data): ApprovalWorkflow {
            $steps = $data['steps'] ?? [];
            unset($data['steps']);

            $workflow = ApprovalWorkflow::query()->create([
                'organization_id' => $actor->organization_id,
                ...$data,
            ]);

            $this->replaceSteps($workflow, $steps);

            return $workflow->load('steps.approverRole');
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(ApprovalWorkflow $workflow, array $data): ApprovalWorkflow
    {
        return DB::transaction(function () use ($workflow, $data): ApprovalWorkflow {
            $steps = $data['steps'] ?? null;
            unset($data['steps']);

            $workflow->update($data);

            if (is_array($steps)) {
                $workflow->steps()->delete();
                $this->replaceSteps($workflow, $steps);
            }

            return $workflow->refresh()->load('steps.approverRole');
        });
    }

    /**
     * @param array<int, array<string, mixed>> $steps
     */
    private function replaceSteps(ApprovalWorkflow $workflow, array $steps): void
    {
        foreach ($steps as $step) {
            $workflow->steps()->create($step);
        }
    }

    /**
     * @return Collection<int, ApprovalWorkflow>
     */
    public function activeFor(User $actor, string $module, string $action): Collection
    {
        return ApprovalWorkflow::query()
            ->where('organization_id', $actor->organization_id)
            ->where('module', $module)
            ->where('action', $action)
            ->where('is_active', true)
            ->with('steps')
            ->get();
    }
}
