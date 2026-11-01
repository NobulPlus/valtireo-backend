<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConnectMessage extends Model
{
    protected $guarded = ['id'];
    protected $hidden = ['file_path'];
    protected function casts(): array { return ['mentions' => 'array', 'pinned' => 'boolean', 'voice_note' => 'boolean', 'deleted_at' => 'datetime', 'edited_at' => 'datetime']; }
    public function sender() { return $this->belongsTo(User::class, 'sender_id'); }
    public function conversation() { return $this->belongsTo(ConnectConversation::class, 'conversation_id'); }
    public function replyTo() { return $this->belongsTo(self::class, 'reply_to_id'); }
}
