import { formatDistanceToNow } from '../ui/dateUtils'

export default function ChatListItem({ chat, selected, onSelect }) {
  const contact = chat.contact
  const lastMessage = chat.last_message
  const displayName = contact?.name || contact?.push_name || contact?.phone_number || contact?.jid || '?'
  const initials = displayName.charAt(0).toUpperCase()

  const statusColors = {
    open: 'bg-green-500',
    pending: 'bg-yellow-500',
    resolved: 'bg-gray-500',
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 ${
        selected ? 'bg-gray-800' : ''
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {contact?.profile_picture ? (
          <img
            src={contact.profile_picture}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
            {initials}
          </div>
        )}
        {/* Status dot */}
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${statusColors[chat.status] ?? 'bg-gray-500'}`} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-white text-sm font-medium truncate">{displayName}</span>
          <span className="text-gray-500 text-xs flex-shrink-0">
            {chat.last_message_at ? formatDistanceToNow(chat.last_message_at) : ''}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-gray-400 text-xs truncate">
            {lastMessage?.from_me && <span className="text-gray-500">Você: </span>}
            {lastMessage?.body || (lastMessage?.type !== 'text' ? `[${lastMessage?.type}]` : '—')}
          </span>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Instância badge */}
            <span className="text-gray-600 text-xs">{chat.instance?.name}</span>

            {/* Unread badge */}
            {chat.unread_count > 0 && (
              <span className="bg-green-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {chat.unread_count > 99 ? '99+' : chat.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
