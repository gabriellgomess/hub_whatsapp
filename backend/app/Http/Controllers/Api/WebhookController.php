<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessWebhookEvent;
use App\Models\WhatsappInstance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function handle(Request $request, string $instanceName): JsonResponse
    {
        $instance = WhatsappInstance::where('instance_name', $instanceName)
            ->where('active', true)
            ->first();

        if (!$instance) {
            return response()->json(['error' => 'Instance not found'], 404);
        }

        $payload = $request->all();
        $event = $payload['event'] ?? null;

        if (!$event) {
            return response()->json(['ok' => true]);
        }

        // Despacha para fila — não processa sincronamente para responder rápido
        ProcessWebhookEvent::dispatch($instance->id, $event, $payload);

        return response()->json(['ok' => true]);
    }
}
