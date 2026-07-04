import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Конвертирует "дату без времени" (YYYY-MM-DD) из date input в UTC ISO-строку.
 *
 * Date input возвращает строку в локальном часовом поясе пользователя.
 * Функция создаёт дату как local midnight и конвертирует в UTC.
 *
 * Пример для UTC+3:
 *   dateOnlyToUTC("2026-06-15") → "2026-06-14T21:00:00Z"
 *
 * Использование: перед отправкой на бэкенд.
 */
export function dateOnlyToUTC(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0)
  return localDate.toISOString()
}

/**
 * Возвращает сегодняшнюю дату в формате YYYY-MM-DD в локальном часовом поясе.
 *
 * В отличие от new Date().toISOString().slice(0, 10),
 * эта функция берёт ГОД/МЕСЯЦ/ДЕНЬ из локального времени.
 *
 * Пример для UTC+3 в 01:30 ночи:
 *   getTodayLocalDate() → "2026-07-05" (правильно)
 *   new Date().toISOString().slice(0, 10) → "2026-07-04" (неправильно, предыдущий день в UTC)
 */
export function getTodayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Возвращает дату YYYY-MM-DD через N дней от сегодня, в локальном часовом поясе.
 *
 * Пример: getDateOffset(7) → "2026-07-12" (если сегодня 2026-07-05)
 */
export function getDateOffset(days: number): string {
  const d = new Date(getTodayLocalDate())
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
/**
 * Конвертирует UTC ISO-строку в "дату без времени" (YYYY-MM-DD) для date input.
 *
 * Date input ожидает значение в локальном часовом поясе пользователя.
 * Функция парсит UTC-строку и возвращает локальную дату.
 *
 * Пример для UTC+3:
 *   utcToDateOnly("2026-06-14T21:00:00Z") → "2026-06-15"
 *
 * Использование: для отображения deadline из бэка в <input type="date">.
 */
export function utcToDateOnly(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Форматирует UTC ISO-строку в читаемую дату (локальный часовой пояс).
 * Использование: для отображения deadline на карточке цели.
 */
export function formatDateLocal(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Форматирует UTC ISO-строку в дату и время (локальный часовой пояс).
 * Формат: dd.MM.yyyy HH:mm
 * Использование: для отображения delay_to.
 */
export function formatDateTimeLocal(isoString: string): string {
  const d = new Date(isoString)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

