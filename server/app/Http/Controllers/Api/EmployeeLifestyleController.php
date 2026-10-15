<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAppreciation;
use App\Services\EmployeeLifestyleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeLifestyleController extends Controller
{
    public function __construct(private readonly EmployeeLifestyleService $lifestyle) {}

    public function preferences(Request $request)
    {
        $employee = $this->lifestyle->employee($request->user());

        return response()->json(['preferences' => $this->lifestyle->preferences($employee), 'features' => [
            'milestones_enabled' => (bool) data_get($request->user()->organization->settings, 'lifestyle.milestones_enabled', false),
            'appreciation_enabled' => (bool) data_get($request->user()->organization->settings, 'lifestyle.appreciation_enabled', false),
        ]]);
    }

    public function updatePreferences(Request $request)
    {
        $employee = $this->lifestyle->employee($request->user());
        $data = $request->validate(array_fill_keys(array_keys(EmployeeLifestyleService::DEFAULTS), ['sometimes', 'boolean']));
        DB::transaction(function () use ($employee, $data) {
            Employee::whereKey($employee->id)->lockForUpdate()->firstOrFail();
            DB::table('employee_lifestyle_preferences')->upsert([
                ['employee_id' => $employee->id, ...$this->lifestyle->preferences($employee), ...$data, 'created_at' => now(), 'updated_at' => now()],
            ], ['employee_id'], [...array_keys(EmployeeLifestyleService::DEFAULTS), 'updated_at']);
            // Withdrawal is permanent for existing shared posts; re-enabling does not republish them.
            if ((array_key_exists('allow_shared_appreciation', $data) && ! $data['allow_shared_appreciation']) || (array_key_exists('receive_appreciation', $data) && ! $data['receive_appreciation'])) {
                EmployeeAppreciation::where('organization_id', $employee->organization_id)->where('recipient_employee_id', $employee->id)->where('visibility', 'shared')->update(['visibility' => 'private']);
            }
        });

        return $this->preferences($request);
    }

    public function milestones(Request $request)
    {
        $data = $request->validate(['days' => ['sometimes', 'integer', 'min:1', 'max:90']]);

        return response()->json(['data' => $this->lifestyle->milestones($request->user(), $data['days'] ?? 30)]);
    }

    public function recipients(Request $request)
    {
        $actor = $this->lifestyle->employee($request->user());
        $this->lifestyle->enabled($request->user(), 'appreciation');
        $data = $request->validate(['search' => ['sometimes', 'string', 'max:100'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $rows = Employee::where('organization_id', $actor->organization_id)->where('status', 'active')->whereKeyNot($actor->id)
            ->whereIn('id', DB::table('employee_lifestyle_preferences')->select('employee_id')->where('receive_appreciation', true))
            ->when($data['search'] ?? null, fn ($q, $term) => $q->where(fn ($names) => $names->where('first_name', 'like', "%{$term}%")->orWhere('last_name', 'like', "%{$term}%")))
            ->orderBy('first_name')->orderBy('id')->paginate($data['per_page'] ?? 25);
        $preferences = DB::table('employee_lifestyle_preferences')->whereIn('employee_id', $rows->getCollection()->modelKeys())->get()->keyBy('employee_id');

        return response()->json($rows->through(fn ($e) => [...$this->lifestyle->summary($e), 'allow_shared_appreciation' => (bool) $preferences[$e->id]->allow_shared_appreciation]));
    }

    public function index(Request $request)
    {
        $actor = $this->lifestyle->employee($request->user());
        $this->lifestyle->enabled($request->user(), 'appreciation');
        $data = $request->validate(['scope' => ['sometimes', Rule::in(['all', 'received', 'sent', 'shared'])], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $query = $this->lifestyle->visibleAppreciations($actor);
        match ($data['scope'] ?? 'all') {
            'received' => $query->where('recipient_employee_id', $actor->id),
            'sent' => $query->where('sender_employee_id', $actor->id),
            'shared' => $query->where('visibility', 'shared'),
            default => null,
        };

        return response()->json($query->orderByDesc('id')->paginate($data['per_page'] ?? 25)->through(fn ($row) => $this->lifestyle->appreciation($row)));
    }

    public function store(Request $request)
    {
        $actor = $this->lifestyle->employee($request->user());
        $this->lifestyle->enabled($request->user(), 'appreciation');
        $data = $request->validate(['recipient_employee_id' => ['required', 'integer'], 'message' => ['required', 'string', 'max:1000'], 'visibility' => ['sometimes', Rule::in(['private', 'shared'])]]);
        $record = DB::transaction(function () use ($actor, $data) {
            // Serialize sends and consent withdrawals for this recipient.
            $recipient = Employee::where('organization_id', $actor->organization_id)->where('status', 'active')->whereKey($data['recipient_employee_id'])->lockForUpdate()->first();
            if (! $recipient || $recipient->id === $actor->id) {
                throw ValidationException::withMessages(['recipient_employee_id' => 'Choose another active employee in your organization.']);
            }
            $preferences = $this->lifestyle->preferences($recipient);
            $visibility = $data['visibility'] ?? 'private';
            if (! $preferences['receive_appreciation'] || ($visibility === 'shared' && ! $preferences['allow_shared_appreciation'])) {
                throw ValidationException::withMessages(['recipient_employee_id' => 'This employee has not opted in to this type of appreciation.']);
            }

            $record = EmployeeAppreciation::create(['organization_id' => $actor->organization_id, 'sender_employee_id' => $actor->id, 'recipient_employee_id' => $recipient->id, 'message' => $data['message'], 'visibility' => $visibility]);
            if ($preferences['appreciation_notifications'] && $recipient->user_id) {
                // Database-only, no mail/push, and no private message content in the alert.
                DB::table('notifications')->insert([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'type' => \App\Notifications\ValtireoNotification::class,
                    'notifiable_type' => \App\Models\User::class,
                    'notifiable_id' => $recipient->user_id,
                    'data' => json_encode(['organization_id' => $actor->organization_id, 'category' => 'lifestyle', 'event' => 'appreciation.received', 'severity' => 'info', 'title' => 'You received appreciation', 'message' => 'Open Life at work to see your received messages.', 'action_label' => 'View appreciation', 'action_url' => '/me/lifestyle', 'entity_type' => 'employee_appreciation', 'entity_id' => $record->id]),
                    'read_at' => null, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            return $record;
        });

        return response()->json(['data' => $this->lifestyle->appreciation($record->load(['sender', 'recipient']))], 201);
    }

    public function destroy(Request $request, int $appreciation)
    {
        $actor = $this->lifestyle->employee($request->user());
        // Participants retain removal rights even while the organization disables the feature.
        $record = EmployeeAppreciation::where('organization_id', $actor->organization_id)->whereKey($appreciation)
            ->where(fn ($q) => $q->where('sender_employee_id', $actor->id)->orWhere('recipient_employee_id', $actor->id))->firstOrFail();
        $record->update(['hidden_at' => now(), 'hidden_by_user_id' => $request->user()->id, 'moderation_reason' => 'Removed by participant']);

        return response()->noContent();
    }

    public function report(Request $request, int $appreciation)
    {
        $actor = $this->lifestyle->employee($request->user());
        $this->lifestyle->enabled($request->user(), 'appreciation');
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $record = $this->lifestyle->visibleAppreciations($actor)->whereKey($appreciation)->firstOrFail();
        DB::table('employee_appreciation_reports')->upsert([['appreciation_id' => $record->id, 'reporter_employee_id' => $actor->id, 'reason' => $data['reason'], 'created_at' => now(), 'updated_at' => now()]], ['appreciation_id', 'reporter_employee_id'], ['reason', 'updated_at']);

        return response()->json(['message' => 'Report received. Reporting makes this message available to your organization moderator.']);
    }

    public function reports(Request $request)
    {
        abort_unless($request->user()->organization_id && $request->user()->can('workspace_settings.update'), 403);
        $data = $request->validate(['per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $rows = EmployeeAppreciation::with(['sender', 'recipient'])->where('organization_id', $request->user()->organization_id)
            ->whereIn('id', DB::table('employee_appreciation_reports')->select('appreciation_id'))->whereNull('hidden_at')->orderByDesc('id')->paginate($data['per_page'] ?? 25);
        $reports = DB::table('employee_appreciation_reports')->whereIn('appreciation_id', $rows->getCollection()->modelKeys())->get()->groupBy('appreciation_id');

        return response()->json($rows->through(fn ($row) => [...$this->lifestyle->appreciation($row), 'reports' => $reports[$row->id]->map(fn ($report) => ['id' => $report->id, 'reason' => $report->reason, 'created_at' => $report->created_at])->all()]));
    }

    public function moderate(Request $request, int $appreciation)
    {
        abort_unless($request->user()->organization_id && $request->user()->can('workspace_settings.update'), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $record = EmployeeAppreciation::where('organization_id', $request->user()->organization_id)->whereKey($appreciation)
            ->whereIn('id', DB::table('employee_appreciation_reports')->select('appreciation_id'))->firstOrFail();
        $record->update(['hidden_at' => now(), 'hidden_by_user_id' => $request->user()->id, 'moderation_reason' => $data['reason']]);

        return response()->noContent();
    }
}
