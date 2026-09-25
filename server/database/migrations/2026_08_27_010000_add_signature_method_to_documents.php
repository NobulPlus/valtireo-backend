<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_types', function (Blueprint $table) {
            $table->string('signature_method')->default('none')->after('approval_required');
        });

        DB::table('document_types')->where('requires_acknowledgment', true)->update(['signature_method' => 'acknowledge']);

        Schema::table('document_types', function (Blueprint $table) {
            $table->dropColumn('requires_acknowledgment');
        });

        Schema::table('employee_documents', function (Blueprint $table) {
            $table->foreignId('replaces_document_id')->nullable()->after('document_requirement_id')->constrained('employee_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employee_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('replaces_document_id');
        });

        Schema::table('document_types', function (Blueprint $table) {
            $table->boolean('requires_acknowledgment')->default(false)->after('approval_required');
        });

        DB::table('document_types')->where('signature_method', 'acknowledge')->update(['requires_acknowledgment' => true]);

        Schema::table('document_types', function (Blueprint $table) {
            $table->dropColumn('signature_method');
        });
    }
};
