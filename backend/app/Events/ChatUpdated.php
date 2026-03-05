<?php

namespace App\Events;

use App\Models\Chat;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Chat $chat) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("company.{$this->chat->company_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.updated';
    }
}
