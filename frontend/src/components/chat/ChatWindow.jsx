import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getChat, getMessages, sendMessage, updateChatStatus, markChatAsRead } from '../../api/chats'
import { getEcho } from '../../lib/echo'
import MessageBubble from './MessageBubble'
import { formatTime } from '../ui/dateUtils'

export default function ChatWindow({ chatId }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  const { data: chat } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId),
  })

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => getMessages(chatId),
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

  // Escuta mensagens em tempo real no canal do chat
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

    return () => {
      echo.leave(`chat.${chatId}`)
    }
  }, [chatId, qc])

  // Scroll para o fim ao receber nova mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMutation = useMutation({
    mutationFn: (data) => sendMessage(chatId, data),
    onSuccess: (newMsg) => {
      qc.setQueryData(['messages', chatId], (old) => {
        if (!old) return old
        return { ...old, data: [newMsg, ...old.data] }
      })
      qc.invalidateQueries({ queryKey: ['chats'] })
      setText('')
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateChatStatus(chatId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', chatId] })
      qc.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const handleSend = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    sendMutation.mutate({ type: 'text', body: text.trim() })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

  return (
    <div className="flex flex-col h-full">
      {/* Header do chat */}
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

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className={`text-xs font-medium ${currentStatus.color}`}>
            {currentStatus.label}
          </span>

          {/* Botão de mudança de status */}
          <button
            onClick={() => statusMutation.mutate(currentStatus.next)}
            disabled={statusMutation.isPending}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            {currentStatus.nextLabel}
          </button>

          {/* Agente atribuído */}
          {chat?.assigned_agent && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">
              {chat.assigned_agent.name}
            </span>
          )}
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
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input de envio */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 bg-gray-900 border-t border-gray-800 shrink-0"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem... (Enter para enviar)"
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500 max-h-32 overflow-y-auto"
          style={{ minHeight: '42px' }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sendMutation.isPending}
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
