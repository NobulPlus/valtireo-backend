<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_inputs', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payroll_component_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); $table->string('description'); $table->date('effective_date');
            $table->decimal('quantity', 18, 4)->default(1); $table->decimal('rate', 18, 4)->default(0); $table->decimal('amount', 18, 2);
            $table->string('status')->default('approved'); $table->json('metadata')->nullable();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete(); $table->timestamps();
            $table->index(['organization_id', 'effective_date', 'status']);
        });

        Schema::create('employee_statutory_profiles', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('paye_enabled')->default(true); $table->string('tax_state')->nullable(); $table->string('tax_id')->nullable();
            $table->boolean('pension_enabled')->default(true); $table->string('pfa_name')->nullable(); $table->text('rsa_pin')->nullable();
            $table->boolean('nhf_enabled')->default(false); $table->string('nhf_number')->nullable();
            $table->json('reliefs')->nullable(); $table->json('exemptions')->nullable(); $table->timestamps();
        });

        Schema::create('employee_loans', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete(); $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->string('reference'); $table->string('name'); $table->decimal('principal', 18, 2); $table->decimal('interest_amount', 18, 2)->default(0);
            $table->decimal('total_repayable', 18, 2); $table->decimal('installment_amount', 18, 2); $table->decimal('outstanding_balance', 18, 2);
            $table->date('starts_on'); $table->date('ends_on')->nullable(); $table->string('status')->default('active');
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete(); $table->timestamps();
            $table->unique(['organization_id', 'reference']);
        });

        Schema::create('loan_repayments', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete(); $table->foreignId('employee_loan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_run_item_id')->nullable()->constrained()->nullOnDelete(); $table->decimal('amount', 18, 2); $table->date('paid_on');
            $table->string('status')->default('posted'); $table->string('reference')->nullable(); $table->timestamps();
            $table->unique(['employee_loan_id', 'payroll_run_item_id']);
        });

        Schema::create('payroll_payment_batches', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete(); $table->foreignId('payroll_run_id')->constrained()->restrictOnDelete();
            $table->string('reference'); $table->string('format')->default('csv'); $table->string('status')->default('generated');
            $table->unsignedInteger('payment_count'); $table->decimal('total_amount', 18, 2); $table->string('file_path')->nullable(); $table->string('checksum', 64)->nullable();
            $table->foreignId('generated_by_id')->nullable()->constrained('users')->nullOnDelete(); $table->timestamp('generated_at'); $table->timestamp('marked_paid_at')->nullable(); $table->timestamps();
            $table->unique(['organization_id', 'reference']);
        });

        Schema::create('payroll_journal_batches', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete(); $table->foreignId('payroll_run_id')->unique()->constrained()->restrictOnDelete();
            $table->string('reference'); $table->string('status')->default('draft'); $table->date('journal_date'); $table->string('currency', 3);
            $table->decimal('total_debit', 18, 2); $table->decimal('total_credit', 18, 2); $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete(); $table->timestamps();
        });

        Schema::create('payroll_journal_lines', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete(); $table->foreignId('payroll_journal_batch_id')->constrained()->cascadeOnDelete();
            $table->string('account_code'); $table->string('account_name'); $table->text('description')->nullable();
            $table->decimal('debit', 18, 2)->default(0); $table->decimal('credit', 18, 2)->default(0); $table->json('dimensions')->nullable(); $table->timestamps();
        });

        Schema::create('payslip_documents', function (Blueprint $table) {
            $table->id(); $table->foreignId('organization_id')->constrained()->cascadeOnDelete(); $table->foreignId('payroll_run_item_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('file_path'); $table->string('file_name'); $table->string('mime_type')->default('text/html'); $table->string('checksum', 64);
            $table->foreignId('generated_by_id')->nullable()->constrained('users')->nullOnDelete(); $table->timestamp('generated_at'); $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslip_documents'); Schema::dropIfExists('payroll_journal_lines'); Schema::dropIfExists('payroll_journal_batches');
        Schema::dropIfExists('payroll_payment_batches'); Schema::dropIfExists('loan_repayments'); Schema::dropIfExists('employee_loans');
        Schema::dropIfExists('employee_statutory_profiles'); Schema::dropIfExists('payroll_inputs');
    }
};
