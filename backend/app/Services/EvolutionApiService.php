<?php

namespace App\Services;

use App\Models\WhatsappInstance;
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
            'webhook' => [
                'enabled'  => true,
                'url'      => $webhookUrl,
                'byEvents' => false,
                'base64'   => false,
                'events'   => [
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'CONNECTION_UPDATE',
                    'CONTACTS_UPDATE',
                    'CHATS_UPDATE',
                ],
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Mensagens — Envio
    // -------------------------------------------------------------------------

    public function sendText(string $to, string $text, ?string $quotedMessageId = null): array
    {
        $payload = [
            'number' => $to,
            'text'   => $text,
        ];

        if ($quotedMessageId) {
            $payload['quoted'] = ['key' => ['id' => $quotedMessageId]];
        }

        return $this->post("/message/sendText/{$this->instance->instance_name}", $payload);
    }

    /**
     * Envia imagem, vídeo ou documento.
     * $media pode ser uma URL ou string base64.
     * Quando base64, $mimetype é obrigatório.
     */
    public function sendMedia(
        string  $to,
        string  $media,
        string  $mediaType,
        ?string $caption  = null,
        ?string $filename = null,
        ?string $mimetype = null,
        ?string $quotedMessageId = null
    ): array {
        $payload = [
            'number'    => $to,
            'mediatype' => $mediaType,
            'media'     => $media,
            'caption'   => $caption,
            'fileName'  => $filename,
        ];

        if ($mimetype) {
            $payload['mimetype'] = $mimetype;
        }

        if ($quotedMessageId) {
            $payload['quoted'] = ['key' => ['id' => $quotedMessageId]];
        }

        return $this->post("/message/sendMedia/{$this->instance->instance_name}", $payload);
    }

    /**
     * Envia áudio no formato PTT (narrado/microfone) do WhatsApp.
     * $audio pode ser URL ou base64.
     */
    public function sendWhatsAppAudio(
        string  $to,
        string  $audio,
        ?string $quotedMessageId = null
    ): array {
        $payload = [
            'number'   => $to,
            'audio'    => $audio,
            'encoding' => true,
        ];

        if ($quotedMessageId) {
            $payload['quoted'] = ['key' => ['id' => $quotedMessageId]];
        }

        return $this->post("/message/sendWhatsAppAudio/{$this->instance->instance_name}", $payload);
    }

    public function sendReaction(string $to, string $messageId, string $emoji): array
    {
        return $this->post("/message/sendReaction/{$this->instance->instance_name}", [
            'key'      => ['remoteJid' => $to, 'id' => $messageId],
            'reaction' => $emoji,
        ]);
    }

    // -------------------------------------------------------------------------
    // Mensagens — Exclusão
    // -------------------------------------------------------------------------

    /**
     * Apaga mensagem para todos.
     * Só funciona para mensagens enviadas por nós (fromMe = true).
     */
    public function deleteMessageForEveryone(string $remoteJid, string $messageId, bool $fromMe): array
    {
        return $this->delete("/chat/deleteMessageForEveryone/{$this->instance->instance_name}", [
            'id'        => $messageId,
            'remoteJid' => $remoteJid,
            'fromMe'    => $fromMe,
        ]);
    }

    // -------------------------------------------------------------------------
    // Mensagens — Mídia
    // -------------------------------------------------------------------------

    /**
     * Busca o conteúdo em base64 de uma mensagem de mídia recebida.
     * Retorna array com campos: base64, mimetype, fileName, etc.
     */
    public function getMediaBase64(string $messageId, bool $convertToMp4 = false): array
    {
        return $this->post("/chat/getBase64FromMediaMessage/{$this->instance->instance_name}", [
            'message'      => ['key' => ['id' => $messageId]],
            'convertToMp4' => $convertToMp4,
        ]);
    }

    // -------------------------------------------------------------------------
    // Chats / Contatos
    // -------------------------------------------------------------------------

    public function markAsRead(string $remoteJid, array $messageIds): array
    {
        return $this->post("/chat/readMessage/{$this->instance->instance_name}", [
            'readMessages' => array_map(fn ($id) => [
                'remoteJid' => $remoteJid,
                'fromMe'    => false,
                'id'        => $id,
            ], $messageIds),
        ]);
    }

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
        $endpoint = "/chat/fetchProfilePictureUrl/{$this->instance->instance_name}";
        $numbers = [$jid];

        $baseNumber = strstr($jid, '@', true);
        if ($baseNumber !== false && $baseNumber !== '') {
            $numbers[] = $baseNumber;
        }

        $lastResponse = [];

        foreach (array_values(array_unique($numbers)) as $number) {
            $response = $this->post($endpoint, ['number' => $number]);
            $lastResponse = is_array($response) ? $response : [];

            if ($this->containsProfilePictureUrl($lastResponse)) {
                return $lastResponse;
            }
        }

        // Compatibilidade com providers antigos.
        foreach (array_values(array_unique($numbers)) as $number) {
            $response = $this->get("/chat/fetchProfilePicture/{$this->instance->instance_name}?number={$number}");
            $lastResponse = is_array($response) ? $response : [];

            if ($this->containsProfilePictureUrl($lastResponse)) {
                return $lastResponse;
            }
        }

        return $lastResponse;
    }

    public function findGroupInfo(string $groupJid): array
    {
        $groupJid = urlencode($groupJid);
        return $this->get("/group/findGroupInfos/{$this->instance->instance_name}?groupJid={$groupJid}");
    }

    // -------------------------------------------------------------------------
    // HTTP helpers
    // -------------------------------------------------------------------------

    private function http()
    {
        return Http::baseUrl($this->instance->evolution_api_url)
            ->withHeader('apikey', $this->instance->evolution_api_key)
            ->acceptJson()
            ->timeout(30);
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

    private function containsProfilePictureUrl(array $payload): bool
    {
        $keys = ['profilePictureUrl', 'profilePicture', 'profilePicUrl', 'url'];

        foreach ($keys as $key) {
            if (isset($payload[$key]) && is_string($payload[$key]) && trim($payload[$key]) !== '') {
                return true;
            }
        }

        foreach ($payload as $value) {
            if (is_array($value) && $this->containsProfilePictureUrl($value)) {
                return true;
            }
        }

        return false;
    }
}
