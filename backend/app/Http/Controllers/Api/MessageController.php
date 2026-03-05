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
            'type'              => 'required|in:text,image,video,audio,document',
            'body'              => 'nullable|string',
            'media_url'         => 'nullable|string',
            'media_base64'      => 'nullable|string',
            'media_mime_type'   => 'nullable|string',
            'media_filename'    => 'nullable|string',
            'quoted_message_id' => 'nullable|string',
        ]);

        if ($request->type === 'text' && !$request->filled('body')) {
            return response()->json(['message' => 'O campo body é obrigatório para mensagens de texto.'], 422);
        }

        if ($request->type !== 'text' && !$request->filled('media_url') && !$request->filled('media_base64')) {
            return response()->json(['message' => 'media_url ou media_base64 é obrigatório para mensagens de mídia.'], 422);
        }

        $instance  = $chat->instance;
        $service   = new EvolutionApiService($instance);
        $remoteJid = $chat->contact->jid;

        $mediaContent = $request->media_base64 ?? $request->media_url;
        $quotedId     = $request->quoted_message_id;

        switch ($request->type) {
            case 'text':
                $result = $service->sendText($remoteJid, $request->body, $quotedId);
                break;

            case 'audio':
                $result = $service->sendWhatsAppAudio($remoteJid, $mediaContent, $quotedId);
                break;

            default: // image, video, document
                $result = $service->sendMedia(
                    $remoteJid,
                    $mediaContent,
                    $request->type,
                    $request->body,
                    $request->media_filename,
                    $request->media_mime_type,
                    $quotedId
                );
        }

        $messageId = $result['key']['id'] ?? ('local_' . uniqid());

        $message = Message::create([
            'company_id'           => $chat->company_id,
            'chat_id'              => $chat->id,
            'whatsapp_instance_id' => $instance->id,
            'sender_user_id'       => $request->user()->id,
            'message_id'           => $messageId,
            'remote_jid'           => $remoteJid,
            'from_me'              => true,
            'type'                 => $request->type,
            'body'                 => $request->body,
            'media_url'            => $request->media_url, // base64 não é salvo no DB
            'media_mime_type'      => $request->media_mime_type,
            'media_filename'       => $request->media_filename,
            'quoted_message_id'    => $quotedId,
            'status'               => 'sent',
            'sent_at'              => now(),
        ]);

        $chat->update(['last_message_at' => now()]);

        return response()->json($message->load('senderUser'), 201);
    }

    public function destroy(Request $request, Chat $chat, Message $message): JsonResponse
    {
        abort_if($chat->company_id !== $request->user()->company_id, 403);
        abort_if($message->chat_id !== $chat->id, 404);

        if ($message->from_me) {
            $service = new EvolutionApiService($chat->instance);
            $service->deleteMessageForEveryone($message->remote_jid, $message->message_id, true);
        }

        $message->delete();

        return response()->json(['ok' => true]);
    }

    public function media(Request $request, Chat $chat, Message $message): JsonResponse
    {
        abort_if($chat->company_id !== $request->user()->company_id, 403);
        abort_if($message->chat_id !== $chat->id, 404);

        $service = new EvolutionApiService($chat->instance);
        $result  = $service->getMediaBase64(
            $message->message_id,
            $request->boolean('convert_to_mp4', false)
        );

        return response()->json([
            'base64'   => $result['base64'] ?? null,
            'mimetype' => $result['mimetype'] ?? $message->media_mime_type,
            'fileName' => $result['fileName'] ?? $message->media_filename,
        ]);
    }
}
