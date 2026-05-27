/**
 * Управление сессией пользователя.
 */

const TOKEN_KEY = 'access_token'
const USER_NAME_KEY = 'user_name'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUserName(): string | null {
  return localStorage.getItem(USER_NAME_KEY)
}

export function setSession(token: string, name: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_NAME_KEY, name)
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_NAME_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
