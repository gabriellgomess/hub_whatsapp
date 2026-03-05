import api from './axios'

// ── Instâncias ──────────────────────────────────────────────────────────────
export const getInstances = () =>
  api.get('/admin/instances').then((r) => r.data)

export const createInstance = (data) =>
  api.post('/admin/instances', data).then((r) => r.data)

export const updateInstance = (id, data) =>
  api.put(`/admin/instances/${id}`, data).then((r) => r.data)

export const deleteInstance = (id) =>
  api.delete(`/admin/instances/${id}`).then((r) => r.data)

export const getInstanceQrCode = (id) =>
  api.get(`/admin/instances/${id}/qrcode`).then((r) => r.data)

export const getInstanceStatus = (id) =>
  api.get(`/admin/instances/${id}/status`).then((r) => r.data)

export const connectInstance = (id) =>
  api.post(`/admin/instances/${id}/connect`).then((r) => r.data)

export const disconnectInstance = (id) =>
  api.post(`/admin/instances/${id}/disconnect`).then((r) => r.data)

// ── Usuários ────────────────────────────────────────────────────────────────
export const getUsers = () =>
  api.get('/admin/users').then((r) => r.data)

export const createUser = (data) =>
  api.post('/admin/users', data).then((r) => r.data)

export const updateUser = (id, data) =>
  api.put(`/admin/users/${id}`, data).then((r) => r.data)

export const deleteUser = (id) =>
  api.delete(`/admin/users/${id}`).then((r) => r.data)

export const toggleUserActive = (id) =>
  api.patch(`/admin/users/${id}/toggle-active`).then((r) => r.data)
