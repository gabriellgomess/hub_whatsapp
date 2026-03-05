<?php

namespace App\Services;

use App\Models\WhatsappInstance;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class EvolutionApiService
{
    private WhatsappInstance $instance;

    public function __construct(WhatsappInstance $instance)
    {
        $this->instance = $instance;
    }

    // -------------------------------------------------------------------------
    // Instância / Conexão
    // -------------------------------------------------------------------------

    public function getConnectionStatus(): array
    {
        return $this->get("/instance/connectionState/{$this->instance->instance_name}");
    }

    public function getQrCode(): array
    {
        return $this->get("/instance/connect/{$this->instance->instance_name}");
    }

    public function logout(): array
    {
        return $this->delete("/instance/logout/{$this->instance->instance_name}");
    }

    public function setWebhook(string $webhookUrl): array
    {
        return $this->post("/webhook/set/{$this->instance->instance_name}", [
            'url' => $webhookUrl,
            'webhook_by_events' => false,
            'webhook_base64' => false,
            'events' => [
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'CONNECTION_UPDATE',
                'CONTACTS_UPDATE',
                'CHATS_UPDATE',
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Mensagens
    // -------------------------------------------------------------------------

    public function sendText(string $to, string $text, ?string $quotedMessageId = null): array
    {
        $payload = [
            'number' => $to,
            'text' => $text,
        ];

        if ($quotedMessageId) {
            $payload['quoted'] = ['key' => ['id' => $quotedMessageId]];
        }

        return $this->post("/message/sendText/{$this->instance->instance_name}", $payload);
    }

    public function sendMedia(string $to, string $mediaUrl, string $mediaType, ?string $caption = null, ?string $filename = null): array
    {
        return $this->post("/message/sendMedia/{$this->instance->instance_name}", [
            'number' => $to,
            'mediatype' => $mediaType,
            'media' => $mediaUrl,
            'caption' => $caption,
            'fileName' => $filename,
        ]);
    }

    public function sendReaction(string $to, string $messageId, string $emoji): array
    {
        return $this->post("/message/sendReaction/{$this->instance->instance_name}", [
            'key' => ['remoteJid' => $to, 'id' => $messageId],
            'reaction' => $emoji,
        ]);
    }

    public function markAsRead(string $remoteJid, array $messageIds): array
    {
        return $this->post("/chat/readMessage/{$this->instance->instance_name}", [
            'readMessages' => array_map(fn ($id) => [
                'remoteJid' => $remoteJid,
                'fromMe' => false,
                'id' => $id,
            ], $messageIds),
        ]);
    }

    public function deleteMessage(string $remoteJid, string $messageId, bool $fromMe): array
    {
        return $this->delete("/chat/deleteMessage/{$this->instance->instance_name}", [
            'id' => $messageId,
            'remoteJid' => $remoteJid,
            'fromMe' => $fromMe,
        ]);
    }

    // -------------------------------------------------------------------------
    // Chats / Contatos
    // -------------------------------------------------------------------------

    public function findChats(): array
    {
        return $this->post("/chat/findChats/{$this->instance->instance_name}", []);
    }

    public function findMessages(string $remoteJid, int $limit = 50): array
    {
        return $this->post("/chat/findMessages/{$this->instance->instance_name}", [
            'where' => ['key' => ['remoteJid' => $remoteJid]],
            'limit' => $limit,
        ]);
    }

    public function findContacts(?string $query = null): array
    {
        $payload = $query ? ['where' => ['name' => $query]] : [];
        return $this->post("/chat/findContacts/{$this->instance->instance_name}", $payload);
    }

    public function fetchProfilePicture(string $jid): array
    {
        return $this->get("/chat/fetchProfilePicture/{$this->instance->instance_name}?number={$jid}");
    }

    // -------------------------------------------------------------------------
    // HTTP helpers
    // -------------------------------------------------------------------------

    private function http()
    {
        return Http::baseUrl($this->instance->evolution_api_url)
            ->withHeader('apikey', $this->instance->evolution_api_key)
            ->acceptJson()
            ->timeout(15);
    }

    private function get(string $endpoint): array
    {
        return $this->http()->get($endpoint)->json() ?? [];
    }

    private function post(string $endpoint, array $data): array
    {
        return $this->http()->post($endpoint, $data)->json() ?? [];
    }

    private function delete(string $endpoint, array $data = []): array
    {
        return $this->http()->delete($endpoint, $data)->json() ?? [];
    }
}
