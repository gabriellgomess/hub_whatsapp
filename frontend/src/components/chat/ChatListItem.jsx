import { formatDistanceToNow } from '../ui/dateUtils'

const INSTANCE_BADGE_STYLES = [
  'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30',
  'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  'bg-rose-500/15 text-rose-300 border border-rose-500/30',
]

function getInstanceBadgeStyle(instance) {
  const key = `${instance?.id ?? ''}-${instance?.name ?? ''}`
  if (!key || key === '-') {
    return 'bg-gray-700/40 text-gray-400 border border-gray-600/40'
  }

  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i)
    hash |= 0
  }

  const index = Math.abs(hash) % INSTANCE_BADGE_STYLES.length
  return INSTANCE_BADGE_STYLES[index]
}

export default function ChatListItem({ chat, selected, onSelect }) {
  const contact = chat.contact
  const lastMessage = chat.last_message
  const assignedAgentName = chat.assigned_agent?.name || null
  const instanceBadgeStyle = getInstanceBadgeStyle(chat.instance)
  const isGroup = !!contact?.is_group
  const displayName = isGroup
    ? (contact?.name || contact?.jid || 'Grupo')
    : (contact?.name || contact?.push_name || contact?.phone_number || contact?.jid || '?')
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
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium max-w-[95px] truncate ${instanceBadgeStyle}`}>
              {chat.instance?.name || 'instancia'}
            </span>

            {/* Unread badge */}
            {chat.unread_count > 0 && (
              <span className="bg-green-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {chat.unread_count > 99 ? '99+' : chat.unread_count}
              </span>
            )}
          </div>
        </div>

        {assignedAgentName && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-cyan-300 truncate">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate">Atribuido: {assignedAgentName}</span>
          </div>
        )}
      </div>
    </button>
  )
}
