import axios from 'axios'
import { getStoredAccountId } from './account'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const accountId = getStoredAccountId()
  if (accountId != null) {
    config.headers.set('X-Account-Id', String(accountId))
  } else {
    config.headers.delete('X-Account-Id')
  }
  return config
})

export default api
