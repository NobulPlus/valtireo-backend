<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitAttachment;
use App\Models\OrbitComment;
use App\Models\OrbitWorkItem;
use App\Services\OrbitAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class OrbitAttachmentController extends Controller
{
    public function __construct(private readonly OrbitAuthorizationService $auth)
    {
    }

    public function storeForWorkItem(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $workItem->project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $workItem->project), 403);

        $attachment = $this->storeUploadedFile($request, $user->organization_id, $user->id, ['work_item_id' => $workItem->id]);

        return response()->json(['attachment' => $attachment], 201);
    }

    public function storeForComment(Request $request, OrbitComment $comment): JsonResponse
    {
        $user = $request->user();
        $project = $comment->workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);

        $attachment = $this->storeUploadedFile($request, $user->organization_id, $user->id, ['comment_id' => $comment->id]);

        return response()->json(['attachment' => $attachment], 201);
    }

    public function file(Request $request, OrbitAttachment $attachment): BinaryFileResponse
    {
        $this->authorizeAttachmentAccess($request, $attachment);

        abort_unless(Storage::disk('local')->exists($attachment->file_path), 404, 'Attachment file was not found.');

        return response()->file(Storage::disk('local')->path($attachment->file_path), [
            'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.$attachment->file_name.'"',
        ]);
    }

    public function destroy(Request $request, OrbitAttachment $attachment): JsonResponse
    {
        $user = $request->user();
        $project = $attachment->workItem?->project ?? $attachment->comment?->workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($attachment->uploaded_by_id === $user->id || $this->auth->canAdministerProject($user, $project), 403);

        $attachment->update(['deleted_at' => now()]);

        return response()->json(['message' => 'Attachment removed.']);
    }

    /**
     * @param array<string, int> $owner one of ['work_item_id' => id] or ['comment_id' => id]
     */
    private function storeUploadedFile(Request $request, int $organizationId, int $userId, array $owner): OrbitAttachment
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf,txt,csv,doc,docx,xls,xlsx,ppt,pptx'],
        ]);

        $file = $data['file'];
        $path = $file->store("organizations/{$organizationId}/orbit/attachments", 'local');

        return OrbitAttachment::create([
            'organization_id' => $organizationId,
            ...$owner,
            'uploaded_by_id' => $userId,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
        ]);
    }

    private function authorizeAttachmentAccess(Request $request, OrbitAttachment $attachment): void
    {
        abort_unless($attachment->organization_id === $request->user()->organization_id, 404);

        $project = $attachment->workItem?->project ?? $attachment->comment?->workItem->project;

        abort_unless($project && $this->auth->canViewProject($request->user(), $project), 404);
    }
}
