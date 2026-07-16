import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dateOnlyToUTC, utcToDateOnly, formatDateTimeLocal, getTodayLocalDate, getDateOffset } from '@/lib/utils'
import {
  getTask,
  createTask,
  updateTask,
  getSpheres,
  getGoals,
  getProject,
  getTaskStatuses,
  getTaskLog,
  upsertTaskLog,
  type TaskCreate,
  type TaskUpdate,
  type TaskLog,
} from '@/lib/api'

const STATUS_ACTIVE = 1
const STATUS_COMPLETED = 2
const STATUS_CANCELLED = 3

/** Конвертирует локальную дату и время (HH:MM) в UTC ISO-строку */
function localDateTimeToUTC(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  const local = new Date(year, month - 1, day, hours, minutes, 0, 0)
  return local.toISOString()
}

/** Извлекает HH:MM из UTC ISO-строки в локальном времени */
function utcToLocalTime(isoString: string): string {
  const d = new Date(isoString)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TaskEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  // Параметр project_id из query (для создания проектной задачи)
  const searchParams = new URLSearchParams(window.location.search)
  const presetProjectId = searchParams.get('project_id')
  const presetSphereId = searchParams.get('sphere_id')
  const presetGoalId = searchParams.get('goal_id')

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
    queryKey: ['taskStatuses'],
    queryFn: getTaskStatuses,
  })

  // Проект (если создаём проектную задачу или редактируем)
  const [projectId, setProjectId] = useState<string | null>(presetProjectId || null)
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  })

  // ── Загрузка задачи (если редактируем) ────────────
  const { data: taskData, isLoading: isTaskLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => getTask(id!),
    enabled: !isNew,
  })

  // ── Трудозатраты (только для редактирования) ──────
  const { data: taskLog = [] } = useQuery({
    queryKey: ['taskLog', id],
    queryFn: () => getTaskLog(id!),
    enabled: !isNew,
  })

  // ── Состояние формы ───────────────────────────────
  const [sphereId, setSphereId] = useState('')
  const [goalId, setGoalId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAppointment, setIsAppointment] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [finishDate, setFinishDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('09:00')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [travelTime, setTravelTime] = useState<number>(0)
  const [duration, setDuration] = useState(30)
  const [importance, setImportance] = useState(0)
  const [consequences, setConsequences] = useState(0)
  const [progress, setProgress] = useState(0)
  const [statusId, setStatusId] = useState(STATUS_ACTIVE)
  const [error, setError] = useState<string | null>(null)

  // Read-only поля
  const [delayTo, setDelayTo] = useState<string | null>(null)
  const [refusalCount, setRefusalCount] = useState(0)

  // Состояние мини-диалога для трудозатрат
  const [showLogDialog, setShowLogDialog] = useState(false)
  const [editLogEntry, setEditLogEntry] = useState<TaskLog | null>(null)
  const [logDate, setLogDate] = useState('')
  const [logMinutes, setLogMinutes] = useState(30)

  // Заполняем форму данными задачи при загрузке
  useEffect(() => {
    if (isNew) {
      const todayStr = getTodayLocalDate()
      const weekLater = getDateOffset(7)

      if (presetProjectId && project) {
        // Проектная задача — копируем сферу и цель из проекта
        setSphereId(project.sphere_id)
        setGoalId(project.goal_id ?? '')
      } else {
        // Отдельная задача
        if (presetSphereId) {
          setSphereId(presetSphereId)
          if (presetGoalId) setGoalId(presetGoalId)
        } else if (spheres.length > 0) {
          setSphereId(spheres[0].id)
        }
      }

      setStartDate(todayStr)
      setFinishDate(weekLater)
      setAppointmentDate(todayStr)
      setAppointmentTime('09:00')
      setDuration(30)
      setProgress(0)
      setStatusId(STATUS_ACTIVE)
      setIsAppointment(false)
    } else if (taskData) {
      setSphereId(taskData.sphere_id)
      setGoalId(taskData.goal_id ?? '')
      setTitle(taskData.title)
      setDescription(taskData.description ?? '')
      setProjectId(taskData.project_id)
      setIsAppointment(taskData.is_appointment)
      setStartDate(utcToDateOnly(taskData.start_date))
      setFinishDate(utcToDateOnly(taskData.finish_date))
      setDuration(taskData.duration)
      setImportance(taskData.importance)
      setConsequences(taskData.consequences)
      setProgress(taskData.progress)
      setStatusId(taskData.status_id)
      setDelayTo(taskData.delay_to)
      setRefusalCount(taskData.refusal_count)
      if (taskData.is_appointment && taskData.appointment_at) {
        setAppointmentDate(utcToDateOnly(taskData.appointment_at))
        setAppointmentTime(utcToLocalTime(taskData.appointment_at))
        setTravelTime(taskData.travel_time ?? 0)
      }
    }
  }, [taskData, isNew, spheres, project, presetProjectId])

  // Когда меняется сфера — сбрасываем цель, если она не из этой сферы
  const filteredGoals = goals.filter((g) => g.sphere_id === sphereId)
  useEffect(() => {
    if (goalId && !filteredGoals.some((g) => g.id === goalId)) {
      setGoalId('')
    }
  }, [sphereId])

  // Для встречи: start_date = finish_date = appointmentDate
  useEffect(() => {
    if (isAppointment && appointmentDate) {
      setStartDate(appointmentDate)
      setFinishDate(appointmentDate)
    }
  }, [isAppointment, appointmentDate])

  // ── Мутации ───────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: TaskCreate) => createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      navigate(-1)
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: TaskUpdate) => updateTask(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      navigate(-1)
    },
    onError: (err: Error) => setError(err.message),
  })

  // ── Мутация для трудозатрат ───────────────────────
  const logMutation = useMutation({
    mutationFn: (data: { log_date: string; minutes: number }) =>
      upsertTaskLog(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskLog', id] })
      setShowLogDialog(false)
      setEditLogEntry(null)
      setLogMinutes(30)
      setLogDate(getTodayLocalDate())
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
    if (duration < 1) return 'Длительность должна быть больше 0'
    if (progress < 0 || progress > 100) return 'Прогресс должен быть от 0 до 100'
    if (isAppointment && !appointmentTime) return 'Время встречи обязательно'
    return null
  }

  const handleSubmit = () => {
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    let appointmentAt: string | null = null
    let finalStartDate = startDate
    let finalFinishDate = finishDate

    if (isAppointment && appointmentDate && appointmentTime) {
      appointmentAt = localDateTimeToUTC(appointmentDate, appointmentTime)
      // Для встречи интервал = 1 день
      finalStartDate = appointmentDate
      finalFinishDate = appointmentDate
    }

    const baseData = {
      sphere_id: sphereId,
      project_id: presetProjectId || projectId || null,
      goal_id: goalId || null,
      title: title.trim(),
      description: description.trim() || null,
      is_appointment: isAppointment,
      start_date: dateOnlyToUTC(finalStartDate),
      finish_date: dateOnlyToUTC(finalFinishDate),
      appointment_at: appointmentAt,
      travel_time: isAppointment && travelTime ? travelTime : null,
      duration,
      importance,
      consequences,
      progress,
    }

    // Для проектной задачи не передаём sphere_id и goal_id (бэк их не примет)
    const updateData: TaskUpdate = {
      title: title.trim(),
      description: description.trim() || null,
      sphere_id: isProjectTask ? undefined : sphereId,
      goal_id: isProjectTask ? undefined : (goalId || null),
      start_date: dateOnlyToUTC(finalStartDate),
      finish_date: dateOnlyToUTC(finalFinishDate),
      appointment_at: appointmentAt,
      travel_time: isAppointment && travelTime ? travelTime : null,
      duration,
      importance,
      consequences,
      progress,
      status_id: statusId,
    }

    if (isNew) {
      createMutation.mutate(baseData)
    } else {
      updateMutation.mutate(updateData)
    }
  }

  // ── Обработчики кнопок Завершить/Отменить ──────────
  const handleComplete = () => {
    if (!id) return
    const today = getTodayLocalDate()
    updateMutation.mutate({
      status_id: STATUS_COMPLETED,
      finish_date: dateOnlyToUTC(today),
      progress: 100,
    })
  }

  const handleCancel = () => {
    if (!id) return
    const today = getTodayLocalDate()
    updateMutation.mutate({
      status_id: STATUS_CANCELLED,
      finish_date: dateOnlyToUTC(today),
    })
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  // ── Обработчики диалога трудозатрат ───────────────
  const openAddLogDialog = () => {
    setEditLogEntry(null)
    setLogDate(getTodayLocalDate())
    setLogMinutes(30)
    setShowLogDialog(true)
  }

  const openEditLogDialog = (entry: TaskLog) => {
    setEditLogEntry(entry)
    const d = new Date(entry.log_date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setLogDate(`${year}-${month}-${day}`)
    setLogMinutes(entry.minutes)
    setShowLogDialog(true)
  }

  const handleLogSubmit = () => {
    if (!id || !logDate || logMinutes < 1) return
    logMutation.mutate({
      log_date: dateOnlyToUTC(logDate),
      minutes: logMinutes,
    })
  }

  const handleSetLogToZero = () => {
    if (!id || !logDate || !editLogEntry) return
    logMutation.mutate({
      log_date: editLogEntry.log_date,
      minutes: 0,
    })
  }

  // ── Состояние загрузки ────────────────────────────
  const isLoading = !isNew && isTaskLoading
  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Признаки ──────────────────────────────────────
  const isProjectTask = !!presetProjectId || (!!taskData?.project_id)
  const canToggleAppointment = isNew

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
            {isNew ? 'Новая задача' : 'Редактирование задачи'}
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
          {/* ── Сфера (для отдельной задачи — select, для проектной — текст) ── */}
          {isProjectTask ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сфера
              </label>
              <p className="text-sm text-gray-900">{taskData?.sphere_code} — {taskData?.sphere_name || project?.sphere_name}</p>
            </div>
          ) : (
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
          )}

          {/* ── Цель (для отдельной задачи — select, для проектной — текст) ── */}
          {isProjectTask ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Цель
              </label>
              <p className="text-sm text-gray-900">{taskData?.goal_title || project?.goal_title || '—'}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Цель (опционально)
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Без цели (реактивная) —</option>
                {filteredGoals
                  .filter((g) => g.status_id === 1)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* ── Проект (только для проектных задач) ── */}
          {isProjectTask && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Проект
              </label>
              <p className="text-sm text-gray-900">{taskData?.project_title || project?.title}</p>
            </div>
          )}

          {/* ── Статус (только для редактирования) ── */}
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

          {/* ── Название ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Введите название задачи"
            />
          </div>

          {/* ── Описание ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder="Описание задачи (опционально)"
            />
          </div>

          {/* ── Чек-бокс "Встреча" ── */}
          {canToggleAppointment && (
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isAppointment}
                onChange={(e) => setIsAppointment(e.target.checked)}
                className="rounded border-gray-300"
              />
              Встреча
            </label>
          )}
          {!canToggleAppointment && taskData?.is_appointment && (
            <p className="text-sm text-gray-500">Это встреча (тип задачи нельзя изменить при редактировании)</p>
          )}

          {/* ── Временные параметры ── */}
          {isAppointment ? (
            <>
              {/* Для встречи: дата + время в 2 колонки */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата встречи
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Время встречи
                  </label>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              {/* Длительность + Время на дорогу в 2 колонки */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Длительность (минут)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Время на дорогу (минут)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={travelTime}
                    onChange={(e) => setTravelTime(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Для обычной задачи: даты + длительность */}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Длительность (минут)
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </>
          )}

          {/* ── Приоритеты ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Важность (0-3)
              </label>
              <select
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {[0, 1, 2, 3].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Последствия (0-3)
              </label>
              <select
                value={consequences}
                onChange={(e) => setConsequences(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {[0, 1, 2, 3].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Прогресс (только для редактирования) ── */}
          {!isNew && (
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
          )}

          {/* ── Read-only: откладывание ── */}
          {delayTo && (
            <div className="text-sm text-gray-500">
              ⏰ Отложена до: {formatDateTimeLocal(delayTo)}
            </div>
          )}
          {refusalCount > 0 && (
            <div className="text-sm">
              {'🐸'.repeat(refusalCount)}
            </div>
          )}

          {/* ── Трудозатраты (только для редактирования) ── */}
          {!isNew && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-700">Фактическое время</h2>
                <button
                  onClick={openAddLogDialog}
                  className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 transition"
                >
                  +
                </button>
              </div>

              {taskLog.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Нет записей о фактическом времени
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-700">Дата</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">Минут</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskLog.filter((l) => l.minutes > 0).map((entry) => {
                        const d = new Date(entry.log_date)
                        const day = String(d.getDate()).padStart(2, '0')
                        const month = String(d.getMonth() + 1).padStart(2, '0')
                        const year = d.getFullYear()
                        return (
                          <tr key={entry.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                            <td className="px-3 py-2">
                              <button
                                onClick={() => openEditLogDialog(entry)}
                                className="text-primary hover:text-primary/80 hover:underline"
                              >
                                {day}.{month}.{year}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {entry.minutes}
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

          {/* ── Кнопки ── */}
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

      {/* ── Мини-диалог для ввода/редактирования трудозатрат ── */}
      {showLogDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div
            className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              {editLogEntry ? 'Редактировать запись' : 'Новая запись'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дата</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Минут</label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={logMinutes}
                  onChange={(e) => setLogMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <div>
                  {editLogEntry && (
                    <button
                      onClick={handleSetLogToZero}
                      disabled={logMutation.isPending}
                      className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowLogDialog(false); setEditLogEntry(null) }}
                    className="px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50 transition"
                  >
                    Закрыть
                  </button>
                  <button
                    onClick={handleLogSubmit}
                    disabled={logMutation.isPending}
                    className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {logMutation.isPending ? 'Сохранение...' : editLogEntry ? 'Обновить' : 'Добавить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
