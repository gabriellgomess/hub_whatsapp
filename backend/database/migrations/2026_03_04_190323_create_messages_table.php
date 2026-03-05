<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('whatsapp_instance_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete(); // agente que enviou
            $table->string('message_id')->unique();          // ID da mensagem na Evolution API
            $table->string('remote_jid')->index();           // JID do remetente/destinatário
            $table->boolean('from_me')->default(false);      // Enviada por nós?
            $table->enum('type', [
                'text', 'image', 'video', 'audio', 'document',
                'sticker', 'location', 'contact', 'reaction', 'poll', 'unknown'
            ])->default('text');
            $table->text('body')->nullable();                // Texto da mensagem
            $table->string('media_url')->nullable();         // URL do arquivo de mídia
            $table->string('media_mime_type')->nullable();
            $table->string('media_filename')->nullable();
            $table->string('quoted_message_id')->nullable(); // Resposta a outra mensagem
            $table->enum('status', ['pending', 'sent', 'delivered', 'read', 'error'])->default('pending');
            $table->json('raw_payload')->nullable();         // Payload original da Evolution API
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['chat_id', 'sent_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
