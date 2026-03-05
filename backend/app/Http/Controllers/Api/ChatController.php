<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chat;
use App\Services\EvolutionApiService;
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

        $chats = $query->paginate(30);
        $this->hydrateMissingGroupNames($chats->getCollection());
        $this->hydrateMissingProfilePictures($chats->getCollection());

        return response()->json($chats);
    }

    public function show(Request $request, Chat $chat): JsonResponse
    {
        $this->authorizeChat($request, $chat);

        $chat = $chat->load(['contact', 'lastMessage', 'assignedAgent', 'labels', 'instance']);
        $this->hydrateMissingGroupNames(collect([$chat]));
        $this->hydrateMissingProfilePictures(collect([$chat]));

        return response()->json($chat);
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

    private function hydrateMissingGroupNames(\Illuminate\Support\Collection $chats): void
    {
        foreach ($chats as $chat) {
            $contact = $chat->contact;
            $instance = $chat->instance;

            if (!$contact || !$instance || !$contact->is_group || !blank($contact->name)) {
                continue;
            }

            try {
                $service = new EvolutionApiService($instance);
                $groupInfo = $service->findGroupInfo($contact->jid);
                $groupName = $this->extractGroupName($groupInfo);

                if ($groupName) {
                    $contact->update(['name' => $groupName]);
                    $contact->name = $groupName;
                }
            } catch (\Throwable) {
                // Keep chat listing responsive even if provider lookup fails.
            }
        }
    }

    private function hydrateMissingProfilePictures(\Illuminate\Support\Collection $chats): void
    {
        $checked = [];

        foreach ($chats as $chat) {
            $contact = $chat->contact;
            $instance = $chat->instance;

            if (!$contact || !$instance || !blank($contact->profile_picture)) {
                continue;
            }

            $cacheKey = $instance->id . '|' . $contact->jid;
            if (isset($checked[$cacheKey])) {
                continue;
            }
            $checked[$cacheKey] = true;

            try {
                $service = new EvolutionApiService($instance);
                $lookup = $contact->phone_number ?: $contact->jid;
                $result = $service->fetchProfilePicture($lookup);
                $pictureUrl = $this->extractProfilePictureUrl($result);

                if ($pictureUrl) {
                    $contact->update(['profile_picture' => $pictureUrl]);
                    $contact->profile_picture = $pictureUrl;
                }
            } catch (\Throwable) {
                // Keep chat listing responsive even if provider lookup fails.
            }
        }
    }

    private function extractGroupName(array $payload): ?string
    {
        $keys = ['subject', 'groupSubject', 'groupName', 'chatName', 'conversationName'];

        return $this->findFirstStringByKeys($payload, $keys);
    }

    private function extractProfilePictureUrl(array $payload): ?string
    {
        $keys = ['profilePictureUrl', 'profilePicture', 'profilePicUrl', 'url'];

        return $this->findFirstStringByKeys($payload, $keys);
    }

    private function findFirstStringByKeys(array $data, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($data[$key]) && is_string($data[$key])) {
                $value = trim($data[$key]);
                if ($value !== '') {
                    return $value;
                }
            }
        }

        foreach ($data as $value) {
            if (is_array($value)) {
                $found = $this->findFirstStringByKeys($value, $keys);
                if ($found) {
                    return $found;
                }
            }
        }

        return null;
    }
}
