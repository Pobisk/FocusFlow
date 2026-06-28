import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getToday, type TodayTask } from '@/lib/api'
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

/**
 * Возвращает CSS-класс для кирпичика.
 */
function brickStyle(brickCode: TodayTask['brick_code']): string {
  switch (brickCode) {
    case 'completed':
      return 'bg-green-500'
    case 'overdue':
      return 'bg-red-500'
    case 'near_deadline':
      return 'bg-yellow-500'
    case 'active':
      return 'bg-transparent'
    case 'cancelled':
      return 'bg-blue-500'
  }
}

export function TodayPage() {
  const navigate = useNavigate()

  // ── Вычисляем «сегодня» в локальном времени ─────
  const now = new Date()
  const localDateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const todayUtc = dateOnlyToUTC(localDateStr)

  // ── Запрос ─────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['today', todayUtc],
    queryFn: () => getToday(todayUtc),
  })

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Шапка */}
        <header className="mb-6 pb-4 border-b flex items-center justify-between flex-wrap gap-4">
          <div>
            <button
              onClick={() => navigate('/workspace')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Назад
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Сегодня, {localDateStr}
            </h1>
          </div>
        </header>

        {/* Загрузка */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        )}

        {/* Ошибка */}
        {isError && (
          <div className="text-center py-12 text-red-500">
            Ошибка загрузки:{' '}
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {data && (
          <>
            {/* ── Сводка ─────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
                <div className="text-lg">
                  <span className="text-gray-500 mr-1">Время:</span>
                  план{' '}
                  <strong className="text-gray-900">{formatMinutes(data.summary.planned_minutes)}</strong>
                  <span className="text-gray-300 mx-1">/</span>
                  факт{' '}
                  <strong className="text-gray-900">{formatMinutes(data.summary.actual_minutes)}</strong>
                  <span className="text-gray-300 mx-1">/</span>
                  целевое{' '}
                  <strong className="text-gray-900">{formatMinutes(data.summary.goal_minutes)}</strong>
                </div>
                {/* Сводка в процентах */}
                <PercentSummary
                  planned={data.summary.planned_minutes}
                  actual={data.summary.actual_minutes}
                  goal={data.summary.goal_minutes}
                />
              </div>
            </div>

            {/* ── Десктоп — таблица ──────────────────── */}
            <div className="hidden md:block">
              <table className="w-full text-sm bg-white rounded-xl shadow-sm border">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-2 py-3 w-4" />
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-8">
                      🚀
                    </th>
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-8">
                      🎯
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-gray-700 w-10">
                      Сф
                    </th>
                    <th className="text-left px-3 py-3 font-medium text-gray-700">
                      Проект
                    </th>
                    <th className="text-left px-3 py-3 font-medium text-gray-700">
                      Задача
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-gray-700 w-20">
                      План
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-gray-700 w-20">
                      Факт
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-gray-700 w-10">
                      🐸
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        Нет задач на сегодня
                      </td>
                    </tr>
                  ) : (
                    data.tasks.map((task) => (
                      <TodayRow
                        key={task.id}
                        task={task}
                        onTaskClick={() => navigate(`/tasks/${task.id}`)}
                        onProjectClick={(projectId) => navigate(`/projects/${projectId}`)}
                        onStartWork={() => navigate(`/workspace?task_id=${task.id}`)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Мобильный — список карточек ────────── */}
            <div className="md:hidden space-y-2">
              {data.tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Нет задач на сегодня
                </div>
              ) : (
                data.tasks.map((task) => (
                  <TodayCard
                    key={task.id}
                    task={task}
                    onTaskClick={() => navigate(`/tasks/${task.id}`)}
                    onProjectClick={(projectId) => navigate(`/projects/${projectId}`)}
                    onStartWork={() => navigate(`/workspace?task_id=${task.id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

// ── Процентная сводка ──────────────────────────────

interface PercentSummaryProps {
  planned: number
  actual: number
  goal: number
}

function PercentSummary({ planned, actual, goal }: PercentSummaryProps) {
  const actualPct = planned > 0 ? Math.round((actual / planned) * 100) : 0
  const goalPct = planned > 0 ? Math.round((goal / planned) * 100) : 0

  const actualColor =
    actualPct < 30 ? 'text-red-600' : actualPct < 60 ? 'text-yellow-600' : 'text-green-600'
  const goalColor =
    goalPct < 10 ? 'text-red-600' : goalPct < 20 ? 'text-yellow-600' : 'text-green-600'

  return (
    <span className="text-lg whitespace-nowrap">
      <span className={actualColor}>факт {actualPct}%</span>
      <span className="text-gray-300 mx-1">/</span>
      <span className={goalColor}>целевое {goalPct}%</span>
    </span>
  )
}


// ── Строка таблицы (десктоп) ────────────────────────

interface TodayRowProps {
  task: TodayTask
  onTaskClick: () => void
  onProjectClick: (projectId: string) => void
  onStartWork: () => void
}

function TodayRow({ task, onTaskClick, onProjectClick, onStartWork }: TodayRowProps) {
  const showRocket = task.status_id === 1 && !task.is_appointment

  // Для встреч — только время, без даты
  const appointmentTime = task.is_appointment && task.appointment_at
    ? new Date(task.appointment_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null
  const appointmentSuffix = appointmentTime
    ? ` ${appointmentTime}${task.travel_time ? ` (дорога ${task.travel_time})` : ''}`
    : ''

  return (
    <tr className="border-b last:border-b-0 hover:bg-gray-50 transition">
      {/* Кирпичик */}
      <td className="px-2 py-3">
        {task.brick_code !== 'active' && (
          <span
            className={`inline-block w-3 h-3 rounded-sm ${brickStyle(task.brick_code)}`}
            title={task.status_name}
          />
        )}
      </td>
      {/* Ракета */}
      <td className="px-2 py-3 text-center">
        {showRocket ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStartWork() }}
            className="text-sm hover:scale-110 transition cursor-pointer"
            title="Взять в работу"
          >
            🚀
          </button>
        ) : null}
      </td>
      {/* Цель */}
      <td className="px-2 py-3 text-center">
        {task.goal_id ? (
          <span className="text-sm" title={task.goal_title ?? 'Привязан к цели'}>🎯</span>
        ) : null}
      </td>
      {/* Сфера */}
      <td className="px-3 py-3 text-center font-mono text-gray-600">
        {task.sphere_code}
      </td>
      {/* Проект */}
      <td className="px-3 py-3">
        {task.project_id && task.project_title ? (
          <button
            onClick={(e) => { e.stopPropagation(); onProjectClick(task.project_id!) }}
            className="text-primary hover:text-primary/80 hover:underline text-left"
          >
            {task.project_title}
          </button>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      {/* Задача */}
      <td className="px-3 py-3">
        <button
          onClick={onTaskClick}
          className="text-gray-900 hover:text-primary hover:underline text-left"
        >
          {task.is_appointment && <span className="text-sm">🕑</span>}
          <span>{task.title}</span>
          {appointmentSuffix && (
            <span className="text-gray-500 text-xs ml-1">{appointmentSuffix}</span>
          )}
        </button>
      </td>
      {/* План */}
      <td className="px-3 py-3 text-center font-mono text-gray-700">
        {task.duration}
      </td>
      {/* Факт */}
      <td className="px-3 py-3 text-center font-mono text-gray-700">
        {task.actual_minutes > 0 ? task.actual_minutes : ''}
      </td>
      {/* Лягушки */}
      <td className="px-2 py-3 text-center text-gray-500 text-xs">
        {task.refusal_count > 0 ? `🐸 ${task.refusal_count}` : ''}
      </td>
    </tr>
  )
}

// ── Карточка задачи (мобильный) ────────────────────

interface TodayCardProps {
  task: TodayTask
  onTaskClick: () => void
  onProjectClick: (projectId: string) => void
  onStartWork: () => void
}

function TodayCard({ task, onTaskClick, onProjectClick, onStartWork }: TodayCardProps) {
  const showRocket = task.status_id === 1 && !task.is_appointment

  // Для встреч — только время, без даты
  const appointmentTime = task.is_appointment && task.appointment_at
    ? new Date(task.appointment_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null
  const appointmentSuffix = appointmentTime
    ? ` ${appointmentTime}${task.travel_time ? ` (дорога ${task.travel_time})` : ''}`
    : ''

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {/* Кирпичик */}
          {task.brick_code !== 'active' && (
            <span
              className={`inline-block w-3 h-3 rounded-sm shrink-0 ${brickStyle(task.brick_code)}`}
              title={task.status_name}
            />
          )}
          <span className="font-mono text-gray-500 shrink-0">{task.sphere_code}</span>
          <button
            onClick={onTaskClick}
            className="text-gray-900 hover:text-primary hover:underline text-left truncate"
          >
            {task.is_appointment && <span className="text-sm">🕑</span>}
            <span>{task.title}</span>
            {appointmentSuffix && (
              <span className="text-gray-500 text-xs ml-1">{appointmentSuffix}</span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {task.goal_id && (
            <span className="text-sm" title={task.goal_title ?? 'Привязан к цели'}>🎯</span>
          )}
          {showRocket && (
            <button
              onClick={(e) => { e.stopPropagation(); onStartWork() }}
              className="text-sm hover:scale-110 transition cursor-pointer"
              title="Взять в работу"
            >
              🚀
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        {task.project_id && task.project_title && (
          <span className="truncate">
            Проект:{' '}
            <button
              onClick={(e) => { e.stopPropagation(); onProjectClick(task.project_id!) }}
              className="text-primary hover:underline"
            >
              {task.project_title}
            </button>
          </span>
        )}
        <span>План: {task.duration}м</span>
        {task.actual_minutes > 0 && <span>Факт: {task.actual_minutes}м</span>}
        {task.refusal_count > 0 && (
          <span>{'🐸'.repeat(task.refusal_count)}</span>
        )}
      </div>
    </div>
  )
}
