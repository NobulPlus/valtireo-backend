<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_types', function (Blueprint $table) {
            $table->boolean('requires_acknowledgment')->default(false)->after('approval_required');
        });

        Schema::table('employee_documents', function (Blueprint $table) {
            $table->timestamp('acknowledged_at')->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('document_types', function (Blueprint $table) {
            $table->dropColumn('requires_acknowledgment');
        });

        Schema::table('employee_documents', function (Blueprint $table) {
            $table->dropColumn('acknowledged_at');
        });
    }
};
