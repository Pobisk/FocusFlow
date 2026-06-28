import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWork, updateTask, upsertTaskLog, type TodayTask } from '@/lib/api'
import { dateOnlyToUTC } from '@/lib/utils'

/**
 * Форматирует минуты в человекочитаемый формат: "1ч 50м" или "45м"
 */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) {
    return m > 0 ? `${h}ч ${m}м` : `${h}ч`
  }
  return `${m}м`
}

export function WorkPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── Сегодняшняя дата ──────────────────────────
  const now = new Date()
  const localDateStr = now.toISOString().slice(0, 10)
  const todayUtc = dateOnlyToUTC(localDateStr)

  // ── Загрузка задачи ───────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['work', todayUtc],
    queryFn: () => getWork(todayUtc),
  })

  const task = data?.task ?? null
  const totalTasks = data?.total_tasks ?? 0

  // ── Таймер ────────────────────────────────────
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerRunning])

  const handleStartTimer = () => setTimerRunning(true)
  const handlePauseTimer = () => setTimerRunning(false)
  const handleStopTimer = () => {
    setTimerRunning(false)
    setTimerSeconds(0)
  }

  // ── Сохранить ─────────────────────────────────
  const [description, setDescription] = useState('')
  const [progress, setProgress] = useState(0)
  const [actualMinutes, setActualMinutes] = useState(0)

  // Сброс полей при смене задачи
  useEffect(() => {
    if (task) {
      setDescription(task.description ?? '')
      setProgress(task.progress)
      setActualMinutes(task.actual_minutes)
      setTimerSeconds(0)
      setTimerRunning(false)
    }
  }, [task?.id])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!task) return

      // Время таймера в минутах
      const timerMinutes = Math.round(timerSeconds / 60)
      const newActual = actualMinutes + timerMinutes

      // Сохраняем изменения задачи
      await updateTask(task.id, {
        description: description || null,
        progress,
      })

      // Сохраняем фактическое время
      await upsertTaskLog(task.id, {
        log_date: todayUtc,
        minutes: newActual,
      })

      // Сбрасываем таймер
      setTimerSeconds(0)
      setActualMinutes(newActual)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', todayUtc] })
      queryClient.invalidateQueries({ queryKey: ['today', todayUtc] })
    },
  })

  // ── Кнопки действий ───────────────────────────
  const actionMutation = useMutation({
    mutationFn: async (action: 'later' | 'not_today' | 'complete' | 'cancel') => {
      if (!task) return

      switch (action) {
        case 'later': {
          const delayMinutes = 30 // TODO: взять из настроек
          const delayTo = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
          await updateTask(task.id, {
            delay_to: delayTo,
            refusal_count: task.refusal_count + 1,
          })
          break
        }
        case 'not_today': {
          const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
          await updateTask(task.id, {
            delay_to: tomorrow.toISOString(),
            refusal_count: task.refusal_count + 1,
          })
          break
        }
        case 'complete': {
          await updateTask(task.id, {
            status_id: 2, // завершена
            finish_date: todayUtc,
            progress: 100,
          })
          break
        }
        case 'cancel': {
          await updateTask(task.id, {
            status_id: 5, // отменена
            finish_date: todayUtc,
          })
          break
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', todayUtc] })
      navigate('/today')
    },
  })

  // ── Рендер ────────────────────────────────────
  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 pb-4 border-b">
          <button
            onClick={() => navigate('/workspace')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            ← Назад
          </button>
          {totalTasks > 0 && (
            <p className="text-xs text-gray-400">
              Задач на сегодня: {totalTasks}
            </p>
          )}
        </header>

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Поиск задачи...</div>
        )}

        {isError && (
          <div className="text-center py-12 text-red-500">
            Ошибка: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {!isLoading && !isError && !task && (
          <div className="text-center py-12 text-gray-500">
            Нет подходящих задач для работы
          </div>
        )}

        {task && (
          <>
            {/* ── Заголовок задачи ──────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
              <div className="flex items-start gap-2">
                {task.goal_id && (
                  <span className="text-lg" title={task.goal_title ?? 'Привязан к цели'}>🎯</span>
                )}
                <div>
                  <p className="text-sm text-gray-500 font-mono">
                    {task.sphere_code}
                    {task.project_title && <> {task.project_title} /</>}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900">
                    {task.is_appointment && <span className="text-lg">🕑</span>}
                    {task.title}
                    {task.is_appointment && task.appointment_at && (
                      <span className="text-gray-500 text-base ml-2 font-normal">
                        {new Date(task.appointment_at).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {task.travel_time ? ` (дорога ${task.travel_time})` : ''}
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    План: {task.duration} мин
                  </p>
                </div>
              </div>

              {/* Лягушки */}
              {task.refusal_count > 0 && (
                <div className="mt-2 text-lg">
                  {'🐸'.repeat(task.refusal_count)}
                </div>
              )}
            </div>

            {/* ── Поля редактирования ──────────────── */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-4 space-y-4">
              {/* Описание */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={3}
                />
              </div>

              {/* Прогресс */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Прогресс
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-sm text-gray-500 ml-2">%</span>
              </div>

              {/* Время фактическое */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Время фактическое (на сегодня)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={actualMinutes}
                    onChange={(e) => setActualMinutes(Number(e.target.value))}
                    className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-gray-500">мин</span>
                  {timerSeconds > 0 && (
                    <span className="text-sm text-gray-400">
                      (+{formatMinutes(Math.round(timerSeconds / 60))} таймер)
                    </span>
                  )}
                </div>
              </div>

              {/* Сохранить */}
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>

            {/* ── Таймер ────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
              <div className="text-3xl font-mono text-center mb-3">
                {formatMinutes(Math.round(timerSeconds / 60))}
              </div>
              <div className="flex justify-center gap-2">
                {!timerRunning ? (
                  <button
                    onClick={handleStartTimer}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Старт
                  </button>
                ) : (
                  <button
                    onClick={handlePauseTimer}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                  >
                    Пауза
                  </button>
                )}
                <button
                  onClick={handleStopTimer}
                  disabled={timerSeconds === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  Стоп
                </button>
              </div>
            </div>

            {/* ── Кнопки действий ──────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border p-4 grid grid-cols-2 gap-2">
              {!task.is_appointment && (
                <>
                  <button
                    onClick={() => actionMutation.mutate('later')}
                    disabled={actionMutation.isPending}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                  >
                    Позже
                  </button>
                  <button
                    onClick={() => actionMutation.mutate('not_today')}
                    disabled={actionMutation.isPending}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                  >
                    Не сегодня
                  </button>
                </>
              )}
              <button
                onClick={() => actionMutation.mutate('complete')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                Завершить
              </button>
              <button
                onClick={() => actionMutation.mutate('cancel')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
              >
                Отменить
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
