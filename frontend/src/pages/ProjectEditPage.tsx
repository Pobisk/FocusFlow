import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dateOnlyToUTC, utcToDateOnly, formatDateTimeLocal } from '@/lib/utils'
import {
  getProject,
  createProject,
  updateProject,
  getSpheres,
  getGoals,
  getProjectStatuses,
  getTasks,
  type ProjectCreate,
  type ProjectUpdate,
} from '@/lib/api'

const STATUS_ACTIVE = 1
const STATUS_COMPLETED = 2
const STATUS_CANCELLED = 3

export function ProjectEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  // ── Загрузка справочников ─────────────────────────
  const { data: spheres = [] } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
  })

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => getGoals({ show_all: true }),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['projectStatuses'],
    queryFn: getProjectStatuses,
  })

  // ── Загрузка проекта (если редактируем) ────────────
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !isNew,
  })

  // ── Список задач проекта (если редактируем) ────────
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['projectTasks', id],
    queryFn: () => getTasks({ project_id: id!, show_all: true }),
    enabled: !isNew,
  })

  // ── Состояние формы ───────────────────────────────
  const [sphereId, setSphereId] = useState('')
  const [goalId, setGoalId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [finishDate, setFinishDate] = useState('')
  const [progress, setProgress] = useState(0)
  const [statusId, setStatusId] = useState(STATUS_ACTIVE)
  const [error, setError] = useState<string | null>(null)

  // Заполняем форму данными проекта при загрузке
  useEffect(() => {
    if (isNew) {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)

      if (spheres.length > 0) setSphereId(spheres[0].id)
      setStartDate(todayStr)
      setFinishDate(weekLater)
      setProgress(0)
      setStatusId(STATUS_ACTIVE)
    } else if (project) {
      setSphereId(project.sphere_id)
      setGoalId(project.goal_id ?? '')
      setTitle(project.title)
      setDescription(project.description ?? '')
      setStartDate(utcToDateOnly(project.start_date))
      setFinishDate(utcToDateOnly(project.finish_date))
      setProgress(project.progress)
      setStatusId(project.status_id)
    }
  }, [project, isNew, spheres])

  // ── Фильтрация целей по выбранной сфере ───────────
  const filteredGoals = goals.filter((g) => g.sphere_id === sphereId)

  // ── Мутации ───────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(-1)
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ProjectUpdate) => updateProject(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      navigate(-1)
    },
    onError: (err: Error) => setError(err.message),
  })

  // ── Валидация ─────────────────────────────────────
  const validate = (): string | null => {
    if (!title.trim()) return 'Название обязательно'
    if (!sphereId) return 'Сфера обязательна'
    if (!startDate) return 'Дата старта обязательна'
    if (!finishDate) return 'Дата финиша обязательна'
    if (new Date(finishDate) < new Date(startDate))
      return 'Дата финиша должна быть не раньше даты старта'
    if (progress < 0 || progress > 100) return 'Прогресс должен быть от 0 до 100'
    return null
  }

  const handleSubmit = () => {
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const baseData = {
      sphere_id: sphereId,
      goal_id: goalId || null,
      title: title.trim(),
      description: description.trim() || null,
      start_date: dateOnlyToUTC(startDate),
      finish_date: dateOnlyToUTC(finishDate),
      progress,
    }

    if (isNew) {
      createMutation.mutate(baseData)
    } else {
      updateMutation.mutate({ ...baseData, status_id: statusId })
    }
  }

  // ── Обработчики кнопок Завершить/Отменить ──────────
  const handleComplete = () => {
    if (!id) return
    const today = new Date().toISOString().slice(0, 10)
    updateMutation.mutate({
      status_id: STATUS_COMPLETED,
      finish_date: dateOnlyToUTC(today),
      progress: 100,
    })
  }

  const handleCancel = () => {
    if (!id) return
    const today = new Date().toISOString().slice(0, 10)
    updateMutation.mutate({
      status_id: STATUS_CANCELLED,
      finish_date: dateOnlyToUTC(today),
    })
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  // ── Состояние загрузки ────────────────────────────
  const isLoading = !isNew && isProjectLoading
  const isSaving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <main className="min-h-screen py-8 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center py-12 text-gray-500">
          Загрузка...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Шапка */}
        <header className="mb-6 pb-4 border-b">
          <button
            onClick={handleGoBack}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            ← Назад
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Новый проект' : 'Редактирование проекта'}
          </h1>
        </header>

        {/* Ошибка */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Форма */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          {/* Сфера */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сфера
            </label>
            <select
              value={sphereId}
              onChange={(e) => setSphereId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Выберите сферу</option>
              {spheres
                .filter((s) => s.is_active)
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Цель */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цель (опционально)
            </label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Без цели (реактивный) —</option>
              {filteredGoals
                .filter((g) => g.status_id === 1)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Статус (только для редактирования) */}
          {!isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Введите название проекта"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder="Описание проекта (опционально)"
            />
          </div>

          {/* Даты */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата старта
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата финиша
              </label>
              <input
                type="date"
                value={finishDate}
                onChange={(e) => setFinishDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Прогресс */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Прогресс: {progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* ── Список задач проекта (только для редактирования) ── */}
          {!isNew && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-700">Задачи проекта</h2>
                <button
                  onClick={() =>
                    navigate(
                      `/tasks/new?project_id=${id}&sphere_id=${sphereId}&goal_id=${goalId || ''}`,
                    )
                  }
                  className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 transition"
                >
                  + Добавить задачу
                </button>
              </div>

              {projectTasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  В проекте пока нет задач
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-700">
                          Название
                        </th>
                        <th className="text-center px-3 py-2 font-medium text-gray-700 w-24">
                          Статус
                        </th>
                        <th className="text-center px-3 py-2 font-medium text-gray-700 w-16">
                          Прогресс
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectTasks.map((task) => {
                        const appointmentSuffix = task.is_appointment && task.appointment_at
                          ? ` ${formatDateTimeLocal(task.appointment_at)}${task.travel_time ? ` (дорога ${task.travel_time})` : ''}`
                          : ''
                        return (
                        <tr key={task.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => navigate(`/tasks/${task.id}`)}
                              className="text-primary hover:text-primary/80 hover:underline text-left"
                            >
                              {task.is_appointment && <span className="text-sm">🕑</span>}
                              <span>{task.title}</span>
                              {appointmentSuffix && (
                                <span className="text-gray-500 text-xs ml-1">{appointmentSuffix}</span>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className="inline-block px-2 py-0.5 text-xs rounded-full"
                              style={{
                                backgroundColor: task.status_color
                                  ? `${task.status_color}20`
                                  : undefined,
                                color: task.status_color ?? undefined,
                              }}
                            >
                              {task.status_name}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">
                            {task.progress}%
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Кнопки */}
          <div className="pt-4 border-t flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleGoBack}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
              >
                {isSaving
                  ? 'Сохранение...'
                  : isNew
                    ? 'Добавить'
                    : 'Сохранить'}
              </button>
            </div>

            {/* Кнопки завершения/отмены (только для редактирования) */}
            {!isNew && (
              <div className="flex gap-2">
                <button
                  onClick={handleComplete}
                  disabled={isSaving || statusId === STATUS_COMPLETED}
                  className="px-3 py-2 text-xs text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition disabled:opacity-50"
                >
                  Завершить
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving || statusId === STATUS_CANCELLED}
                  className="px-3 py-2 text-xs text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                >
                  Отменить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
