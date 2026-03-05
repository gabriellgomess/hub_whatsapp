<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    protected $fillable = [
        'company_id', 'chat_id', 'whatsapp_instance_id', 'sender_user_id',
        'message_id', 'remote_jid', 'from_me', 'type', 'body',
        'media_url', 'media_mime_type', 'media_filename',
        'quoted_message_id', 'status', 'raw_payload', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'from_me' => 'boolean',
            'raw_payload' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }

    public function instance(): BelongsTo
    {
        return $this->belongsTo(WhatsappInstance::class, 'whatsapp_instance_id');
    }

    public function senderUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function quotedMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'quoted_message_id', 'message_id');
    }
}
