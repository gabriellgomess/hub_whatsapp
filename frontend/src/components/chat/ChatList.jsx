import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getChats } from '../../api/chats'
import { useAuth } from '../../context/AuthContext'
import { getEcho } from '../../lib/echo'
import ChatListItem from './ChatListItem'

const STATUS_TABS = [
  { key: 'open', label: 'Abertas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'resolved', label: 'Resolvidas' },
]

export default function ChatList({ selectedChatId, onSelectChat, statusFilter, onStatusFilter }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Debounce da busca: só dispara query após 400ms sem digitar
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['chats', statusFilter, search],
    queryFn: () => getChats({ status: statusFilter, search: search || undefined }),
    refetchInterval: 30000,
  })

  // Escuta eventos em tempo real do canal da company
  useEffect(() => {
    if (!user?.company_id) return

    const echo = getEcho()
    if (!echo) return

    const channel = echo.private(`company.${user.company_id}`)

    channel.listen('.chat.updated', () => {
      qc.invalidateQueries({ queryKey: ['chats'] })
    })

    channel.listen('.message.received', (e) => {
      if (e.message?.chat_id) {
        qc.invalidateQueries({ queryKey: ['chat', e.message.chat_id] })
      }
      qc.invalidateQueries({ queryKey: ['chats'] })
    })

    return () => {
      echo.leave(`company.${user.company_id}`)
    }
  }, [user?.company_id, qc])

  const chats = data?.data ?? []

  return (
    <div className="w-80 flex flex-col bg-gray-900 border-r border-gray-800 flex-shrink-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <h2 className="text-white font-semibold text-base mb-3">Conversas</h2>

        {/* Busca */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-green-500 transition-colors placeholder-gray-500"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tabs de status */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onStatusFilter(tab.key)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                statusFilter === tab.key
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {search ? `Nenhum resultado para "${search}"` : `Nenhuma conversa ${statusFilter === 'open' ? 'aberta' : statusFilter === 'pending' ? 'pendente' : 'resolvida'}`}
          </div>
        ) : (
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              selected={chat.id === selectedChatId}
              onSelect={() => onSelectChat(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
