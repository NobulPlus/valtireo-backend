<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('currency', 3)->default('NGN');
            $table->unsignedTinyInteger('decimal_places')->default(2);
            $table->string('default_pay_frequency')->default('monthly');
            $table->unsignedTinyInteger('pay_day')->default(25);
            $table->boolean('prorate_joiners')->default(true);
            $table->boolean('prorate_leavers')->default(true);
            $table->string('proration_basis')->default('calendar_days');
            $table->json('statutory_rules')->nullable();
            $table->timestamps();
        });

        Schema::create('pay_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('frequency')->default('monthly');
            $table->unsignedTinyInteger('pay_day')->default(25);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['organization_id', 'code']);
        });

        Schema::create('payroll_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('type'); // earning, deduction, employer_contribution
            $table->string('calculation_type')->default('fixed'); // fixed, percentage
            $table->decimal('default_value', 18, 4)->default(0);
            $table->foreignId('percentage_of_component_id')->nullable()->constrained('payroll_components')->nullOnDelete();
            $table->boolean('is_taxable')->default(false);
            $table->boolean('is_statutory')->default(false);
            $table->boolean('is_recurring')->default(true);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['organization_id', 'code']);
        });

        Schema::create('employee_bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('bank_name');
            $table->string('bank_code')->nullable();
            $table->text('account_number');
            $table->string('account_name');
            $table->boolean('is_primary')->default(true);
            $table->string('verification_status')->default('unverified');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'employee_id']);
        });

        Schema::create('employee_compensations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_group_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('base_salary', 18, 2);
            $table->string('currency', 3)->default('NGN');
            $table->string('pay_frequency')->default('monthly');
            $table->json('recurring_components')->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('status')->default('active');
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['organization_id', 'employee_id', 'effective_from'], 'comp_org_employee_effective_unique');
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_group_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reference');
            $table->string('name');
            $table->date('period_start');
            $table->date('period_end');
            $table->date('payment_date');
            $table->string('currency', 3)->default('NGN');
            $table->string('status')->default('draft')->index();
            $table->unsignedInteger('employee_count')->default(0);
            $table->decimal('total_gross', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2)->default(0);
            $table->decimal('total_net', 18, 2)->default(0);
            $table->decimal('total_employer_contributions', 18, 2)->default(0);
            $table->json('calculation_context')->nullable();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('finalized_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('published_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('calculated_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'reference']);
            $table->index(['organization_id', 'period_start', 'period_end']);
        });

        Schema::create('payroll_run_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->foreignId('employee_compensation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('employee_number');
            $table->string('employee_name');
            $table->json('employment_snapshot');
            $table->json('bank_snapshot')->nullable();
            $table->unsignedInteger('payable_days')->default(0);
            $table->unsignedInteger('period_days')->default(0);
            $table->decimal('base_pay', 18, 2)->default(0);
            $table->decimal('gross_pay', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2)->default(0);
            $table->decimal('net_pay', 18, 2)->default(0);
            $table->decimal('employer_contributions', 18, 2)->default(0);
            $table->string('status')->default('calculated');
            $table->json('exceptions')->nullable();
            $table->timestamps();
            $table->unique(['payroll_run_id', 'employee_id']);
            $table->index(['organization_id', 'employee_id']);
        });

        Schema::create('payroll_run_item_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_run_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_component_id')->nullable()->constrained()->nullOnDelete();
            $table->string('component_code');
            $table->string('component_name');
            $table->string('type');
            $table->decimal('quantity', 18, 4)->default(1);
            $table->decimal('rate', 18, 4)->default(0);
            $table->decimal('amount', 18, 2);
            $table->boolean('is_taxable')->default(false);
            $table->boolean('is_statutory')->default(false);
            $table->json('calculation_snapshot')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'component_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_run_item_lines');
        Schema::dropIfExists('payroll_run_items');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('employee_compensations');
        Schema::dropIfExists('employee_bank_accounts');
        Schema::dropIfExists('payroll_components');
        Schema::dropIfExists('pay_groups');
        Schema::dropIfExists('payroll_settings');
    }
};
