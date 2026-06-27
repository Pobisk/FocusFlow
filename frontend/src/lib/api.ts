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
 * Очищает сессию и перенаправляет на страницу логина.
 */
function handleUnauthorized(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_name')
  window.location.href = '/'
}

/**
 * Базовый fetch с авторизацией.
 * Автоматически подставляет JWT-токен из localStorage.
 * При ответе 401 — очищает токен и перенаправляет на страницу логина.
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

  // 401 без токена = неверные учётные данные (логин/пароль)
  // 401 с токеном = сессия истекла или токен невалиден
  if (response.status === 401) {
    if (token) {
      handleUnauthorized()
      throw new ApiRequestError('Сессия истекла. Выполните вход заново.', 401)
    }
    // Без токена — просто пробрасываем ошибку с сервера
    let errorMessage = 'Неверный логин или пароль'
    try {
      const errorData = await response.json()
      const extracted = extractErrorMessage(errorData)
      if (extracted) errorMessage = extracted
    } catch {
      // ignore parse error
    }
    throw new ApiRequestError(errorMessage, 401)
  }

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

  // 204 No Content — тело ответа пустое, не пытаемся парсить JSON
  if (response.status === 204) {
    return undefined as T
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
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, hash } satisfies AuthRequest),
  })
}

// ── Sphere API ───────────────────────────────────────

export interface Sphere {
  id: string
  code: string
  name: string
  order: number
  is_active: boolean
  satisfaction: number
  created_at: string
  updated_at: string
}

export interface SphereCreate {
  code: string
  name: string
  order?: number
  satisfaction?: number
}

export interface SphereUpdate {
  code?: string
  name?: string
  order?: number
  is_active?: boolean
  satisfaction?: number
}

export async function getSpheres(): Promise<Sphere[]> {
  return apiFetch<Sphere[]>('/spheres')
}

export async function createSphere(data: SphereCreate): Promise<Sphere> {
  return apiFetch<Sphere>('/spheres', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSphere(sphereId: string, data: SphereUpdate): Promise<Sphere> {
  return apiFetch<Sphere>(`/spheres/${sphereId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSphere(sphereId: string): Promise<void> {
  await apiFetch<void>(`/spheres/${sphereId}`, {
    method: 'DELETE',
  })
}

// ── Goal API ───────────────────────────────────────

export interface GoalStatusRef {
  id: number
  code: string
  name: string
  sort_order: number
  color: string | null
}

export interface Goal {
  id: string
  sphere_id: string
  sphere_code: string
  sphere_name: string
  title: string
  description: string | null
  deadline: string | null
  status_id: number
  status_code: string
  status_name: string
  status_color: string | null
  created_at: string
  updated_at: string
}

export interface GoalCreate {
  sphere_id: string
  title: string
  description?: string | null
  deadline?: string | null
}

export interface GoalUpdate {
  title?: string
  description?: string | null
  deadline?: string | null
  status_id?: number
  sphere_id?: string
}

export async function getGoalStatuses(): Promise<GoalStatusRef[]> {
  return apiFetch<GoalStatusRef[]>('/goals/statuses')
}

export async function getGoals(params?: {
  sphere_id?: string
  status_id?: number
  show_all?: boolean
}): Promise<Goal[]> {
  const searchParams = new URLSearchParams()
  if (params?.sphere_id) searchParams.set('sphere_id', params.sphere_id)
  if (params?.status_id !== undefined) searchParams.set('status_id', String(params.status_id))
  if (params?.show_all) searchParams.set('show_all', 'true')

  const query = searchParams.toString()
  return apiFetch<Goal[]>(`/goals${query ? `?${query}` : ''}`)
}

export async function getGoal(goalId: string): Promise<Goal> {
  return apiFetch<Goal>(`/goals/${goalId}`)
}

export async function createGoal(data: GoalCreate): Promise<Goal> {
  return apiFetch<Goal>('/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateGoal(goalId: string, data: GoalUpdate): Promise<Goal> {
  return apiFetch<Goal>(`/goals/${goalId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteGoal(goalId: string): Promise<void> {
  await apiFetch<void>(`/goals/${goalId}`, {
    method: 'DELETE',
  })
}

// ── Settings API ─────────────────────────────────────

export interface UserSettings {
  id: string
  user_id: string
  w_proactive: number
  w_importance: number
  w_consequences: number
  w_urgency: number
  w_refusals: number
  w_project_speed: number
  w_sphere_satisfaction: number
  delay_minutes: number
  deadline_near: number
  created_at: string
  updated_at: string
}

export async function getSettings(): Promise<UserSettings> {
  return apiFetch<UserSettings>('/settings')
}

export async function updateSettings(
  data: Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<UserSettings> {
  return apiFetch<UserSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ── Project API ────────────────────────────────────

export interface ProjectStatusRef {
  id: number
  code: string
  name: string
  sort_order: number
  color: string | null
}

export interface Project {
  id: string
  sphere_id: string
  sphere_code: string
  sphere_name: string
  goal_id: string | null
  goal_title: string | null
  title: string
  description: string | null
  start_date: string
  finish_date: string
  status_id: number
  status_code: string
  status_name: string
  status_color: string | null
  progress: number
  has_active_task: boolean
  speed: number | null
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  sphere_id: string
  goal_id?: string | null
  title: string
  description?: string | null
  start_date: string
  finish_date: string
  progress?: number
}

export interface ProjectUpdate {
  title?: string
  description?: string | null
  start_date?: string
  finish_date?: string
  status_id?: number
  progress?: number
  sphere_id?: string
  goal_id?: string | null
}

export async function getProjectStatuses(): Promise<ProjectStatusRef[]> {
  return apiFetch<ProjectStatusRef[]>('/projects/statuses')
}

export async function getProjects(params?: {
  sphere_id?: string
  show_all?: boolean
  interval_start?: string
  interval_end?: string
}): Promise<Project[]> {
  const searchParams = new URLSearchParams()
  if (params?.sphere_id) searchParams.set('sphere_id', params.sphere_id)
  if (params?.show_all) searchParams.set('show_all', 'true')
  if (params?.interval_start) searchParams.set('interval_start', params.interval_start)
  if (params?.interval_end) searchParams.set('interval_end', params.interval_end)

  const query = searchParams.toString()
  return apiFetch<Project[]>(`/projects${query ? `?${query}` : ''}`)
}

export async function getProject(projectId: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${projectId}`)
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  return apiFetch<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProject(projectId: string, data: ProjectUpdate): Promise<Project> {
  return apiFetch<Project>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch<void>(`/projects/${projectId}`, {
    method: 'DELETE',
  })
}

// ── Task API ──────────────────────────────────────

export interface TaskStatusRef {
  id: number
  code: string
  name: string
  sort_order: number
  color: string | null
}

export interface Task {
  id: string
  sphere_id: string
  sphere_code: string
  sphere_name: string
  project_id: string | null
  project_title: string | null
  goal_id: string | null
  goal_title: string | null
  title: string
  description: string | null
  is_appointment: boolean
  start_date: string
  finish_date: string
  appointment_at: string | null
  travel_time: number | null
  duration: number
  importance: number
  consequences: number
  progress: number
  delay_to: string | null
  refusal_count: number
  status_id: number
  status_code: string
  status_name: string
  status_color: string | null
  created_at: string
  updated_at: string
}

export interface TaskCreate {
  sphere_id: string
  project_id?: string | null
  goal_id?: string | null
  title: string
  description?: string | null
  is_appointment?: boolean
  start_date: string
  finish_date: string
  appointment_at?: string | null
  travel_time?: number | null
  duration?: number
  importance?: number
  consequences?: number
  progress?: number
  delay_to?: string | null
  refusal_count?: number
  status_id?: number
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  start_date?: string
  finish_date?: string
  appointment_at?: string | null
  travel_time?: number | null
  duration?: number
  importance?: number
  consequences?: number
  progress?: number
  delay_to?: string | null
  refusal_count?: number
  status_id?: number
  sphere_id?: string
  goal_id?: string | null
}

export async function getTaskStatuses(): Promise<TaskStatusRef[]> {
  return apiFetch<TaskStatusRef[]>('/tasks/statuses')
}

export async function getTasks(params?: {
  sphere_id?: string
  project_id?: string
  show_all?: boolean
  only_standalone?: boolean
  only_appointments?: boolean
  interval_start?: string
  interval_end?: string
}): Promise<Task[]> {
  const searchParams = new URLSearchParams()
  if (params?.sphere_id) searchParams.set('sphere_id', params.sphere_id)
  if (params?.project_id) searchParams.set('project_id', params.project_id)
  if (params?.show_all) searchParams.set('show_all', 'true')
  if (params?.only_standalone) searchParams.set('only_standalone', 'true')
  if (params?.only_appointments) searchParams.set('only_appointments', 'true')
  if (params?.interval_start) searchParams.set('interval_start', params.interval_start)
  if (params?.interval_end) searchParams.set('interval_end', params.interval_end)

  const query = searchParams.toString()
  return apiFetch<Task[]>(`/tasks${query ? `?${query}` : ''}`)
}

export async function getTask(taskId: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`)
}

export async function createTask(data: TaskCreate): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTask(taskId: string, data: TaskUpdate): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiFetch<void>(`/tasks/${taskId}`, {
    method: 'DELETE',
  })
}

// ── TaskLog API ──────────────────────────────────

export interface TaskLog {
  id: string
  task_id: string
  log_date: string
  minutes: number
  created_at: string
  updated_at: string
}

export async function getTaskLog(taskId: string): Promise<TaskLog[]> {
  return apiFetch<TaskLog[]>(`/tasks/${taskId}/log`)
}

export async function upsertTaskLog(
  taskId: string,
  data: { log_date: string; minutes: number },
): Promise<TaskLog> {
  return apiFetch<TaskLog>(`/tasks/${taskId}/log`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
