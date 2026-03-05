<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    protected $fillable = ['name', 'slug', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function whatsappInstances(): HasMany
    {
        return $this->hasMany(WhatsappInstance::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class);
    }

    public function labels(): HasMany
    {
        return $this->hasMany(Label::class);
    }

    public function quickReplies(): HasMany
    {
        return $this->hasMany(QuickReply::class);
    }
}
