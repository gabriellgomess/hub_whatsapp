import api from './axios'

export const getChats = (params) =>
  api.get('/chats', { params }).then((r) => r.data)

export const getChat = (id) =>
  api.get(`/chats/${id}`).then((r) => r.data)

export const updateChatStatus = (id, status) =>
  api.patch(`/chats/${id}/status`, { status }).then((r) => r.data)

export const assignChat = (id, userId) =>
  api.patch(`/chats/${id}/assign`, { user_id: userId }).then((r) => r.data)

export const markChatAsRead = (id) =>
  api.patch(`/chats/${id}/read`).then((r) => r.data)

export const getMessages = (chatId, params) =>
  api.get(`/chats/${chatId}/messages`, { params }).then((r) => r.data)

export const sendMessage = (chatId, data) =>
  api.post(`/chats/${chatId}/messages`, data).then((r) => r.data)

export const getAgents = () =>
  api.get('/agents').then((r) => r.data)

export const deleteMessage = (chatId, messageId) =>
  api.delete(`/chats/${chatId}/messages/${messageId}`).then((r) => r.data)

export const getMessageMedia = (chatId, messageId) =>
  api.get(`/chats/${chatId}/messages/${messageId}/media`).then((r) => r.data)
