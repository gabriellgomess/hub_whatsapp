<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WhatsappInstance extends Model
{
    protected $fillable = [
        'company_id', 'name', 'instance_name', 'phone_number',
        'status', 'evolution_api_url', 'evolution_api_key',
        'webhook_secret', 'profile_picture', 'active',
    ];

    protected $hidden = ['evolution_api_key', 'webhook_secret'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }
}
