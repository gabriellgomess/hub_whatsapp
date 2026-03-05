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
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('whatsapp_instance_id')->constrained()->cascadeOnDelete();
            $table->string('jid')->index();                  // ID WhatsApp: 5511999999999@s.whatsapp.net
            $table->string('name')->nullable();              // Nome salvo nos contatos
            $table->string('push_name')->nullable();         // Nome do perfil WhatsApp
            $table->string('phone_number')->nullable();
            $table->string('profile_picture')->nullable();
            $table->boolean('is_group')->default(false);
            $table->boolean('blocked')->default(false);
            $table->json('extra')->nullable();               // Dados adicionais da Evolution API
            $table->timestamps();

            $table->unique(['whatsapp_instance_id', 'jid']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
