<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ConnectMeeting extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return array_fill_keys(['starts_at', 'ends_at', 'started_at', 'ended_at', 'room_closed_at'], 'immutable_datetime');
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'connect_meeting_members', 'meeting_id', 'user_id')->withTimestamps();
    }

    public function roomName(): string
    {
        return 'connect-'.$this->id;
    }
}
