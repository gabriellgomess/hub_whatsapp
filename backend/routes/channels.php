<?php

use App\Models\Chat;
use Illuminate\Support\Facades\Broadcast;

// Canal privado da empresa — qualquer usuário autenticado da empresa pode escutar
Broadcast::channel('company.{companyId}', function ($user, int $companyId) {
    return (int) $user->company_id === $companyId;
});

// Canal privado de um chat específico — usuário deve pertencer à mesma empresa do chat
Broadcast::channel('chat.{chatId}', function ($user, int $chatId) {
    $chat = Chat::find($chatId);
    return $chat && (int) $user->company_id === (int) $chat->company_id;
});
