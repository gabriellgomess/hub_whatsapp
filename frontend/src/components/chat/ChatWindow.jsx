import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getChat, getMessages, sendMessage, updateChatStatus,
  markChatAsRead, assignChat, getAgents, deleteMessage,
} from '../../api/chats'
import { getEcho } from '../../lib/echo'
import MessageBubble from './MessageBubble'

const MAX_FILE_MB = 16

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function detectType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

export default function ChatWindow({ chatId }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [attachment, setAttachment] = useState(null) // { file, base64, type, mimeType, preview }
  const [attachError, setAttachError] = useState('')
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  const { data: chat } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId),
  })

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => getMessages(chatId),
  })

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    staleTime: 60000,
  })

  const messages = [...(messagesData?.data ?? [])].reverse()

  // Marca como lido ao abrir
  useEffect(() => {
    if (chat?.unread) {
      markChatAsRead(chatId).then(() => {
        qc.invalidateQueries({ queryKey: ['chats'] })
        qc.invalidateQueries({ queryKey: ['chat', chatId] })
      })
    }
  }, [chatId, chat?.unread])

  // Escuta mensagens em tempo real
  useEffect(() => {
    const echo = getEcho()
    if (!echo) return
    const channel = echo.private(`chat.${chatId}`)
    channel.listen('.message.received', (e) => {
      if (!e.message) return
      qc.setQueryData(['messages', chatId], (old) => {
        if (!old) return old
        const exists = old.data.some((m) => m.id === e.message.id)
        if (exists) return old
        return { ...old, data: [e.message, ...old.data] }
      })
      qc.invalidateQueries({ queryKey: ['chat', chatId] })
      qc.invalidateQueries({ queryKey: ['chats'] })
    })
    return () => echo.leave(`chat.${chatId}`)
  }, [chatId, qc])

  // Scroll para o fim ao receber nova mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Limpa attachment ao trocar de chat
  useEffect(() => {
    setAttachment(null)
    setAttachError('')
    setText('')
  }, [chatId])

  const sendMutation = useMutation({
    mutationFn: (data) => sendMessage(chatId, data),
    onSuccess: (newMsg) => {
      qc.setQueryData(['messages', chatId], (old) => {
        if (!old) return old
        return { ...old, data: [newMsg, ...old.data] }
      })
      qc.invalidateQueries({ queryKey: ['chats'] })
      setText('')
      setAttachment(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateChatStatus(chatId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', chatId] })
      qc.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: (userId) => assignChat(chatId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', chatId] })
      qc.invalidateQueries({ queryKey: ['chats'] })
      setShowAssign(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ msgId }) => deleteMessage(chatId, msgId),
    onSuccess: (_, { msgId }) => {
      qc.setQueryData(['messages', chatId], (old) => {
        if (!old) return old
        return { ...old, data: old.data.filter((m) => m.id !== msgId) }
      })
      qc.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setAttachError(`Arquivo muito grande. Máximo ${MAX_FILE_MB}MB.`)
      return
    }

    setAttachError('')
    const base64 = await fileToBase64(file)
    const type = detectType(file.type)
    setAttachment({
      file,
      base64,
      type,
      mimeType: file.type,
      preview: type === 'image' ? URL.createObjectURL(file) : null,
    })
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (attachment) {
      sendMutation.mutate({
        type: attachment.type,
        body: text.trim() || null,
        media_base64: attachment.base64,
        media_mime_type: attachment.mimeType,
        media_filename: attachment.file.name,
      })
    } else {
      if (!text.trim()) return
      sendMutation.mutate({ type: 'text', body: text.trim() })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !attachment) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const contact = chat?.contact
  const displayName = contact?.name || contact?.push_name || contact?.phone_number || contact?.jid || '...'

  const statusConfig = {
    open:     { label: 'Aberta',    color: 'text-green-400',  next: 'pending',  nextLabel: 'Marcar pendente' },
    pending:  { label: 'Pendente',  color: 'text-yellow-400', next: 'resolved', nextLabel: 'Resolver' },
    resolved: { label: 'Resolvida', color: 'text-gray-400',   next: 'open',     nextLabel: 'Reabrir' },
  }
  const currentStatus = statusConfig[chat?.status] ?? statusConfig.open

  const canSend = attachment ? true : text.trim().length > 0

  return (
    <div className="flex flex-col h-full" onClick={() => showAssign && setShowAssign(false)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-medium">{displayName}</p>
            <p className="text-gray-500 text-xs">{contact?.phone_number || contact?.jid}</p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className={`text-xs font-medium ${currentStatus.color}`}>
            {currentStatus.label}
          </span>

          <button
            onClick={() => statusMutation.mutate(currentStatus.next)}
            disabled={statusMutation.isPending}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            {currentStatus.nextLabel}
          </button>

          {/* Atribuição de agente */}
          <div className="relative">
            <button
              onClick={() => setShowAssign((v) => !v)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {chat?.assigned_agent ? chat.assigned_agent.name : 'Atribuir'}
            </button>
            {showAssign && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1">
                <button
                  onClick={() => assignMutation.mutate(null)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Sem agente
                </button>
                {(agents ?? []).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => assignMutation.mutate(agent.id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-700 ${
                      chat?.assigned_to === agent.id ? 'text-green-400' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {agent.name}{chat?.assigned_to === agent.id && ' ✓'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-950">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Nenhuma mensagem
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                showDate={
                  i === 0 ||
                  new Date(msg.sent_at).toDateString() !==
                  new Date(messages[i - 1]?.sent_at).toDateString()
                }
                onDelete={() => deleteMutation.mutate({ msgId: msg.id })}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Preview de anexo */}
      {attachment && (
        <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 shrink-0">
          <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
            {attachment.preview ? (
              <img src={attachment.preview} alt="preview" className="w-16 h-16 object-cover rounded-lg" />
            ) : (
              <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-2xl">
                {attachment.type === 'audio' ? '🎵' : attachment.type === 'video' ? '🎬' : '📄'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{attachment.file.name}</p>
              <p className="text-gray-400 text-xs">{(attachment.file.size / 1024 / 1024).toFixed(2)} MB · {attachment.type}</p>
            </div>
            <button
              onClick={() => setAttachment(null)}
              className="text-gray-400 hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {attachError && <p className="text-red-400 text-xs mt-1">{attachError}</p>}
        </div>
      )}

      {/* Input de envio */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 bg-gray-900 border-t border-gray-800 shrink-0"
      >
        {/* Botão de anexo */}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Anexar arquivo"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachment ? 'Legenda (opcional)...' : 'Digite uma mensagem... (Enter para enviar)'}
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500 max-h-32 overflow-y-auto"
          style={{ minHeight: '42px' }}
        />

        <button
          type="submit"
          disabled={!canSend || sendMutation.isPending}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-colors shrink-0"
        >
          {sendMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
