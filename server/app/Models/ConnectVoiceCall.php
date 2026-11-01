<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ConnectVoiceCall extends Model
{
    use HasUuids;
    protected $guarded = ['id'];
    protected function casts(): array { return array_fill_keys(['expires_at', 'accepted_at', 'ended_at', 'room_closed_at'], 'immutable_datetime'); }
    public function roomName(): string { return 'connect-voice-'.$this->id; }
    public function caller() { return $this->belongsTo(User::class, 'caller_id'); }
    public function callee() { return $this->belongsTo(User::class, 'callee_id'); }
    public function conversation() { return $this->belongsTo(ConnectConversation::class, 'conversation_id'); }
}
