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
        Schema::create('whatsapp_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');                          // Nome amigável: "Suporte", "Vendas"
            $table->string('instance_name')->unique();       // Nome na Evolution API
            $table->string('phone_number')->nullable();      // Número conectado
            $table->enum('status', ['disconnected', 'connecting', 'connected'])->default('disconnected');
            $table->string('evolution_api_url');             // URL base da Evolution API
            $table->string('evolution_api_key');             // API key desta instância
            $table->string('webhook_secret')->nullable();    // Secret para validar webhooks
            $table->string('profile_picture')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_instances');
    }
};
