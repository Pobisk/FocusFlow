import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTasks, getSpheres, type Task } from '@/lib/api'
import { IntervalFilter, type IntervalValue } from '@/components/IntervalFilter'
import { dateOnlyToUTC, formatDateTimeLocal } from '@/lib/utils'

export function TasksPage() {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const [onlyStandalone, setOnlyStandalone] = useState(false)
  const [onlyAppointments, setOnlyAppointments] = useState(false)
  const [selectedSphere, setSelectedSphere] = useState<string | null>(null)
  const [interval, setInterval] = useState<IntervalValue | null>(null)

  const { data: spheres = [] } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
  })

  const { data: tasks = [], isLoading, isError, error } = useQuery({
    queryKey: ['tasks', selectedSphere, showAll, onlyStandalone, onlyAppointments, interval],
    queryFn: () => {
      const params: Record<string, string | undefined> = {}
      if (selectedSphere) params.sphere_id = selectedSphere
      if (showAll) params.show_all = 'true'
      if (onlyStandalone) params.only_standalone = 'true'
      if (onlyAppointments) params.only_appointments = 'true'
      if (interval) {
        params.interval_start = dateOnlyToUTC(interval.start)
        params.interval_end = dateOnlyToUTC(interval.end)
      }
      return getTasks(params as any)
    },
  })

  // Фильтрация по сферам на фронте (дополнительно к бэку)
  const filteredTasks = selectedSphere
    ? tasks.filter((t) => t.sphere_id === selectedSphere)
    : tasks

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
            <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          </div>
          <div className="flex items-center gap-4">
            <IntervalFilter defaultType="day" onChange={setInterval} />
            <button
              onClick={() => navigate('/tasks/new')}
              className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition shrink-0"
            >
              + Добавить
            </button>
          </div>
        </header>

        {/* Фильтр по сферам */}
        <div className="mb-4 flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setSelectedSphere(null)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition whitespace-nowrap ${
              selectedSphere === null
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Все
          </button>
          {spheres
            .filter((s) => s.is_active)
            .sort((a, b) => a.order - b.order)
            .map((sphere) => (
              <button
                key={sphere.id}
                onClick={() =>
                  setSelectedSphere(
                    selectedSphere === sphere.id ? null : sphere.id,
                  )
                }
                className={`px-3 py-1.5 text-sm rounded-lg border transition whitespace-nowrap ${
                  selectedSphere === sphere.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {sphere.code}
              </button>
            ))}
        </div>

        {/* Чек-боксы фильтров */}
        <div className="mb-4 flex items-center gap-4 flex-wrap text-sm text-gray-600">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-gray-300"
            />
            Все
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyStandalone}
              onChange={(e) => setOnlyStandalone(e.target.checked)}
              className="rounded border-gray-300"
            />
            Отдельные
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAppointments}
              onChange={(e) => setOnlyAppointments(e.target.checked)}
              className="rounded border-gray-300"
            />
            Встречи
          </label>
        </div>

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

        {/* Список задач */}
        {!isLoading && !isError && (
          <>
            {/* Десктоп-таблица */}
            <div className="hidden md:block">
              <table className="w-full text-sm bg-white rounded-xl shadow-sm border">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-8">
                      🚀
                    </th>
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-8">
                      Цл
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
                      Статус
                    </th>
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-12">
                      Пр
                    </th>
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-8">
                      🐸
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        Нет задач
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onNavigate={() => navigate(`/tasks/${task.id}`)} onProjectNavigate={(projectId) => navigate(`/projects/${projectId}`)} onStartWork={() => navigate(`/work?task_id=${task.id}`)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Мобильный список */}
            <div className="md:hidden space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Нет задач
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onNavigate={() => navigate(`/tasks/${task.id}`)} onProjectNavigate={(projectId) => navigate(`/projects/${projectId}`)} onStartWork={() => navigate(`/work?task_id=${task.id}`)} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

// ── Компонент строки таблицы (десктоп) ────────────────

interface TaskRowProps {
  task: Task
  onNavigate: () => void
  onProjectNavigate: (projectId: string) => void
  onStartWork: () => void
}

function TaskRow({ task, onNavigate, onProjectNavigate, onStartWork }: TaskRowProps) {
  // Ракета — только для активных задач, не встреч
  const showRocket = task.status_id === 1 && !task.is_appointment

  // Форматирование названия задачи для встречи
  const appointmentSuffix = task.is_appointment && task.appointment_at
    ? ` ${formatDateTimeLocal(task.appointment_at)}${task.travel_time ? ` (дорога ${task.travel_time})` : ''}`
    : ''

  return (
    <tr className="border-b last:border-b-0 hover:bg-gray-50 transition">
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
      <td className="px-2 py-3 text-center">
        {task.goal_id ? (
          <span className="text-sm" title="Привязан к цели">🎯</span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-center font-mono text-gray-600">
        {task.sphere_code}
      </td>
      <td className="px-3 py-3">
        {task.project_id && task.project_title ? (
          <button
            onClick={(e) => { e.stopPropagation(); onProjectNavigate(task.project_id!) }}
            className="text-primary hover:text-primary/80 hover:underline text-left"
          >
            {task.project_title}
          </button>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <button
          onClick={onNavigate}
          className="text-gray-900 hover:text-primary hover:underline text-left"
        >
          {task.is_appointment && <span className="text-sm">🕑</span>}
          <span>{task.title}</span>
          {appointmentSuffix && (
            <span className="text-gray-500 text-xs ml-1">{appointmentSuffix}</span>
          )}
        </button>
      </td>
      <td className="px-3 py-3 text-center">
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
      <td className="px-2 py-3 text-center font-mono text-gray-700">
        {task.progress}%
      </td>
      <td className="px-2 py-3 text-center text-gray-500 text-xs">
        {task.refusal_count > 0 ? `🐸 ${task.refusal_count}` : ''}
      </td>
    </tr>
  )
}

// ── Компонент карточки задачи (мобильный) ────────────

interface TaskCardProps {
  task: Task
  onNavigate: () => void
  onProjectNavigate: (projectId: string) => void
  onStartWork: () => void
}

function TaskCard({ task, onNavigate, onProjectNavigate, onStartWork }: TaskCardProps) {
  const showRocket = task.status_id === 1 && !task.is_appointment

  const appointmentSuffix = task.is_appointment && task.appointment_at
    ? ` ${formatDateTimeLocal(task.appointment_at)}${task.travel_time ? ` (дорога ${task.travel_time})` : ''}`
    : ''

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-mono text-gray-500 shrink-0">{task.sphere_code}</span>
          <button
            onClick={onNavigate}
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
            <span className="text-sm" title="Привязан к цели">🎯</span>
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
              onClick={(e) => { e.stopPropagation(); onProjectNavigate(task.project_id!) }}
              className="text-primary hover:underline"
            >
              {task.project_title}
            </button>
          </span>
        )}
        <span
          className="inline-block px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: task.status_color
              ? `${task.status_color}20`
              : undefined,
            color: task.status_color ?? undefined,
          }}
        >
          {task.status_name}
        </span>
        <span>Прогресс: {task.progress}%</span>
        {task.refusal_count > 0 && (
          <span>{'🐸'.repeat(task.refusal_count)}</span>
        )}
      </div>
    </div>
  )
}
