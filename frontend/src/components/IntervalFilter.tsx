import { useState, useCallback, useMemo } from 'react'
import { addDays, addWeeks, addMonths, addYears, startOfDay, startOfWeek, startOfMonth, startOfYear, format, getYear, getQuarter, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export type IntervalType = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface IntervalValue {
  type: IntervalType
  /** Первый день интервала, 00:00 в локальном времени, ISO-строка */
  start: string
  /** Последний день интервала, 00:00 в локальном времени, ISO-строка */
  end: string
}

/** Форматирует дату для отображения в зависимости от типа интервала */
function formatIntervalLabel(type: IntervalType, date: Date): string {
  switch (type) {
    case 'day':
      return format(date, 'd MMMM yyyy', { locale: ru })
    case 'week':
      return format(date, 'd MMMM yyyy', { locale: ru })
    case 'month':
      return format(date, 'LLLL yyyy', { locale: ru })
    case 'quarter': {
      const q = getQuarter(date)
      const y = getYear(date)
      const roman = ['I', 'II', 'III', 'IV'][q - 1]
      return `${roman} квартал ${y}`
    }
    case 'year':
      return String(getYear(date))
  }
}

/** Вычисляет базовую дату для интервала (первый день) */
function getBaseDate(type: IntervalType, date: Date): Date {
  switch (type) {
    case 'day':
      return startOfDay(date)
    case 'week':
      return startOfWeek(date, { weekStartsOn: 1 }) // понедельник
    case 'month':
      return startOfMonth(date)
    case 'quarter': {
      const q = getQuarter(date)
      return startOfMonth(new Date(date.getFullYear(), (q - 1) * 3, 1))
    }
    case 'year':
      return startOfYear(date)
  }
}

/** Вычисляет последний день интервала */
function getEndDate(type: IntervalType, start: Date): Date {
  switch (type) {
    case 'day':
      return start
    case 'week':
      return addDays(start, 6)
    case 'month':
      return addDays(addMonths(start, 1), -1)
    case 'quarter':
      return addDays(addMonths(start, 3), -1)
    case 'year':
      return addDays(addYears(start, 1), -1)
  }
}

/** Переход к следующему интервалу */
function goNext(type: IntervalType, date: Date): Date {
  switch (type) {
    case 'day':
      return addDays(date, 1)
    case 'week':
      return addWeeks(date, 1)
    case 'month':
      return addMonths(date, 1)
    case 'quarter':
      return addMonths(date, 3)
    case 'year':
      return addYears(date, 1)
  }
}

/** Переход к предыдущему интервалу */
function goPrev(type: IntervalType, date: Date): Date {
  switch (type) {
    case 'day':
      return addDays(date, -1)
    case 'week':
      return addWeeks(date, -1)
    case 'month':
      return addMonths(date, -1)
    case 'quarter':
      return addMonths(date, -3)
    case 'year':
      return addYears(date, -1)
  }
}

interface IntervalFilterProps {
  /** Тип интервала по умолчанию */
  defaultType?: IntervalType
  /** Коллбэк при изменении интервала */
  onChange: (value: IntervalValue) => void
}

export function IntervalFilter({ defaultType = 'week', onChange }: IntervalFilterProps) {
  const [type, setType] = useState<IntervalType>(defaultType)
  const [baseDate, setBaseDate] = useState(() => getBaseDate(defaultType, new Date()))

  const intervalLabel = useMemo(() => {
    if (type === 'week') {
      const end = getEndDate(type, baseDate)
      return `${format(baseDate, 'd MMMM yyyy', { locale: ru })} — ${format(end, 'd MMMM yyyy', { locale: ru })}`
    }
    return formatIntervalLabel(type, baseDate)
  }, [type, baseDate])

  // Уведомляем родителя об изменении интервала
  const notify = useCallback(
    (t: IntervalType, d: Date) => {
      const start = getBaseDate(t, d)
      const end = getEndDate(t, start)
      onChange({
        type: t,
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      })
    },
    [onChange],
  )

  const handleTypeChange = (newType: IntervalType) => {
    setType(newType)
    const newBase = getBaseDate(newType, baseDate)
    setBaseDate(newBase)
    setTimeout(() => notify(newType, newBase), 0)
  }

  const handlePrev = () => {
    const newDate = goPrev(type, baseDate)
    setBaseDate(newDate)
    setTimeout(() => notify(type, newDate), 0)
  }

  const handleNext = () => {
    const newDate = goNext(type, baseDate)
    setBaseDate(newDate)
    setTimeout(() => notify(type, newDate), 0)
  }

  // Инициализация при первом рендере
  useState(() => {
    setTimeout(() => notify(type, baseDate), 0)
  })

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Верхняя строка: отформатированный интервал */}
      <div className="text-sm font-medium text-gray-700">
        {intervalLabel}
      </div>

      {/* Нижняя строка: навигация */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrev}
          className="px-3 py-1 text-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          title="Предыдущий"
        >
          ◀
        </button>

        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as IntervalType)}
          className="px-2 py-1 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="day">день</option>
          <option value="week">неделя</option>
          <option value="month">месяц</option>
          <option value="quarter">квартал</option>
          <option value="year">год</option>
        </select>

        <button
          onClick={handleNext}
          className="px-3 py-1 text-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          title="Следующий"
        >
          ▶
        </button>
      </div>
    </div>
  )
}
