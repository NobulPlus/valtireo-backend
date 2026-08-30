<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_comments', function (Blueprint $table) {
            $table->string('visibility')->default('public')->after('comment')->index();
            $table->string('attachment_file_name')->nullable()->after('visibility');
            $table->string('attachment_file_path')->nullable()->after('attachment_file_name');
            $table->string('attachment_mime_type')->nullable()->after('attachment_file_path');
            $table->unsignedInteger('attachment_file_size')->nullable()->after('attachment_mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_comments', function (Blueprint $table) {
            $table->dropColumn([
                'visibility',
                'attachment_file_name',
                'attachment_file_path',
                'attachment_mime_type',
                'attachment_file_size',
            ]);
        });
    }
};
