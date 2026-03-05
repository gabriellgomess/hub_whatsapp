<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Chat::query()
            ->where('company_id', $request->user()->company_id)
            ->with(['contact', 'lastMessage', 'assignedAgent', 'labels', 'instance'])
            ->orderByDesc('last_message_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('contact', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('push_name', 'like', "%{$search}%")
                  ->orWhere('jid', 'like', "%{$search}%")
                  ->orWhere('phone_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('instance_id')) {
            $query->where('whatsapp_instance_id', $request->instance_id);
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->boolean('unread')) {
            $query->where('unread', true);
        }

        if ($request->boolean('archived')) {
            $query->where('archived', true);
        } else {
            $query->where('archived', false);
        }

        return response()->json($query->paginate(30));
    }

    public function show(Request $request, Chat $chat): JsonResponse
    {
        $this->authorizeChat($request, $chat);

        return response()->json(
            $chat->load(['contact', 'lastMessage', 'assignedAgent', 'labels', 'instance'])
        );
    }

    public function updateStatus(Request $request, Chat $chat): JsonResponse
    {
        $this->authorizeChat($request, $chat);
        $request->validate(['status' => 'required|in:open,pending,resolved']);

        $chat->update(['status' => $request->status]);

        return response()->json($chat->fresh()->load('contact', 'assignedAgent', 'labels'));
    }

    public function assign(Request $request, Chat $chat): JsonResponse
    {
        $this->authorizeChat($request, $chat);
        $request->validate(['user_id' => 'nullable|exists:users,id']);

        $chat->update(['assigned_to' => $request->user_id]);

        return response()->json($chat->fresh()->load('contact', 'assignedAgent', 'labels'));
    }

    public function markAsRead(Request $request, Chat $chat): JsonResponse
    {
        $this->authorizeChat($request, $chat);

        $chat->update(['unread' => false, 'unread_count' => 0]);

        return response()->json(['ok' => true]);
    }

    private function authorizeChat(Request $request, Chat $chat): void
    {
        abort_if($chat->company_id !== $request->user()->company_id, 403);
    }
}
