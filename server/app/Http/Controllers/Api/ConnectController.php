<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConnectMeeting;
use App\Models\Employee;
use App\Models\User;
use App\Notifications\ValtireoNotification;
use App\Services\ConnectMediaService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ConnectController extends Controller
{
    public function __construct(private readonly ConnectMediaService $media) {}

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user->organization_id && Employee::where('organization_id', $user->organization_id)->where('user_id', $user->id)->where('status', 'active')->exists(), 403, 'Connect requires an active employee account.');

        return $user;
    }

    private function visible(User $user)
    {
        return ConnectMeeting::where('organization_id', $user->organization_id)
            ->whereHas('members', fn ($query) => $query->where('users.id', $user->id));
    }

    private function summary(ConnectMeeting $meeting, User $user): array
    {
        return [
            'id' => $meeting->id, 'title' => $meeting->title, 'description' => $meeting->description,
            'status' => $meeting->status, 'starts_at' => $meeting->starts_at->toIso8601String(),
            'ends_at' => $meeting->ends_at->toIso8601String(), 'is_host' => $meeting->host_user_id === $user->id,
            'host' => ['id' => $meeting->host_user_id, 'name' => $meeting->host->name],
            'members' => $meeting->members->map(fn ($member) => ['id' => $member->id, 'name' => $member->name])->values(),
            'room_close_pending' => $meeting->started_at !== null && $meeting->ended_at !== null && $meeting->room_closed_at === null,
        ];
    }

    public function index(Request $request)
    {
        $user = $this->actor($request);
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);
        $meetings = $this->visible($user)->with(['host', 'members'])->orderByDesc('starts_at')->paginate(15)
            ->through(fn ($meeting) => $this->summary($meeting, $user));

        return response()->json(['meetings' => $meetings, 'media_ready' => $this->media->ready()]);
    }

    public function people(Request $request)
    {
        $user = $this->actor($request);
        $data = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'page' => ['sometimes', 'integer', 'min:1']]);

        return response()->json(User::where('organization_id', $user->organization_id)->whereKeyNot($user->id)
            ->whereHas('employee', fn ($query) => $query->where('organization_id', $user->organization_id)->where('status', 'active'))
            ->when($data['search'] ?? null, fn ($query, $search) => $query->where('name', 'like', '%'.$search.'%'))
            ->orderBy('name')->orderBy('id')->paginate(20, ['id', 'name']));
    }

    public function store(Request $request)
    {
        $user = $this->actor($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'], 'description' => ['nullable', 'string', 'max:2000'],
            'starts_at' => ['nullable', 'date', 'after_or_equal:now'],
            'duration_minutes' => ['required', 'integer', 'min:15', 'max:480'],
            'member_ids' => ['required', 'array', 'min:1', 'max:24'],
            'member_ids.*' => ['required', 'integer', 'distinct'],
        ]);
        if (trim($data['title']) === '') {
            throw ValidationException::withMessages(['title' => 'Enter a meeting title.']);
        }
        $ids = collect($data['member_ids'])->map(fn ($id) => (int) $id)->unique();
        $valid = User::where('organization_id', $user->organization_id)->whereKeyNot($user->id)->whereIn('id', $ids)
            ->whereHas('employee', fn ($query) => $query->where('organization_id', $user->organization_id)->where('status', 'active'))->count();
        if ($valid !== $ids->count()) {
            throw ValidationException::withMessages(['member_ids' => 'Choose other active employees from your organization.']);
        }
        $meeting = DB::transaction(function () use ($user, $data, $ids) {
            $start = isset($data['starts_at']) ? CarbonImmutable::parse($data['starts_at'])->utc() : CarbonImmutable::now();
            $meeting = ConnectMeeting::create([
                'organization_id' => $user->organization_id, 'host_user_id' => $user->id,
                'title' => trim($data['title']), 'description' => $data['description'] ?? null,
                'starts_at' => $start, 'ends_at' => $start->addMinutes($data['duration_minutes']),
            ]);
            $meeting->members()->attach($ids->push($user->id)->all());
            foreach ($ids->reject(fn ($id) => $id === $user->id) as $id) {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(), 'type' => ValtireoNotification::class,
                    'notifiable_type' => User::class, 'notifiable_id' => $id,
                    'data' => json_encode(['organization_id' => $user->organization_id, 'category' => 'connect', 'event' => 'connect.invited',
                        'severity' => 'info', 'title' => 'Meeting invitation', 'message' => 'You have been invited to a Connect meeting.',
                        'action_label' => 'Open meeting', 'action_url' => '/connect/'.$meeting->id, 'entity_type' => 'connect_meeting', 'entity_id' => $meeting->id]),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }

            return $meeting;
        });

        return response()->json(['data' => $this->summary($meeting->load(['host', 'members']), $user)], 201);
    }

    public function show(Request $request, string $meeting)
    {
        $user = $this->actor($request);

        return response()->json(['data' => $this->summary($this->visible($user)->with(['host', 'members'])->findOrFail($meeting), $user), 'media_ready' => $this->media->ready()]);
    }

    public function join(Request $request, string $meeting)
    {
        $user = $this->actor($request);

        return DB::transaction(function () use ($user, $meeting) {
            $record = $this->visible($user)->lockForUpdate()->findOrFail($meeting);
            abort_unless(in_array($record->status, ['scheduled', 'live']), 409, 'This meeting has ended or was cancelled.');
            abort_if(now()->lt($record->starts_at->subMinutes(15)), 409, 'You can join 15 minutes before the scheduled start.');
            abort_if(now()->gte($record->ends_at), 409, 'The joining window for this meeting has ended.');
            if ($record->status === 'scheduled') {
                abort_unless($record->host_user_id === $user->id, 409, 'Waiting for the host to start the meeting.');
                $this->media->createRoom($record);
                $record->update(['status' => 'live', 'started_at' => now()]);
            }
            $token = $this->media->joinToken($record, $user);
            DB::table('connect_meeting_members')->where('meeting_id', $record->id)->where('user_id', $user->id)->update(['last_join_requested_at' => now()]);

            return response()->json(['token' => $token, 'server_url' => config('connect.url')])->header('Cache-Control', 'no-store, private');
        });
    }

    public function end(Request $request, string $meeting)
    {
        $user = $this->actor($request);
        // Commit the closed state before contacting media. Failed room deletion stays retryable,
        // and new join credentials must never be issued after a host has ended the meeting.
        $record = DB::transaction(function () use ($user, $meeting) {
            $record = $this->visible($user)->lockForUpdate()->findOrFail($meeting);
            abort_unless($record->host_user_id === $user->id, 403, 'Only the host can end this meeting.');
            if (! $record->ended_at) {
                $record->update(['status' => $record->started_at ? 'ended' : 'cancelled', 'ended_at' => now()]);
            }

            return $record;
        });
        if ($record->started_at && ! $record->room_closed_at) {
            $this->media->closeRoom($record);
            $record->update(['room_closed_at' => now()]);
        }

        return response()->json(['data' => $this->summary($record->load(['host', 'members']), $user)]);
    }
}
