<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Templates\ImportTemplateRequest;
use App\Services\TemplateImportService;
use App\Services\TemplateRegistryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TemplateController extends Controller
{
    public function index(Request $request, TemplateRegistryService $templates): JsonResponse
    {
        return response()->json([
            'data' => $templates->availableFor($request->user())
                ->map(fn (array $template) => [
                    'key' => $template['key'],
                    'name' => $template['name'],
                    'module' => $template['module'],
                    'description' => $template['description'],
                    'filename' => $template['filename'],
                    'columns' => $template['columns'],
                ])
                ->values(),
        ]);
    }

    public function download(Request $request, string $key, TemplateRegistryService $templates): StreamedResponse
    {
        $template = $templates->findFor($request->user(), $key);

        return response()->streamDownload(function () use ($templates, $template): void {
            $handle = fopen('php://output', 'w');

            foreach ($templates->rows($template) as $row) {
                fputcsv($handle, $row);
            }

            fclose($handle);
        }, $template['filename'], [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function preview(ImportTemplateRequest $request, string $key, TemplateImportService $imports): JsonResponse
    {
        return response()->json($imports->preview($request->user(), $key, $request->file('file')));
    }

    public function import(ImportTemplateRequest $request, string $key, TemplateImportService $imports): JsonResponse
    {
        return response()->json($imports->import($request->user(), $key, $request->file('file')));
    }

    public function failedRows(ImportTemplateRequest $request, string $key, TemplateImportService $imports): StreamedResponse
    {
        $result = $imports->failedRows($request->user(), $key, $request->file('file'));
        $template = $result['template'];
        $filename = str_replace('-template.csv', '-failed-rows.csv', $template['filename']);

        return response()->streamDownload(function () use ($template, $result): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [...$template['columns'], 'errors']);

            foreach ($result['rows'] as $row) {
                fputcsv($handle, [
                    ...array_map(fn (string $column) => $row['data'][$column] ?? null, $template['columns']),
                    collect($row['errors'])->map(fn (string $message, string $field) => "{$field}: {$message}")->implode(' | '),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
