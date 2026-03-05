<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\WhatsappInstance;
use App\Services\EvolutionApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WhatsappInstanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $instances = WhatsappInstance::where('company_id', $request->user()->company_id)
            ->orderBy('name')
            ->get();

        return response()->json($instances);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'               => 'required|string|max:100',
            'evolution_api_url'  => 'required|url',
            'evolution_api_key'  => 'required|string',
        ]);

        $instanceName = Str::slug($request->name) . '-' . Str::random(6);

        $instance = WhatsappInstance::create([
            'company_id'         => $request->user()->company_id,
            'name'               => $request->name,
            'instance_name'      => $instanceName,
            'evolution_api_url'  => rtrim($request->evolution_api_url, '/'),
            'evolution_api_key'  => $request->evolution_api_key,
            'webhook_secret'     => Str::random(32),
            'status'             => 'disconnected',
            'active'             => true,
        ]);

        // Cria a instância na Evolution API
        $this->createOnEvolution($instance);

        // Configura o webhook automaticamente
        $this->setupWebhook($request, $instance);

        return response()->json($instance, 201);
    }

    public function show(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);
        return response()->json($instance);
    }

    public function update(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);

        $request->validate([
            'name'              => 'sometimes|string|max:100',
            'evolution_api_url' => 'sometimes|url',
            'evolution_api_key' => 'sometimes|string',
            'active'            => 'sometimes|boolean',
        ]);

        $instance->update($request->only('name', 'evolution_api_url', 'evolution_api_key', 'active'));

        return response()->json($instance->fresh());
    }

    public function destroy(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);

        try {
            $service = new EvolutionApiService($instance);
            $service->logout();
        } catch (\Throwable) {}

        $instance->delete();

        return response()->json(['ok' => true]);
    }

    public function connect(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);

        $service = new EvolutionApiService($instance);
        $result = $service->getQrCode();

        return response()->json($result);
    }

    public function disconnect(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);

        $service = new EvolutionApiService($instance);
        $result = $service->logout();

        $instance->update(['status' => 'disconnected', 'phone_number' => null]);

        return response()->json($result);
    }

    public function qrcode(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);

        $service = new EvolutionApiService($instance);
        $result = $service->getQrCode();

        return response()->json($result);
    }

    public function status(Request $request, WhatsappInstance $instance): JsonResponse
    {
        $this->authorizeInstance($request, $instance);

        $service = new EvolutionApiService($instance);
        $result = $service->getConnectionStatus();

        // Sincroniza o status localmente
        $state = $result['instance']['state'] ?? null;
        $statusMap = ['open' => 'connected', 'close' => 'disconnected', 'connecting' => 'connecting'];
        if ($state && isset($statusMap[$state])) {
            $instance->update(['status' => $statusMap[$state]]);
        }

        return response()->json([
            'status' => $instance->fresh()->status,
            'raw'    => $result,
        ]);
    }

    private function createOnEvolution(WhatsappInstance $instance): void
    {
        try {
            \Illuminate\Support\Facades\Http::baseUrl($instance->evolution_api_url)
                ->withHeader('apikey', $instance->evolution_api_key)
                ->post('/instance/create', [
                    'instanceName' => $instance->instance_name,
                    'qrcode'       => true,
                    'integration'  => 'WHATSAPP-BAILEYS',
                ]);
        } catch (\Throwable) {}
    }

    private function setupWebhook(Request $request, WhatsappInstance $instance): void
    {
        try {
            $webhookUrl = config('app.url') . '/api/webhook/' . $instance->instance_name;
            $service = new EvolutionApiService($instance);
            $service->setWebhook($webhookUrl);
        } catch (\Throwable) {}
    }

    private function authorizeInstance(Request $request, WhatsappInstance $instance): void
    {
        abort_if($instance->company_id !== $request->user()->company_id, 403);
    }
}
