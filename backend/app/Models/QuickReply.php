<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuickReply extends Model
{
    protected $fillable = ['company_id', 'shortcut', 'title', 'content'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
