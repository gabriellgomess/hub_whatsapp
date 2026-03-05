<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::where('company_id', $request->user()->company_id)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'active', 'avatar', 'created_at']);

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role'     => 'required|in:admin,agent',
        ]);

        $user = User::create([
            'company_id' => $request->user()->company_id,
            'name'       => $request->name,
            'email'      => $request->email,
            'password'   => Hash::make($request->password),
            'role'       => $request->role,
            'active'     => true,
        ]);

        return response()->json($user->only('id', 'name', 'email', 'role', 'active', 'created_at'), 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request, $user);
        return response()->json($user->only('id', 'name', 'email', 'role', 'active', 'avatar', 'created_at'));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request, $user);

        $request->validate([
            'name'     => 'sometimes|string|max:100',
            'email'    => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'sometimes|string|min:8',
            'role'     => 'sometimes|in:admin,agent',
        ]);

        $data = $request->only('name', 'email', 'role');
        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return response()->json($user->fresh()->only('id', 'name', 'email', 'role', 'active', 'created_at'));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request, $user);
        abort_if($user->id === $request->user()->id, 422, 'Não é possível excluir o próprio usuário.');

        $user->delete();

        return response()->json(['ok' => true]);
    }

    public function toggleActive(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request, $user);
        abort_if($user->id === $request->user()->id, 422, 'Não é possível desativar o próprio usuário.');

        $user->update(['active' => !$user->active]);

        return response()->json(['active' => $user->fresh()->active]);
    }

    private function authorizeUser(Request $request, User $user): void
    {
        abort_if($user->company_id !== $request->user()->company_id, 403);
    }
}
