import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../ui/dateUtils'
import { getMessageMedia } from '../../api/chats'

const statusIcons = {
  pending:   <span title="Pendente" className="text-green-200/50">🕐</span>,
  sent:      <span title="Enviado">✓</span>,
  delivered: <span title="Entregue" className="text-gray-300/60">✓✓</span>,
  read:      <span title="Lido" className="text-blue-300">✓✓</span>,
  error:     <span title="Erro" className="text-red-400">✗</span>,
}

function ImageViewer({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <img
        src={src}
        alt="imagem"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-xl hover:bg-black/70 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

function MediaLoadButton({ onLoad, loading, error, label, icon }) {
  return (
    <button
      onClick={onLoad}
      disabled={loading}
      className="flex items-center gap-2 bg-black/20 hover:bg-black/30 rounded-lg px-3 py-2 transition-colors mb-1 disabled:opacity-50"
    >
      <span className="text-lg shrink-0">{icon}</span>
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
      ) : (
        <span className="text-sm">{error ? 'Erro — tentar novamente' : label}</span>
      )}
    </button>
  )
}

function formatParticipantJid(participantJid) {
  if (!participantJid || typeof participantJid !== 'string') return null
  return participantJid.split('@')[0] || null
}

function getGroupSenderName(message) {
  const raw = message?.raw_payload ?? {}
  const senderName = raw.pushName
  if (senderName && typeof senderName === 'string' && senderName.trim() !== '') {
    return senderName.trim()
  }

  const participantJid = raw?.key?.participant || raw?.participant
  return formatParticipantJid(participantJid)
}

export default function MessageBubble({ message, showDate, onDelete, isGroupChat = false }) {
  const isMe = message.from_me
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [showViewer, setShowViewer] = useState(false)
  const groupSenderName = isGroupChat && !isMe ? getGroupSenderName(message) : null
  const autoLoadAttemptedRef = useRef(false)

  const mediaSrc = loadedSrc || message.media_url || null
  const canAutoLoadMedia = ['image', 'video', 'audio', 'document'].includes(message.type)

  const handleLoadMedia = useCallback(async () => {
    setLoadingMedia(true)
    setMediaError(false)
    try {
      const res = await getMessageMedia(message.chat_id, message.id)
      if (res.base64 && res.mimetype) {
        setLoadedSrc(`data:${res.mimetype};base64,${res.base64}`)
      } else {
        setMediaError(true)
      }
    } catch {
      setMediaError(true)
    }
    setLoadingMedia(false)
  }, [message.chat_id, message.id])

  useEffect(() => {
    if (!canAutoLoadMedia || mediaSrc || autoLoadAttemptedRef.current) {
      return
    }

    autoLoadAttemptedRef.current = true
    const timeoutId = setTimeout(() => {
      handleLoadMedia()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [canAutoLoadMedia, mediaSrc, message.id, handleLoadMedia])

  const renderMedia = () => {
    switch (message.type) {
      case 'image':
        return mediaSrc ? (
          <div className="mb-1">
            <img
              src={mediaSrc}
              alt="imagem"
              className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setShowViewer(true)}
            />
          </div>
        ) : (
          <MediaLoadButton onLoad={handleLoadMedia} loading={loadingMedia} error={mediaError} label="Carregar imagem" icon="📷" />
        )

      case 'video':
        return mediaSrc ? (
          <video src={mediaSrc} controls className="rounded-lg max-w-full max-h-64 mb-1" />
        ) : (
          <MediaLoadButton onLoad={handleLoadMedia} loading={loadingMedia} error={mediaError} label="Carregar vídeo" icon="🎬" />
        )

      case 'audio':
        return mediaSrc ? (
          <audio src={mediaSrc} controls className="w-52 my-1" style={{ colorScheme: 'dark' }} />
        ) : (
          <MediaLoadButton onLoad={handleLoadMedia} loading={loadingMedia} error={mediaError} label="Carregar áudio" icon="🎵" />
        )

      case 'document':
        return mediaSrc ? (
          <a
            href={mediaSrc}
            download={message.media_filename || 'arquivo'}
            className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 hover:bg-black/30 transition-colors mb-1"
            target="_blank"
            rel="noreferrer"
          >
            <span className="text-xl shrink-0">📄</span>
            <span className="text-sm truncate flex-1">{message.media_filename || 'Documento'}</span>
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        ) : (
          <MediaLoadButton onLoad={handleLoadMedia} loading={loadingMedia} error={mediaError} label={message.media_filename || 'Baixar documento'} icon="📄" />
        )

      case 'location':
        return (
          <a
            href={`https://www.google.com/maps?q=${message.body?.replace('Lat: ', '').replace(', Lng: ', ',')}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            📍 {message.body}
          </a>
        )

      case 'sticker':
        return mediaSrc
          ? <img src={mediaSrc} alt="sticker" className="w-24 h-24 object-contain" />
          : <span className="text-3xl">🖼️</span>

      case 'reaction':
        return <span className="text-2xl">{message.body}</span>

      default:
        return <p className="text-xs text-gray-400 italic">[{message.type}]</p>
    }
  }

  const hasCaption = message.body && !['text', 'location', 'reaction'].includes(message.type)

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
            {new Date(message.sent_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>
      )}

      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5 group`}>
        {/* Botão de excluir — aparece no hover */}
        <button
          onClick={onDelete}
          title="Excluir mensagem"
          className={`self-center mx-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 ${
            isMe ? 'order-first' : 'order-last'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        <div
          className={`max-w-[65%] rounded-2xl px-3.5 py-2 ${
            isMe
              ? 'bg-green-700 text-white rounded-br-sm'
              : 'bg-gray-800 text-white rounded-bl-sm'
          }`}
        >
          {/* Remetente */}
          {groupSenderName ? (
            <p className="text-cyan-300 text-xs font-semibold mb-1">{groupSenderName}</p>
          ) : (
            !isMe && message.sender_user && (
              <p className="text-green-400 text-xs font-semibold mb-1">{message.sender_user.name}</p>
            )
          )}

          {/* Conteúdo */}
          {message.type === 'text' ? (
            <p className="text-sm whitespace-pre-wrap wrap-break-word">{message.body}</p>
          ) : (
            <>
              {renderMedia()}
              {hasCaption && (
                <p className="text-sm whitespace-pre-wrap wrap-break-word mt-1">{message.body}</p>
              )}
            </>
          )}

          {/* Footer: hora + status */}
          <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMe ? 'text-green-200/70' : 'text-gray-500'}`}>
            <span className="text-xs">{message.sent_at ? formatTime(message.sent_at) : ''}</span>
            {isMe && <span className="text-xs leading-none">{statusIcons[message.status] ?? ''}</span>}
          </div>
        </div>
      </div>

      {showViewer && mediaSrc && (
        <ImageViewer src={mediaSrc} onClose={() => setShowViewer(false)} />
      )}
    </>
  )
}
