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

