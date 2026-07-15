import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dateOnlyToUTC, getTodayLocalDate } from '@/lib/utils'

interface TaskScore {
  id: string
  title: string
  sphere_code: string
  project_title: string | null
  start_date: string
  finish_date: string

  proactive: number
  w_proactive: number
  importance: number
  w_importance: number
  consequences: number
  w_consequences: number
  urgency: number
  w_urgency: number
  refusals: number
  w_refusals: number
  project_speed_penalty: number
  w_project_speed: number
  sphere_satisfaction_penalty: number
  w_sphere_satisfaction: number

  total: number
}

async function fetchWorkDebug(localDate: string): Promise<TaskScore[]> {
  const token = localStorage.getItem('access_token')
  const params = new URLSearchParams({ local_date: localDate })
  const res = await fetch(`/api/work-debug?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Ошибка загрузки дебага')
  }
  return res.json()
}

function fmt(d: number): string {
  return d.toFixed(2)
}

export function WorkDebugPage() {
  const navigate = useNavigate()
  const localDateStr = getTodayLocalDate()
  const todayUtc = dateOnlyToUTC(localDateStr)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workDebug', todayUtc],
    queryFn: () => fetchWorkDebug(todayUtc),
    staleTime: 10_000,
    refetchOnMount: true,
  })

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="mx-auto" style={{ maxWidth: 1400 }}>
        <header className="mb-6 pb-4 border-b flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/workspace')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Назад
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Работа — отладка скоринга
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Дата: {localDateStr} | {data?.length ?? 0} задач
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isLoading ? 'Загрузка...' : 'Обновить'}
          </button>
        </header>

        {isError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Ошибка: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Нет активных задач на сегодня
          </div>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse bg-white rounded-xl shadow-sm border">
              <thead>
                <tr className="bg-gray-100 border-b sticky top-0">
                  <th className="px-2 py-2 text-left font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Сфера</th>
                  <th className="px-2 py-2 text-left font-semibold">Проект</th>
                  <th className="px-2 py-2 text-left font-semibold min-w-[200px]">Задача</th>
                  <th className="px-2 py-2 text-left font-semibold">Начало</th>
                  <th className="px-2 py-2 text-left font-semibold">Конец</th>
                  <th className="px-2 py-2 text-right font-semibold">Проакт</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_П</th>
                  <th className="px-2 py-2 text-right font-semibold">Важн</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_В</th>
                  <th className="px-2 py-2 text-right font-semibold">Посл</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_Пс</th>
                  <th className="px-2 py-2 text-right font-semibold">Сроч</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_С</th>
                  <th className="px-2 py-2 text-right font-semibold">Откл</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_О</th>
                  <th className="px-2 py-2 text-right font-semibold">Скор_пр</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_Сп</th>
                  <th className="px-2 py-2 text-right font-semibold">Удов_сф</th>
                  <th className="px-2 py-2 text-right font-semibold">Вес_Ус</th>
                  <th className="px-2 py-2 text-right font-semibold text-primary text-base">Итого</th>
                </tr>
              </thead>
              <tbody>
                {data.map((score, idx) => {
                  const totalRaw =
                    score.w_proactive * score.proactive +
                    score.w_importance * score.importance +
                    score.w_consequences * score.consequences +
                    score.w_urgency * score.urgency +
                    score.w_refusals * score.refusals +
                    score.w_project_speed * score.project_speed_penalty +
                    score.w_sphere_satisfaction * score.sphere_satisfaction_penalty

                  return (
                    <tr key={score.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                      <td className="px-2 py-1.5 text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-1.5 font-mono">{score.sphere_code}</td>
                      <td className="px-2 py-1.5 max-w-[120px] truncate" title={score.project_title ?? ''}>
                        {score.project_title ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 font-medium max-w-[250px] truncate" title={score.title}>
                        {score.title}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {new Date(score.start_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {new Date(score.finish_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.proactive)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_proactive)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.importance)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_importance)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.consequences)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_consequences)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.urgency)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_urgency)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.refusals)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_refusals)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.project_speed_penalty)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_project_speed)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(score.sphere_satisfaction_penalty)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{fmt(score.w_sphere_satisfaction)}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-primary">{fmt(score.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
