<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Contact extends Model
{
    protected $fillable = [
        'company_id', 'whatsapp_instance_id', 'jid', 'name',
        'push_name', 'phone_number', 'profile_picture', 'is_group', 'blocked', 'extra',
    ];

    protected function casts(): array
    {
        return [
            'is_group' => 'boolean',
            'blocked' => 'boolean',
            'extra' => 'array',
        ];
    }

    public function getDisplayNameAttribute(): string
    {
        return $this->name ?? $this->push_name ?? $this->phone_number ?? $this->jid;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function instance(): BelongsTo
    {
        return $this->belongsTo(WhatsappInstance::class, 'whatsapp_instance_id');
    }

    public function chat(): HasOne
    {
        return $this->hasOne(Chat::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'remote_jid', 'jid');
    }
}
