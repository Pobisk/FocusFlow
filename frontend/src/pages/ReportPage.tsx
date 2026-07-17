import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getReport, type ReportItem } from '@/lib/api'
import { IntervalFilter, type IntervalValue, type IntervalType } from '@/components/IntervalFilter'

// ── Конвертация типа интервала для бэка ─────────────

/** IntervalFilter может выдавать 'day', но бэк его не поддерживает. Игнорируем day. */
function mapIntervalType(t: IntervalType): 'week' | 'month' | 'quarter' | 'year' {
  if (t === 'day') return 'week'
  return t
}

// ── Компонент гистограммы ──────────────────────────

function BarRow({ item }: { item: ReportItem }) {
  const maxWidth = 100 // %
  const factWidth = Math.min(item.fact_percent, maxWidth)
  const goalWidth = Math.min(item.goal_percent, maxWidth)

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Заголовок */}
      <span className="w-12 text-right text-xs font-medium text-gray-600 shrink-0">
        {item.caption}
      </span>

      {/* Гистограмма */}
      <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
        {/* Фактическое время */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-400 rounded transition-all"
          style={{ width: `${factWidth}%` }}
        />
        {/* Целевое время */}
        <div
          className="absolute inset-y-0 left-0 bg-green-500 rounded transition-all"
          style={{ width: `${goalWidth}%` }}
        />
      </div>

      {/* Подписи */}
      <div className="w-20 text-right text-xs text-gray-500 tabular-nums shrink-0">
        {item.fact_minutes} / {item.goal_minutes} мин
      </div>
    </div>
  )
}

// ── Основная страница ──────────────────────────────

export function ReportPage() {
  const navigate = useNavigate()

  // Состояние интервала — инициализируем текущей неделей
  const [interval, setInterval] = useState<IntervalValue>(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // понедельник
    const monday = new Date(today)
    monday.setDate(today.getDate() - diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return { type: 'week' as const, start: fmt(monday), end: fmt(sunday) }
  })

  const intervalType = mapIntervalType(interval.type)
  const firstDay = interval.start

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report', intervalType, firstDay],
    queryFn: () => getReport(intervalType, firstDay),
  })

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        {/* Шапка */}
        <header className="mb-6 pb-4 border-b">
          <button
            onClick={() => navigate('/workspace')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            ← Назад
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Отчет</h1>
              <p className="text-gray-600 mt-1 text-sm">
                Анализ времени на работу и целевые действия
              </p>
            </div>

            {/* Контрол интервала как на проектах/задачах */}
            <IntervalFilter defaultType="week" onChange={setInterval} />
          </div>
        </header>

        {/* Состояния */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        )}

        {isError && (
          <div className="text-center py-12 text-red-500">
            Ошибка загрузки: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {/* Гистограмма */}
        {!isLoading && !isError && data && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="space-y-1">
              {data.items.map((item) => (
                <BarRow key={item.order} item={item} />
              ))}
            </div>

            {/* Разделитель */}
            <div className="border-t my-4" />

            {/* Суммарная строка */}
            <BarRow item={data.total} />

            {/* Сводка внизу */}
            <div className="mt-4 pt-4 border-t text-sm text-gray-600">
              <span className="font-medium">За интервал: </span>
              Факт <span className="tabular-nums">{data.total.fact_percent.toFixed(1)}%</span>
              {' / '}
              Цель <span className="tabular-nums">{data.total.goal_percent.toFixed(1)}%</span>
            </div>

            {/* Легенда */}
            <div className="mt-4 flex gap-6 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded" />
                Факт
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded" />
                Цель
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
