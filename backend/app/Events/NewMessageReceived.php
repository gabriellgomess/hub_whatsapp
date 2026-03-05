<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewMessageReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Message $message) {}

    public function broadcastOn(): array
    {
        $companyId = $this->message->company_id;
        $chatId = $this->message->chat_id;

        return [
            new PrivateChannel("company.{$companyId}"),
            new PrivateChannel("chat.{$chatId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.received';
    }
}
