<?php

use App\Models\OrbitWorkItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * backlog_rank is a separate, project-wide ordering scale from the
 * status-scoped `position` column — the Backlog screen's manual
 * drag-to-reorder needs an order that survives moving an item between
 * sprints and board columns, which `position` (board-column-local)
 * can't express. Backfilled by `id` so existing rows aren't left tied.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orbit_work_items', function (Blueprint $table) {
            $table->decimal('backlog_rank', 20, 10)->nullable()->after('position');
        });

        $rank = 1024.0;
        foreach (OrbitWorkItem::query()->orderBy('id')->select('id')->cursor() as $item) {
            $item->forceFill(['backlog_rank' => number_format($rank, 10, '.', '')])->saveQuietly();
            $rank += 1024.0;
        }
    }

    public function down(): void
    {
        Schema::table('orbit_work_items', function (Blueprint $table) {
            $table->dropColumn('backlog_rank');
        });
    }
};
