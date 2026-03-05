<?php

namespace App\Jobs;

use App\Models\Chat;
use App\Models\Contact;
use App\Models\Message;
use App\Models\WhatsappInstance;
use App\Events\NewMessageReceived;
use App\Events\ChatUpdated;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

class ProcessWebhookEvent implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $instanceId,
        public readonly string $event,
        public readonly array $payload,
    ) {}

    public function handle(): void
    {
        $instance = WhatsappInstance::find($this->instanceId);

        if (!$instance) {
            return;
        }

        // Evolution API v2 usa dot notation minúsculo (messages.upsert)
        // Evolution API v1 usava SNAKE_CASE maiúsculo (MESSAGES_UPSERT)
        $event = strtolower(str_replace('_', '.', $this->event));

        match ($event) {
            'messages.upsert'   => $this->handleMessageUpsert($instance),
            'messages.update'   => $this->handleMessageUpdate($instance),
            'connection.update' => $this->handleConnectionUpdate($instance),
            default             => null,
        };
    }

    private function handleMessageUpsert(WhatsappInstance $instance): void
    {
        $raw = $this->payload['data'] ?? [];

        // Evolution v2 envia objeto único; v1 enviava array de objetos
        $data = isset($raw['key']) ? [$raw] : array_values($raw);

        foreach ($data as $messageData) {
            $key = $messageData['key'] ?? [];
            $messageId = $key['id'] ?? null;
            $remoteJid = $key['remoteJid'] ?? null;
            $fromMe = (bool) ($key['fromMe'] ?? false);

            if (!$messageId || !$remoteJid) {
                continue;
            }

            // Ignora mensagens de status
            if ($remoteJid === 'status@broadcast') {
                continue;
            }

            // Garante que o contato existe
            $contact = Contact::firstOrCreate(
                ['whatsapp_instance_id' => $instance->id, 'jid' => $remoteJid],
                [
                    'company_id' => $instance->company_id,
                    'push_name' => $messageData['pushName'] ?? null,
                    'is_group' => str_contains($remoteJid, '@g.us'),
                ]
            );

            // Atualiza push_name se mudou
            if (isset($messageData['pushName']) && $contact->push_name !== $messageData['pushName']) {
                $contact->update(['push_name' => $messageData['pushName']]);
            }

            // Garante que o chat existe
            $chat = Chat::firstOrCreate(
                ['whatsapp_instance_id' => $instance->id, 'contact_id' => $contact->id],
                ['company_id' => $instance->company_id, 'status' => 'open']
            );

            // Detecta tipo e conteúdo da mensagem
            $msgContent = $messageData['message'] ?? [];
            [$type, $body, $mediaUrl, $mimetype, $filename] = $this->extractMessageContent($msgContent);

            $sentAt = isset($messageData['messageTimestamp'])
                ? Carbon::createFromTimestamp($messageData['messageTimestamp'])
                : now();

            // Salva a mensagem (ignora duplicatas pelo message_id)
            $message = Message::firstOrCreate(
                ['message_id' => $messageId],
                [
                    'company_id' => $instance->company_id,
                    'chat_id' => $chat->id,
                    'whatsapp_instance_id' => $instance->id,
                    'remote_jid' => $remoteJid,
                    'from_me' => $fromMe,
                    'type' => $type,
                    'body' => $body,
                    'media_url' => $mediaUrl,
                    'media_mime_type' => $mimetype,
                    'media_filename' => $filename,
                    'status' => $fromMe ? 'sent' : 'delivered',
                    'raw_payload' => $messageData,
                    'sent_at' => $sentAt,
                ]
            );

            // Atualiza o chat
            $chat->update([
                'last_message_at' => $sentAt,
                'unread' => !$fromMe ? true : $chat->unread,
                'unread_count' => !$fromMe ? $chat->unread_count + 1 : $chat->unread_count,
            ]);

            // Broadcast em tempo real para o frontend
            broadcast(new NewMessageReceived($message->load('chat.contact', 'senderUser')))->toOthers();
            broadcast(new ChatUpdated($chat->fresh()->load('contact', 'lastMessage', 'assignedAgent', 'labels')));
        }
    }

    private function handleMessageUpdate(WhatsappInstance $instance): void
    {
        $raw = $this->payload['data'] ?? [];

        // Evolution v2 envia objeto único; v1 enviava array
        $updates = isset($raw['key']) ? [$raw] : array_values($raw);

        foreach ($updates as $update) {
            $messageId = $update['key']['id'] ?? null;
            $status = $update['update']['status'] ?? null;

            if (!$messageId || !$status) {
                continue;
            }

            $statusMap = [
                'ERROR' => 'error',
                'PENDING' => 'pending',
                'SERVER_ACK' => 'sent',
                'DELIVERY_ACK' => 'delivered',
                'READ' => 'read',
            ];

            Message::where('message_id', $messageId)
                ->where('whatsapp_instance_id', $instance->id)
                ->update(['status' => $statusMap[$status] ?? 'sent']);
        }
    }

    private function handleConnectionUpdate(WhatsappInstance $instance): void
    {
        $state = $this->payload['data']['state'] ?? null;

        $statusMap = [
            'open' => 'connected',
            'close' => 'disconnected',
            'connecting' => 'connecting',
        ];

        if ($state && isset($statusMap[$state])) {
            $instance->update(['status' => $statusMap[$state]]);
        }
    }

    private function extractMessageContent(array $message): array
    {
        if (isset($message['conversation'])) {
            return ['text', $message['conversation'], null, null, null];
        }

        if (isset($message['extendedTextMessage'])) {
            return ['text', $message['extendedTextMessage']['text'] ?? null, null, null, null];
        }

        if (isset($message['imageMessage'])) {
            $img = $message['imageMessage'];
            return ['image', $img['caption'] ?? null, $img['url'] ?? null, $img['mimetype'] ?? null, null];
        }

        if (isset($message['videoMessage'])) {
            $vid = $message['videoMessage'];
            return ['video', $vid['caption'] ?? null, $vid['url'] ?? null, $vid['mimetype'] ?? null, $vid['fileName'] ?? null];
        }

        if (isset($message['audioMessage'])) {
            $aud = $message['audioMessage'];
            return ['audio', null, $aud['url'] ?? null, $aud['mimetype'] ?? null, null];
        }

        if (isset($message['documentMessage'])) {
            $doc = $message['documentMessage'];
            return ['document', $doc['caption'] ?? null, $doc['url'] ?? null, $doc['mimetype'] ?? null, $doc['fileName'] ?? null];
        }

        if (isset($message['stickerMessage'])) {
            return ['sticker', null, null, null, null];
        }

        if (isset($message['locationMessage'])) {
            $loc = $message['locationMessage'];
            return ['location', "Lat: {$loc['degreesLatitude']}, Lng: {$loc['degreesLongitude']}", null, null, null];
        }

        if (isset($message['reactionMessage'])) {
            return ['reaction', $message['reactionMessage']['text'] ?? null, null, null, null];
        }

        return ['unknown', null, null, null, null];
    }
}
