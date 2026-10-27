<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ConnectConversation extends Model
{
    use HasUuids;
    protected $guarded = ['id'];
    protected function casts(): array { return ['archived' => 'boolean']; }
    public function members() { return $this->belongsToMany(User::class, 'connect_members', 'conversation_id', 'user_id')->withPivot(['last_read_id', 'muted'])->withTimestamps(); }
    public function messages() { return $this->hasMany(ConnectMessage::class, 'conversation_id'); }
}
