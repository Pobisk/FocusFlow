const API_BASE = '/api'

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/**
 * Извлекает сообщение об ошибке из ответа API.
 * Поддерживает форматы:
 * - { "detail": { "error": "..." } }  — HTTPException с detail={error: ...}
 * - { "detail": "..." }                — HTTPException со строкой
 * - { "error": "..." }                 — плоский формат
 * - { "detail": [...] }                — Pydantic validation errors
 */
function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null

  const obj = data as Record<string, unknown>

  // { detail: { error: "..." } }
  if (obj.detail && typeof obj.detail === 'object') {
    const detail = obj.detail as Record<string, unknown>
    if (typeof detail.error === 'string') return detail.error
  }

  // { detail: "..." }
  if (typeof obj.detail === 'string') return obj.detail

  // { error: "..." }
  if (typeof obj.error === 'string') return obj.error

  return null
}

/**
 * Базовый fetch с авторизацией.
 * Автоматически подставляет JWT-токен из localStorage.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('access_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorMessage = 'Ошибка запроса'
    try {
      const errorData = await response.json()
      const extracted = extractErrorMessage(errorData)
      if (extracted) errorMessage = extracted
    } catch {
      // ignore parse error
    }
    throw new ApiRequestError(errorMessage, response.status)
  }

  return response.json() as Promise<T>
}

// ── Auth API ─────────────────────────────────────────

interface AuthRequest {
  login: string
  hash: string
}

interface AuthResponse {
  name: string
  access_token: string
  token_type: string
}

export async function authLogin(login: string, hash: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth', {
    method: 'POST',
    body: JSON.stringify({ login, hash } satisfies AuthRequest),
  })
}

// ── Sphere API ───────────────────────────────────────

interface Sphere {
  id: string
  code: string
  name: string
  order: number
  is_active: boolean
  satisfaction: number
}

export async function getSpheres(): Promise<Sphere[]> {
  return apiFetch<Sphere[]>('/sphere')
}
