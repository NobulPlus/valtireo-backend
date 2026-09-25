<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceDesk\AddTicketCommentRequest;
use App\Http\Resources\TicketCommentResource;
use App\Models\Ticket;
use App\Models\TicketComment;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TicketCommentController extends Controller
{
    public function store(AddTicketCommentRequest $request, Ticket $ticket, TicketService $tickets): JsonResponse
    {
        $data = $request->validated();
        if ($request->hasFile('attachment')) {
            $data['attachment'] = $request->file('attachment');
        }

        $comment = $tickets->addComment($request->user(), $ticket, $data);

        return response()->json([
            'comment' => new TicketCommentResource($comment),
        ], 201);
    }

    public function downloadAttachment(Request $request, Ticket $ticket, TicketComment $ticketComment, TicketService $tickets): StreamedResponse
    {
        $tickets->assertCommentAttachmentVisibleTo($request->user(), $ticket, $ticketComment);
        abort_unless(filled($ticketComment->attachment_file_path) && Storage::disk('local')->exists($ticketComment->attachment_file_path), 404);

        return Storage::disk('local')->download($ticketComment->attachment_file_path, $ticketComment->attachment_file_name);
    }
}
