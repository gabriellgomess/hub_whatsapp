import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser, toggleUserActive } from '../../api/admin'

const ROLE_LABELS = { admin: 'Admin', agent: 'Agente' }

function UserForm({ user, onClose, onSuccess }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'agent',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateUser(user.id, data) : createUser(data),
    onSuccess,
    onError: (err) => setError(err.response?.data?.message || 'Erro ao salvar usuário.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const data = { ...form }
    if (isEdit && !data.password) delete data.password
    mutation.mutate(data)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{isEdit ? 'Editar usuário' : 'Novo usuário'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">Nome</label>
            <input
              type="text" required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">E-mail</label>
            <input
              type="email" required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">
              Senha {isEdit && <span className="text-gray-600">(deixe em branco para manter)</span>}
            </label>
            <input
              type="password"
              required={!isEdit}
              placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">Perfil</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors"
            >
              <option value="agent">Agente</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg py-2.5 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
              {mutation.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [formUser, setFormUser] = useState(null) // null = fechado, false = novo, {…} = editar

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  const toggleMutation = useMutation({
    mutationFn: toggleUserActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] })
    setFormUser(null)
  }

  const confirmDelete = (user) => {
    if (window.confirm(`Excluir o usuário "${user.name}"?`)) {
      deleteMutation.mutate(user.id)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-semibold">Usuários</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie os agentes e administradores</p>
        </div>
        <button
          onClick={() => setFormUser(false)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo usuário
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 font-medium px-5 py-3">Usuário</th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">Perfil</th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">Status</th>
                <th className="text-right text-gray-400 font-medium px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-gray-500 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      user.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggleMutation.mutate(user.id)}
                      disabled={toggleMutation.isPending}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        user.active
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                      }`}
                    >
                      {user.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setFormUser(user)}
                        className="text-gray-400 hover:text-white text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => confirmDelete(user)}
                        className="text-red-400 hover:text-red-300 text-xs bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formUser !== null && (
        <UserForm
          user={formUser || null}
          onClose={() => setFormUser(null)}
          onSuccess={handleSaved}
        />
      )}
    </div>
  )
}
