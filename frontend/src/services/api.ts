/**
 * Configuracao central do Axios.
 *
 * - Base URL via proxy do Vite (/api -> localhost:8000)
 * - Interceptor que injeta o token JWT em toda requisicao
 * - Interceptor que tenta renovar o token quando expira (401)
 * - Armazena tokens no localStorage
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

/* === Funcoes de gerenciamento de tokens === */

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

export function clearTokens(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

/* === Interceptor de requisicao: injeta o token === */

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* === Interceptor de resposta: renova token expirado === */

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    /* Se o erro nao e 401 ou ja tentou renovar, rejeita */
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    /* Se ja esta renovando, enfileira a requisicao */
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refresh = getRefreshToken()
      if (!refresh) throw new Error('Sem refresh token')

      const { data } = await axios.post('/api/auth/refresh/', { refresh })
      const newAccess = data.access

      localStorage.setItem('access_token', newAccess)

      /* O backend rotaciona o refresh e invalida o anterior no Redis, entao o
         token novo precisa substituir o antigo aqui. Sem isso, a proxima
         renovacao apresentaria um token ja invalidado e derrubaria a sessao. */
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh)
      }

      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`
      processQueue(null, newAccess)

      originalRequest.headers.Authorization = `Bearer ${newAccess}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearTokens()
      window.location.href = '/'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
