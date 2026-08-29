<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Removes the single-pair emergency_contact_name/phone fields from
 * employee_profiles — they duplicated the dedicated employee_emergency_contacts
 * table (a full, multi-contact list) and were never kept in sync with it.
 * The list is the single source of truth going forward.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_profiles', function (Blueprint $table) {
            $table->dropColumn(['emergency_contact_name', 'emergency_contact_phone']);
        });
    }

    public function down(): void
    {
        Schema::table('employee_profiles', function (Blueprint $table) {
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone')->nullable();
        });
    }
};
