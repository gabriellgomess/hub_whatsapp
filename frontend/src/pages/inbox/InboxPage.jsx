import { useState } from 'react'
import ChatList from '../../components/chat/ChatList'
import ChatWindow from '../../components/chat/ChatWindow'
import Sidebar from '../../components/chat/Sidebar'

export default function InboxPage() {
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('open')

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar de navegação */}
      <Sidebar />

      {/* Lista de chats */}
      <ChatList
        selectedChatId={selectedChatId}
        onSelectChat={setSelectedChatId}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />

      {/* Janela de mensagens */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
