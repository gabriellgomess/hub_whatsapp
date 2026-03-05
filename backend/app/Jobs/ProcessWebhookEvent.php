<?php

namespace App\Jobs;

use App\Models\Chat;
use App\Models\Contact;
use App\Models\Message;
use App\Models\WhatsappInstance;
use App\Services\EvolutionApiService;
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
            $isGroup = str_contains($remoteJid ?? '', '@g.us');
            $contactPhoneNumber = !$isGroup
                ? ($this->extractPhoneNumber($key['senderPn'] ?? null) ?? $this->extractPhoneNumber($remoteJid))
                : null;

            if (!$messageId || !$remoteJid) {
                continue;
            }

            // Ignora mensagens de status
            if ($remoteJid === 'status@broadcast') {
                continue;
            }

            $groupNameFromPayload = $isGroup ? $this->extractGroupNameFromPayload($messageData) : null;

            // Garante que o contato existe
            $contactDefaults = [
                'company_id' => $instance->company_id,
                'is_group' => $isGroup,
            ];

            if ($isGroup) {
                if ($groupNameFromPayload) {
                    $contactDefaults['name'] = $groupNameFromPayload;
                }
            } else {
                $contactDefaults['push_name'] = $messageData['pushName'] ?? null;
                if ($contactPhoneNumber) {
                    $contactDefaults['phone_number'] = $contactPhoneNumber;
                }
            }

            $contact = Contact::firstOrCreate(
                ['whatsapp_instance_id' => $instance->id, 'jid' => $remoteJid],
                $contactDefaults
            );

            // Atualiza metadados do contato
            if ($isGroup) {
                $resolvedGroupName = $groupNameFromPayload;

                if (!$resolvedGroupName && blank($contact->name)) {
                    $resolvedGroupName = $this->resolveGroupName($instance, $remoteJid, $messageData);
                }

                if ($resolvedGroupName && $contact->name !== $resolvedGroupName) {
                    $contact->update(['name' => $resolvedGroupName]);
                }
            } else {
                if (isset($messageData['pushName']) && $contact->push_name !== $messageData['pushName']) {
                    $contact->update(['push_name' => $messageData['pushName']]);
                }
                if ($contactPhoneNumber && blank($contact->phone_number)) {
                    $contact->update(['phone_number' => $contactPhoneNumber]);
                    $contact->phone_number = $contactPhoneNumber;
                }
            }

            $this->syncContactProfilePicture($instance, $contact, $contactPhoneNumber);

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

    private function syncContactProfilePicture(WhatsappInstance $instance, Contact $contact, ?string $preferredNumber = null): void
    {
        if (!$this->shouldFetchProfilePicture($contact)) {
            return;
        }

        try {
            $service = new EvolutionApiService($instance);
            $lookup = $preferredNumber ?: ($contact->phone_number ?: $contact->jid);
            $result = $service->fetchProfilePicture($lookup);
            $pictureUrl = $this->extractProfilePictureUrl($result);

            $extra = $contact->extra ?? [];
            $extra['profile_picture_checked_at'] = now()->toIso8601String();
            $payload = ['extra' => $extra];

            if ($pictureUrl) {
                $payload['profile_picture'] = $pictureUrl;
            }

            $contact->update($payload);
        } catch (\Throwable) {
            // Ignore provider errors and continue webhook processing.
        }
    }

    private function shouldFetchProfilePicture(Contact $contact): bool
    {
        if (!blank($contact->profile_picture)) {
            return false;
        }

        $lastChecked = data_get($contact->extra, 'profile_picture_checked_at');
        if (!$lastChecked) {
            return true;
        }

        try {
            return Carbon::parse($lastChecked)->lt(now()->subHours(6));
        } catch (\Throwable) {
            return true;
        }
    }

    private function extractProfilePictureUrl(array $payload): ?string
    {
        $keys = ['profilePictureUrl', 'profilePicture', 'profilePicUrl', 'url'];
        return $this->findFirstStringByKeys($payload, $keys);
    }

    private function extractPhoneNumber(?string $jidOrNumber): ?string
    {
        if (!$jidOrNumber || !is_string($jidOrNumber)) {
            return null;
        }

        $value = trim($jidOrNumber);
        if ($value === '') {
            return null;
        }

        if (str_contains($value, '@')) {
            $value = strstr($value, '@', true) ?: $value;
        }

        $digits = preg_replace('/\D+/', '', $value);

        return $digits !== '' ? $digits : null;
    }

    private function resolveGroupName(WhatsappInstance $instance, string $groupJid, array $messageData): ?string
    {
        $name = $this->extractGroupNameFromPayload($messageData);
        if ($name) {
            return $name;
        }

        try {
            $service = new EvolutionApiService($instance);
            $groupInfo = $service->findGroupInfo($groupJid);

            return $this->extractGroupNameFromPayload($groupInfo);
        } catch (\Throwable) {
            return null;
        }
    }

    private function extractGroupNameFromPayload(array $payload): ?string
    {
        $keys = ['subject', 'groupSubject', 'groupName', 'chatName', 'conversationName'];

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
