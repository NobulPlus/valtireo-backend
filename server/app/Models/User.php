<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['organization_id', 'name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements AuditableContract
{
    /** @use HasFactory<UserFactory> */
    use Auditable, HasApiTokens, HasFactory, HasRoles, Notifiable {
        HasApiTokens::createToken as private createUncheckedToken;
    }

    protected $auditExclude = ['password', 'remember_token'];

    public function createToken(string $name, array $abilities = ['*'], ?\DateTimeInterface $expiresAt = null): \Laravel\Sanctum\NewAccessToken
    {
        return \Illuminate\Support\Facades\DB::transaction(function () use ($name, $abilities, $expiresAt) {
            // Serialize token issuance with employee suspension/exit. A login
            // that started before revocation must not mint a token afterwards.
            $this->employee()->lockForUpdate()->first();
            if ($this->accessIsBlocked()) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'email' => ['The provided credentials are incorrect.'],
                ]);
            }

            return $this->createUncheckedToken($name, $abilities, $expiresAt);
        });
    }

    public function accessIsBlocked(): bool
    {
        return $this->organization()->whereIn('status', ['suspended', 'rejected'])->exists()
            || $this->employee()->whereIn('status', ['suspended', 'exited'])->exists();
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_platform_admin' => 'boolean',
        ];
    }
}
