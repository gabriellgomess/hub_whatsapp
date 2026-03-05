<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chat;
use App\Models\Message;
use App\Services\EvolutionApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index(Request $request, Chat $chat): JsonResponse
    {
        abort_if($chat->company_id !== $request->user()->company_id, 403);

        $messages = $chat->messages()
            ->with('senderUser')
            ->orderByDesc('sent_at')
            ->paginate(50);

        return response()->json($messages);
    }

    public function send(Request $request, Chat $chat): JsonResponse
    {
        abort_if($chat->company_id !== $request->user()->company_id, 403);

        $request->validate([
            'type'               => 'required|in:text,image,video,audio,document',
            'body'               => 'required_if:type,text|nullable|string',
            'media_url'          => 'required_unless:type,text|nullable|string',
            'media_filename'     => 'nullable|string',
            'quoted_message_id'  => 'nullable|string',
        ]);

        $instance = $chat->instance;
        $service = new EvolutionApiService($instance);
        $remoteJid = $chat->contact->jid;

        if ($request->type === 'text') {
            $result = $service->sendText($remoteJid, $request->body, $request->quoted_message_id);
        } else {
            $mimeMap = ['image' => 'image', 'video' => 'video', 'audio' => 'audio', 'document' => 'document'];
            $result = $service->sendMedia($remoteJid, $request->media_url, $mimeMap[$request->type], $request->body, $request->media_filename);
        }

        $messageId = $result['key']['id'] ?? ('local_' . uniqid());

        $message = Message::create([
            'company_id'          => $chat->company_id,
            'chat_id'             => $chat->id,
            'whatsapp_instance_id'=> $instance->id,
            'sender_user_id'      => $request->user()->id,
            'message_id'          => $messageId,
            'remote_jid'          => $remoteJid,
            'from_me'             => true,
            'type'                => $request->type,
            'body'                => $request->body,
            'media_url'           => $request->media_url,
            'media_filename'      => $request->media_filename,
            'quoted_message_id'   => $request->quoted_message_id,
            'status'              => 'sent',
            'sent_at'             => now(),
        ]);

        $chat->update(['last_message_at' => now()]);

        return response()->json($message->load('senderUser'), 201);
    }
}
