<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('asset_category_id')->nullable()->after('category')->constrained('asset_categories')->restrictOnDelete();
        });

        $resolvedCategoryIds = [];

        foreach (DB::table('assets')->select('id', 'organization_id', 'category')->get() as $asset) {
            $code = strtoupper($asset->category);
            $cacheKey = $asset->organization_id.'|'.$code;

            if (! array_key_exists($cacheKey, $resolvedCategoryIds)) {
                $existing = DB::table('asset_categories')
                    ->where('organization_id', $asset->organization_id)
                    ->where('code', $code)
                    ->first();

                $resolvedCategoryIds[$cacheKey] = $existing?->id ?? DB::table('asset_categories')->insertGetId([
                    'organization_id' => $asset->organization_id,
                    'name' => ucwords(str_replace('_', ' ', $asset->category)),
                    'code' => $code,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('assets')->where('id', $asset->id)->update(['asset_category_id' => $resolvedCategoryIds[$cacheKey]]);
        }

        Schema::table('assets', function (Blueprint $table) {
            $table->dropIndex(['category']);
            $table->dropColumn('category');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('category')->nullable()->after('asset_category_id');
        });

        DB::table('assets')->update([
            'category' => DB::raw('(select lower(asset_categories.code) from asset_categories where asset_categories.id = assets.asset_category_id)'),
        ]);

        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('asset_category_id');
            $table->index('category');
        });
    }
};
