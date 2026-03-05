<?php

use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\WhatsappInstanceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Auth (público)
Route::post('/auth/login', [AuthController::class, 'login']);

// Webhook da Evolution API (público, validado por secret)
Route::post('/webhook/{instanceName}', [WebhookController::class, 'handle']);

// Rotas autenticadas
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Broadcasting auth (para canais privados do Reverb)
    Route::post('/broadcasting/auth', function (Illuminate\Http\Request $request) {
        return Illuminate\Support\Facades\Broadcast::auth($request);
    });

    // Agentes (para atribuição de chats)
    Route::get('/agents', function (Illuminate\Http\Request $request) {
        return response()->json(
            \App\Models\User::where('company_id', $request->user()->company_id)
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'role'])
        );
    });

    // Chats
    Route::get('/chats', [ChatController::class, 'index']);
    Route::get('/chats/{chat}', [ChatController::class, 'show']);
    Route::patch('/chats/{chat}/status', [ChatController::class, 'updateStatus']);
    Route::patch('/chats/{chat}/assign', [ChatController::class, 'assign']);
    Route::patch('/chats/{chat}/read', [ChatController::class, 'markAsRead']);

    // Mensagens
    Route::get('/chats/{chat}/messages', [MessageController::class, 'index']);
    Route::post('/chats/{chat}/messages', [MessageController::class, 'send']);
    Route::delete('/chats/{chat}/messages/{message}', [MessageController::class, 'destroy']);
    Route::get('/chats/{chat}/messages/{message}/media', [MessageController::class, 'media']);

    // Admin (apenas role=admin)
    Route::middleware('App\Http\Middleware\AdminMiddleware')->prefix('admin')->group(function () {
        // Usuários
        Route::apiResource('users', UserController::class);
        Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);

        // Instâncias WhatsApp
        Route::apiResource('instances', WhatsappInstanceController::class);
        Route::post('instances/{instance}/connect', [WhatsappInstanceController::class, 'connect']);
        Route::post('instances/{instance}/disconnect', [WhatsappInstanceController::class, 'disconnect']);
        Route::get('instances/{instance}/qrcode', [WhatsappInstanceController::class, 'qrcode']);
        Route::get('instances/{instance}/status', [WhatsappInstanceController::class, 'status']);
    });
});
