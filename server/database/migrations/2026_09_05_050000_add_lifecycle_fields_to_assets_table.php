<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('serial_number')->nullable()->after('asset_tag');
            $table->string('condition')->default('good')->after('status')->index();
            $table->foreignId('organization_location_id')->nullable()->after('assigned_to_employee_id')->constrained('organization_locations')->nullOnDelete();
            $table->date('purchase_date')->nullable()->after('organization_location_id');
            $table->date('warranty_expires_at')->nullable()->after('purchase_date');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('organization_location_id');
            $table->dropColumn([
                'serial_number',
                'condition',
                'purchase_date',
                'warranty_expires_at',
            ]);
        });
    }
};
