<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\EmployeeDocument;
use App\Models\LeaveRequest;
use App\Models\OperationTask;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkItemLink;
use App\Models\Ticket;
use App\Services\OrbitAuthorizationService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The sharpest permission rule in Orbit (see docs/orbit/06 §7): seeing a
 * link must never grant access to the linked record. index() therefore
 * returns metadata only, and withholds the label itself — not just the
 * underlying record — whenever the viewer lacks permission for it, so a
 * forbidden link can never leak the linked record's title through the
 * link response.
 */
class OrbitWorkItemLinkController extends Controller
{
    private const LINK_TYPES = [
        'ticket' => ['model' => Ticket::class, 'permission' => 'service_desk.view', 'employee_column' => 'employee_id', 'label' => 'subject', 'url' => '/service-desk?ticket=%d'],
        'asset' => ['model' => Asset::class, 'permission' => 'assets.view', 'employee_column' => 'assigned_to_employee_id', 'label' => 'name', 'url' => '/settings/assets?asset=%d'],
        'document' => ['model' => EmployeeDocument::class, 'permission' => 'employee_documents.view', 'employee_column' => 'employee_id', 'label' => 'title', 'url' => null],
        'leave_request' => ['model' => LeaveRequest::class, 'permission' => 'leave_requests.view', 'employee_column' => 'employee_id', 'label' => null, 'url' => '/leave?request=%d'],
        'operation_task' => ['model' => OperationTask::class, 'permission' => 'operations.view', 'employee_column' => 'subject_employee_id', 'label' => 'title', 'url' => null],
    ];

    public function __construct(private readonly OrbitAuthorizationService $auth)
    {
    }

    public function index(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $workItem->project), 404);

        $links = $workItem->links()->get()->map(function (OrbitWorkItemLink $link) use ($user) {
            $resolved = $this->resolve($link, $user);

            return [
                'id' => $link->id,
                'linked_type' => $link->linked_type,
                'linked_id' => $link->linked_id,
                'label' => $resolved['can_access'] ? $resolved['label'] : null,
                'url' => $resolved['can_access'] ? $resolved['url'] : null,
                'viewer_can_access' => $resolved['can_access'],
            ];
        });

        return response()->json(['data' => $links]);
    }

    public function store(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $workItem->project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $workItem->project), 403);

        $data = $request->validate([
            'linked_type' => ['required', Rule::in(array_keys(self::LINK_TYPES))],
            'linked_id' => ['required', 'integer'],
        ]);

        $config = self::LINK_TYPES[$data['linked_type']];
        /** @var Model $record */
        $record = $config['model']::query()->where('organization_id', $user->organization_id)->find($data['linked_id']);

        abort_unless($record, 422, 'That record was not found in this organization.');

        $link = OrbitWorkItemLink::firstOrCreate(
            ['work_item_id' => $workItem->id, 'linked_type' => $data['linked_type'], 'linked_id' => $data['linked_id']],
            ['organization_id' => $user->organization_id, 'created_by_id' => $user->id]
        );

        return response()->json(['link' => $link], 201);
    }

    public function destroy(Request $request, OrbitWorkItemLink $link): JsonResponse
    {
        $user = $request->user();
        $workItem = $link->workItem;
        abort_unless($this->auth->canViewProject($user, $workItem->project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $workItem->project), 403);

        $link->delete();

        return response()->json(['message' => 'Link removed.']);
    }

    /**
     * @return array{can_access: bool, label: ?string, url: ?string}
     */
    private function resolve(OrbitWorkItemLink $link, \App\Models\User $user): array
    {
        $config = self::LINK_TYPES[$link->linked_type] ?? null;

        if (! $config) {
            return ['can_access' => false, 'label' => null, 'url' => null];
        }

        /** @var Model|null $record */
        $record = $config['model']::query()->where('organization_id', $user->organization_id)->find($link->linked_id);

        if (! $record) {
            return ['can_access' => false, 'label' => null, 'url' => null];
        }

        $isOwnRecord = $config['employee_column'] && $record->{$config['employee_column']} === $user->employee?->id;
        $canAccess = $user->can($config['permission']) || $isOwnRecord;

        if (! $canAccess) {
            return ['can_access' => false, 'label' => null, 'url' => null];
        }

        return [
            'can_access' => true,
            'label' => $config['label'] ? (string) $record->{$config['label']} : null,
            'url' => $config['url'] ? sprintf($config['url'], $record->id) : null,
        ];
    }
}
