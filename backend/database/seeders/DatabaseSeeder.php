<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::create([
            'name' => 'Minha Empresa',
            'slug' => Str::slug('Minha Empresa'),
            'active' => true,
        ]);

        User::create([
            'company_id' => $company->id,
            'name' => 'Administrador',
            'email' => 'admin@admin.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
        ]);
    }
}
