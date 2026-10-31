import { api } from './client'
import type { Me, User } from './types'

export function login(email: string, password: string): Promise<User> {
  return api<User>('POST', '/auth/login', { body: { email, password } })
}

export function logout(): Promise<void> {
  return api('POST', '/auth/logout')
}

export function getMe(): Promise<Me> {
  return api<Me>('GET', '/me')
}

export function changePassword(current_password: string, new_password: string): Promise<void> {
  return api('PUT', '/me/password', { body: { current_password, new_password } })
}

export function requestPasswordReset(email: string): Promise<void> {
  return api('POST', '/auth/password-reset', { body: { email } })
}

export function confirmPasswordReset(token: string, password: string): Promise<void> {
  return api('POST', '/auth/password-reset/confirm', { body: { token, password } })
}
