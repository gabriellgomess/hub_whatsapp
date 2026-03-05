import { formatTime } from '../ui/dateUtils'

const statusIcons = {
  pending:   <span title="Pendente">🕐</span>,
  sent:      <span title="Enviado">✓</span>,
  delivered: <span title="Entregue" className="text-gray-400">✓✓</span>,
  read:      <span title="Lido" className="text-blue-400">✓✓</span>,
  error:     <span title="Erro" className="text-red-400">✗</span>,
}

export default function MessageBubble({ message, showDate }) {
  const isMe = message.from_me

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
            {new Date(message.sent_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>
      )}

      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5`}>
        <div
          className={`max-w-[65%] rounded-2xl px-3.5 py-2 ${
            isMe
              ? 'bg-green-700 text-white rounded-br-sm'
              : 'bg-gray-800 text-white rounded-bl-sm'
          }`}
        >
          {/* Remetente (em grupos) */}
          {!isMe && message.sender_user && (
            <p className="text-green-400 text-xs font-semibold mb-1">
              {message.sender_user.name}
            </p>
          )}

          {/* Conteúdo */}
          {message.type === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
          )}

          {message.type === 'image' && (
            <div>
              {message.media_url ? (
                <img src={message.media_url} alt="imagem" className="rounded-lg max-w-full mb-1" />
              ) : (
                <div className="bg-gray-700 rounded-lg w-48 h-32 flex items-center justify-center text-gray-400 text-xs">
                  📷 Imagem
                </div>
              )}
              {message.body && <p className="text-sm mt-1">{message.body}</p>}
            </div>
          )}

          {message.type === 'audio' && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              🎵 Áudio
            </div>
          )}

          {message.type === 'video' && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              🎬 Vídeo {message.media_filename && `— ${message.media_filename}`}
            </div>
          )}

          {message.type === 'document' && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              📄 {message.media_filename || 'Documento'}
            </div>
          )}

          {message.type === 'location' && (
            <div className="text-sm text-gray-300">📍 {message.body}</div>
          )}

          {message.type === 'sticker' && (
            <div className="text-2xl">🖼️</div>
          )}

          {!['text','image','audio','video','document','location','sticker'].includes(message.type) && (
            <p className="text-xs text-gray-400 italic">[{message.type}]</p>
          )}

          {/* Footer: hora + status */}
          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-green-200/70' : 'text-gray-500'}`}>
            <span className="text-xs">{message.sent_at ? formatTime(message.sent_at) : ''}</span>
            {isMe && <span className="text-xs">{statusIcons[message.status] ?? ''}</span>}
          </div>
        </div>
      </div>
    </>
  )
}
