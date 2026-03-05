import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInstances, createInstance, deleteInstance,
  getInstanceQrCode, getInstanceStatus, disconnectInstance,
} from '../../api/admin'

const STATUS_CONFIG = {
  connected:    { label: 'Conectado',    color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  connecting:   { label: 'Conectando…',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  disconnected: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

function QrCodeModal({ instance, onClose }) {
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(true)
  const qc = useQueryClient()

  // Busca o QR code e faz polling do status
  useState(() => {
    let cancelled = false

    const fetchQr = async () => {
      try {
        const data = await getInstanceQrCode(instance.id)
        if (!cancelled) setQr(data)
      } catch {}
      if (!cancelled) setLoading(false)
    }

    fetchQr()

    // Verifica o status a cada 3s para detectar quando conectar
    const interval = setInterval(async () => {
      if (!polling || cancelled) return
      try {
        const data = await getInstanceStatus(instance.id)
        if (data.status === 'connected') {
          qc.invalidateQueries({ queryKey: ['instances'] })
          clearInterval(interval)
          onClose()
        }
      } catch {}
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const base64 = qr?.base64 || qr?.qrcode?.base64

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Conectar — {instance.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : base64 ? (
          <>
            <div className="bg-white rounded-xl p-3 flex items-center justify-center mb-4">
              <img src={base64} alt="QR Code" className="w-52 h-52 object-contain" />
            </div>
            <p className="text-gray-400 text-xs text-center">
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-gray-500 text-xs">Aguardando leitura do QR code…</p>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Não foi possível gerar o QR code.</p>
            <p className="text-gray-600 text-xs mt-1">Verifique a URL e chave da Evolution API.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InstanceForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    evolution_api_url: '',
    evolution_api_key: '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: createInstance,
    onSuccess: (data) => { onSuccess(data) },
    onError: (err) => setError(err.response?.data?.message || 'Erro ao criar instância.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Nova instância WhatsApp</h3>
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
            <label className="text-gray-400 text-sm mb-1.5 block">Nome da instância</label>
            <input
              type="text"
              required
              placeholder="ex: Suporte, Vendas"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">URL da Evolution API</label>
            <input
              type="url"
              required
              placeholder="https://evolution.seudominio.com"
              value={form.evolution_api_url}
              onChange={(e) => setForm({ ...form, evolution_api_url: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">API Key (Global Key)</label>
            <input
              type="password"
              required
              placeholder="Chave de acesso à Evolution API"
              value={form.evolution_api_key}
              onChange={(e) => setForm({ ...form, evolution_api_key: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {mutation.isPending ? 'Criando…' : 'Criar instância'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InstancesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [qrInstance, setQrInstance] = useState(null)

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['instances'],
    queryFn: getInstances,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInstance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectInstance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const handleCreated = (instance) => {
    qc.invalidateQueries({ queryKey: ['instances'] })
    setShowForm(false)
    setQrInstance(instance)
  }

  const confirmDelete = (instance) => {
    if (window.confirm(`Excluir a instância "${instance.name}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(instance.id)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-semibold">Instâncias WhatsApp</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie os números conectados à plataforma</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova instância
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : instances.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Nenhuma instância cadastrada</p>
          <p className="text-gray-600 text-xs mt-1">Clique em "Nova instância" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => {
            const statusCfg = STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.disconnected
            return (
              <div
                key={instance.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium">{instance.name}</h3>
                    <p className="text-gray-500 text-xs mt-0.5 font-mono">{instance.instance_name}</p>
                    {instance.phone_number && (
                      <p className="text-gray-400 text-xs mt-1">{instance.phone_number}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  {instance.status !== 'connected' ? (
                    <button
                      onClick={() => setQrInstance(instance)}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                    >
                      Conectar
                    </button>
                  ) : (
                    <button
                      onClick={() => disconnectMutation.mutate(instance.id)}
                      disabled={disconnectMutation.isPending}
                      className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-xs font-medium py-2 rounded-lg transition-colors border border-yellow-600/30"
                    >
                      Desconectar
                    </button>
                  )}
                  <button
                    onClick={() => confirmDelete(instance)}
                    className="w-9 h-8 flex items-center justify-center bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors border border-red-600/20"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <InstanceForm onClose={() => setShowForm(false)} onSuccess={handleCreated} />
      )}

      {qrInstance && (
        <QrCodeModal
          instance={qrInstance}
          onClose={() => setQrInstance(null)}
        />
      )}
    </div>
  )
}
