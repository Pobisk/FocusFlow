import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWork, updateTask, upsertTaskLog } from '@/lib/api'
import { dateOnlyToUTC } from '@/lib/utils'

export function WorkPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // ── Если передан task_id — прямой переход ────
  const taskIdParam = searchParams.get('task_id') ?? undefined

  // ── Сегодняшняя дата ──────────────────────────
  const now = new Date()
  const localDateStr = now.toISOString().slice(0, 10)
  const todayUtc = dateOnlyToUTC(localDateStr)

  // ── Загрузка задачи ───────────────────────────
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['work', todayUtc, taskIdParam],
    queryFn: () => getWork(todayUtc, taskIdParam),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Принудительно перезапрашиваем при монтировании
  useEffect(() => {
    refetch()
  }, [])

  const task = data?.task ?? null
  const totalTasks = data?.total_tasks ?? 0

  // ── Поля формы ────────────────────────────────
  const [description, setDescription] = useState('')
  const [progress, setProgress] = useState(0)
  const [actualMinutes, setActualMinutes] = useState(0)

  // Сброс полей при смене задачи
  useEffect(() => {
    if (task) {
      setDescription(task.description ?? '')
      setProgress(task.progress)
      setActualMinutes(task.actual_minutes)
      setStartTime(null)
      setIsTimerActive(false)
    }
  }, [task?.id])

  // ── Таймер — пункт 2 ──────────────────────────
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Действие при срабатывании таймера — п.2.5
  const actualMinutesRef = useRef(actualMinutes)
  useEffect(() => {
    actualMinutesRef.current = actualMinutes
  }, [actualMinutes])

  const doTimerTick = useCallback(() => {
    if (startTime === null) return
    const nowMs = Date.now()
    const minPassed = Math.floor((nowMs - startTime) / 60000)

    if (minPassed >= 1) {
      const currentActual = actualMinutesRef.current
      const newActual = currentActual + minPassed
      setActualMinutes(newActual)
      const newStartTime = startTime + minPassed * 60000
      setStartTime(newStartTime)

      // Сохраняем в БД
      if (task) {
        upsertTaskLog(task.id, {
          log_date: todayUtc,
          minutes: newActual,
        }).catch(() => {})
      }
    }
  }, [startTime, task, todayUtc])

  // Каждые 200мс проверяем, не прошла ли минута
  useEffect(() => {
    if (isTimerActive) {
      saveIntervalRef.current = setInterval(() => {
        doTimerTick()
      }, 200)
    }
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
        saveIntervalRef.current = null
      }
    }
  }, [isTimerActive, doTimerTick])

  // Остановка таймера — п.2.6
  const stopTimer = useCallback(() => {
    if (isTimerActive) {
      doTimerTick() // сохраняем остаток перед остановкой
      setIsTimerActive(false)
      setStartTime(null)
    }
  }, [isTimerActive, doTimerTick])

  // ── Кнопка «Назад» — п.2.7 ────────────────────
  const handleBack = useCallback(() => {
    stopTimer()
    queryClient.removeQueries({ queryKey: ['work', todayUtc] })
    navigate('/workspace')
  }, [stopTimer, navigate, queryClient, todayUtc])

  // ── Кнопка «Сохранить» ────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!task) return

      // 1-й запрос: описание + прогресс
      await updateTask(task.id, {
        description: description || null,
        progress,
      })

      // 2-й запрос: фактическое время — только если таймер неактивен
      if (!isTimerActive) {
        await upsertTaskLog(task.id, {
          log_date: todayUtc,
          minutes: actualMinutes,
        })
      }
    },
    onSuccess: () => {
      // Не перечитываем /work — у нас уже актуальные данные на экране
    },
  })

  // ── Кнопки действий ───────────────────────────
  const actionMutation = useMutation({
    mutationFn: async (action: 'later' | 'not_today' | 'complete' | 'cancel') => {
      if (!task) return

      // Останавливаем таймер перед действием — п.2.6
      stopTimer()

      switch (action) {
        case 'later': {
          const delayMinutes = data?.delay_minutes ?? 60
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
            status_id: 2,
            finish_date: todayUtc,
            progress: 100,
          })
          break
        }
        case 'cancel': {
          await updateTask(task.id, {
            status_id: 3,
            finish_date: todayUtc,
          })
          break
        }
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['work', todayUtc] })
      navigate('/workspace')
    },
  })

  // ── Старт / Стоп таймера ────────────────────
  const handleStartTimer = () => {
    setStartTime(Date.now())
    setIsTimerActive(true)
  }

  const handleStopTimer = () => {
    stopTimer()
  }

  // ── Рендер ────────────────────────────────────
  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 pb-4 border-b">
          <button
            onClick={handleBack}
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
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 font-mono">
                    {task.sphere_code}
                    {task.project_title && <> {task.project_title} /</>}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900 break-words">
                    {task.is_appointment && <span className="text-lg">🕑</span>}
                    {task.title}
                    {task.is_appointment && task.appointment_at && (
                      <span className="text-gray-500 text-base ml-2 font-normal whitespace-nowrap">
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

            {/* ── Поля редактирования + таймер ─────── */}
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

              {/* Время фактическое (на сегодня) */}
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
                    disabled={isTimerActive}
                    className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-500">мин</span>
                </div>
              </div>

              {/* Сохранить + таймер в одной строке */}
              <div className="flex items-end justify-between gap-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>

                {/* Таймер — прижат к правому краю */}
                <div className="flex items-center gap-2 shrink-0">
                  {isTimerActive ? (
                    <span className="text-2xl inline-block animate-spin" style={{ animationDuration: '2s' }} title="Таймер активен">⏳</span>
                  ) : (
                    <span className="text-2xl opacity-60" title="Таймер неактивен">⌛</span>
                  )}
                  {isTimerActive ? (
                    <button
                      onClick={handleStopTimer}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                      Стоп
                    </button>
                  ) : (
                    <button
                      onClick={handleStartTimer}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      Старт
                    </button>
                  )}
                </div>
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
