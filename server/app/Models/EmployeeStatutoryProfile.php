<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use OwenIt\Auditing\Auditable; use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
#[Fillable(['organization_id','employee_id','paye_enabled','tax_state','tax_id','pension_enabled','pfa_name','rsa_pin','nhf_enabled','nhf_number','reliefs','exemptions'])]
class EmployeeStatutoryProfile extends Model implements AuditableContract { use Auditable; protected $auditExclude=['tax_id','rsa_pin','nhf_number']; protected $hidden=['tax_id','rsa_pin','nhf_number']; public function employee(): BelongsTo{return $this->belongsTo(Employee::class);} protected function casts(): array{return ['paye_enabled'=>'boolean','pension_enabled'=>'boolean','nhf_enabled'=>'boolean','tax_id'=>'encrypted','rsa_pin'=>'encrypted','nhf_number'=>'encrypted','reliefs'=>'array','exemptions'=>'array'];} }
