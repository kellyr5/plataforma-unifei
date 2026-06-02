/**
 * Servico de autenticacao.
 *
 * Centraliza as chamadas para os endpoints de auth do backend.
 * Cada funcao retorna a resposta da API ou lanca erro tratavel.
 */

import api, { setTokens } from './api'

interface LoginPayload {
  cpf: string
  password: string
}

interface LoginResponse {
  access: string
  refresh: string
}

interface RegisterPayload {
  cpf: string
  email: string
  nome_completo: string
  password: string
}

interface ActivatePayload {
  email: string
  codigo: string
}

/**
 * Login com CPF e senha.
 * Armazena os tokens automaticamente.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login/', payload)
  setTokens(data.access, data.refresh)
  return data
}

/**
 * Primeiro acesso (registro).
 * Cria usuario inativo e envia codigo OTP por email.
 */
export async function register(payload: RegisterPayload): Promise<{ detail: string }> {
  const { data } = await api.post('/auth/register/', payload)
  return data
}

/**
 * Ativar conta com codigo OTP.
 * Retorna tokens JWT se a ativacao for bem-sucedida.
 */
export async function activate(payload: ActivatePayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/ativar/', payload)
  setTokens(data.access, data.refresh)
  return data
}

/**
 * Reenviar codigo de ativacao.
 */
export async function resendCode(email: string): Promise<{ detail: string }> {
  const { data } = await api.post('/auth/reenviar-codigo/', { email })
  return data
}

/**
 * Extrai a mensagem de erro da resposta da API.
 * Trata os diferentes formatos que o DRF pode retornar.
 */
export function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Erro desconhecido.'

  const err = error as { response?: { data?: Record<string, unknown>; status?: number } }

  if (!err.response?.data) return 'Erro de conexao. Verifique sua internet.'

  const data = err.response.data

  /* DRF retorna erros em varios formatos */
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.non_field_errors === 'object') return (data.non_field_errors as string[])[0]

  /* Erros por campo: { "cpf": ["Este campo e obrigatorio."] } */
  const firstField = Object.keys(data)[0]
  if (firstField) {
    const msgs = data[firstField]
    if (Array.isArray(msgs)) return `${firstField}: ${msgs[0]}`
    if (typeof msgs === 'string') return msgs
  }

  return 'Erro ao processar a solicitacao.'
}
