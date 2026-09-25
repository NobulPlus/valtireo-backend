<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->foreignId('handover_to_employee_id')
                ->nullable()
                ->after('requested_by_id')
                ->constrained('employees')
                ->nullOnDelete();
            $table->text('handover_note')->nullable()->after('reason');
            $table->string('handover_file_name')->nullable()->after('evidence_file_size');
            $table->string('handover_file_path')->nullable()->after('handover_file_name');
            $table->string('handover_mime_type')->nullable()->after('handover_file_path');
            $table->unsignedBigInteger('handover_file_size')->nullable()->after('handover_mime_type');

            $table->index(['organization_id', 'handover_to_employee_id']);
        });
    }

    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'handover_to_employee_id']);
            $table->dropConstrainedForeignId('handover_to_employee_id');
            $table->dropColumn([
                'handover_note',
                'handover_file_name',
                'handover_file_path',
                'handover_mime_type',
                'handover_file_size',
            ]);
        });
    }
};
