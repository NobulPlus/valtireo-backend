<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAppreciation extends Model
{
    protected $guarded = ['id'];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'sender_employee_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'recipient_employee_id');
    }
}
