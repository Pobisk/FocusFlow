import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSphereFilter } from '@/hooks/useSphereFilter'
import { getProjects, getSpheres, type Project } from '@/lib/api'

export function ProjectsPage() {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const [selectedSphere, setSelectedSphere] = useState<string | null>(null)

  const { data: spheres = [] } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
  })

  const { data: projects = [], isLoading, isError, error } = useQuery({
    queryKey: ['projects', selectedSphere, showAll],
    queryFn: () =>
      getProjects({
        sphere_id: selectedSphere ?? undefined,
        show_all: showAll || undefined,
      }),
  })

  // Фильтрация по сферам выполняется на бэке через sphere_id
  // На фронте дополнительно фильтруем, если selectedSphere задан (на всякий случай)
  const filteredProjects = selectedSphere
    ? projects.filter((p) => p.sphere_id === selectedSphere)
    : projects

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
            <h1 className="text-2xl font-bold text-gray-900">Проекты</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Список проектов. По умолчанию — активные на текущую неделю.
            </p>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition"
          >
            + Добавить
          </button>
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

        {/* Чек-бокс "Все" */}
        <label className="inline-flex items-center gap-2 mb-4 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded border-gray-300"
          />
          Все (включая завершённые и отменённые)
        </label>

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

        {/* Список проектов — десктоп: таблица */}
        {!isLoading && !isError && (
          <>
            {/* Десктоп-таблица (скрываем на узких экранах) */}
            <div className="hidden md:block">
              <table className="w-full text-sm bg-white rounded-xl shadow-sm border">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-center px-2 py-3 font-medium text-gray-700 w-8">
                      Цл
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-12">
                      Сф
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Название
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">
                      Статус
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-16">
                      Задача
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">
                      Прогресс
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">
                      Скорость
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12 text-gray-400"
                      >
                        Нет проектов
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        onNavigate={() =>
                          navigate(`/projects/${project.id}`)
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Мобильный список (скрываем на широких экранах) */}
            <div className="md:hidden space-y-2">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Нет проектов
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onNavigate={() => navigate(`/projects/${project.id}`)}
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

// ── Компонент строки таблицы (десктоп) ────────────────

interface ProjectRowProps {
  project: Project
  onNavigate: () => void
}

function ProjectRow({ project, onNavigate }: ProjectRowProps) {
  const speedColor =
    project.speed !== null && project.speed >= 0.8
      ? 'text-green-600'
      : project.speed !== null
        ? 'text-red-600'
        : 'text-gray-400'

  return (
    <tr className="border-b last:border-b-0 hover:bg-gray-50 transition">
      <td className="px-2 py-3 text-center">
        {project.goal_id ? (
          <span className="text-sm" title="Привязан к цели">🎯</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-center font-mono text-gray-600">
        {project.sphere_code}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onNavigate}
          className="text-primary hover:text-primary/80 hover:underline text-left"
        >
          {project.title}
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className="inline-block px-2 py-0.5 text-xs rounded-full"
          style={{
            backgroundColor: project.status_color
              ? `${project.status_color}20`
              : undefined,
            color: project.status_color ?? undefined,
          }}
        >
          {project.status_name}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {project.has_active_task ? (
          <span className="text-green-500 text-lg">✓</span>
        ) : (
          <span className="text-red-400 text-lg">✗</span>
        )}
      </td>
      <td className="px-4 py-3 text-center font-mono text-gray-700">
        {project.progress}%
      </td>
      <td className={`px-4 py-3 text-center font-mono ${speedColor}`}>
        {project.speed !== null ? project.speed.toFixed(1) : '—'}
      </td>
    </tr>
  )
}

// ── Компонент карточки проекта (мобильный) ────────────

interface ProjectCardProps {
  project: Project
  onNavigate: () => void
}

function ProjectCard({ project, onNavigate }: ProjectCardProps) {
  const speedColor =
    project.speed !== null && project.speed >= 0.8
      ? 'text-green-600'
      : project.speed !== null
        ? 'text-red-600'
        : 'text-gray-400'

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-gray-500 shrink-0">
            {project.sphere_code}
          </span>
          <button
            onClick={onNavigate}
            className="text-primary hover:text-primary/80 hover:underline text-left truncate"
          >
            {project.title}
          </button>
        </div>
        {project.goal_id && (
          <span className="shrink-0 text-sm" title="Привязан к цели">🎯</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span
          className="inline-block px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: project.status_color
              ? `${project.status_color}20`
              : undefined,
            color: project.status_color ?? undefined,
          }}
        >
          {project.status_name}
        </span>
        <span>
          Задача:{' '}
          {project.has_active_task ? (
            <span className="text-green-500">есть</span>
          ) : (
            <span className="text-red-400">нет</span>
          )}
        </span>
        <span>Прогресс: {project.progress}%</span>
        <span className={speedColor}>
          Скорость: {project.speed !== null ? project.speed.toFixed(1) : '—'}
        </span>
      </div>
    </div>
  )
}
