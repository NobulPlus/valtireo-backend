<?php

namespace App\Http\Requests\ServiceDesk\Concerns;

trait AuthorizesServiceDeskAccess
{
    protected function hasServiceDeskAccess(): bool
    {
        return $this->user()?->can('service_desk.view') === true
            || $this->user()?->can('service_desk.create') === true
            || $this->user()?->employee?->status === 'active';
    }
}
