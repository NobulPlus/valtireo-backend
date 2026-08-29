<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->string('evidence_file_name')->nullable()->after('reason');
            $table->string('evidence_file_path')->nullable()->after('evidence_file_name');
            $table->string('evidence_mime_type')->nullable()->after('evidence_file_path');
            $table->unsignedBigInteger('evidence_file_size')->nullable()->after('evidence_mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropColumn([
                'evidence_file_name',
                'evidence_file_path',
                'evidence_mime_type',
                'evidence_file_size',
            ]);
        });
    }
};
