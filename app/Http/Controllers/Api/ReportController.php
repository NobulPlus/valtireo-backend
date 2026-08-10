<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request, ReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->availableFor($request->user())
                ->map(fn (array $report) => collect($report)->except('permission', 'csv_headers')->all())
                ->values(),
        ]);
    }

    public function show(Request $request, string $key, ReportService $reports): JsonResponse
    {
        return response()->json($reports->view($request->user(), $key, $request));
    }

    public function export(Request $request, string $key, ReportService $reports): StreamedResponse
    {
        $export = $reports->export($request->user(), $key, $request);

        return response()->streamDownload($export['callback'], $export['filename'], [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
