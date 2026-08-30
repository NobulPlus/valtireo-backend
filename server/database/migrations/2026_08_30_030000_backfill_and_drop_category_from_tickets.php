<?php

use App\Models\Organization;
use App\Services\DefaultTicketCategorySeedingService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Every org needs its default categories seeded before existing
        // tickets' free-text category strings can be resolved to a real
        // ticket_categories row.
        Organization::query()->each(function (Organization $organization): void {
            app(DefaultTicketCategorySeedingService::class)->seedForOrganization($organization);
        });

        DB::table('tickets')->orderBy('id')->chunkById(200, function ($tickets): void {
            foreach ($tickets as $ticket) {
                $categoryId = DB::table('ticket_categories')
                    ->where('organization_id', $ticket->organization_id)
                    ->whereRaw('UPPER(code) = ?', [strtoupper((string) $ticket->category)])
                    ->value('id');

                DB::table('tickets')->where('id', $ticket->id)->update(['ticket_category_id' => $categoryId]);
            }
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_category_index');
            $table->dropColumn('category');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('category')->nullable()->after('requested_by_id');
        });
    }
};
