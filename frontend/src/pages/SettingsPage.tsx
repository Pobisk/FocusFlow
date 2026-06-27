import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, type UserSettings } from '@/lib/api'

// ── Маппинг полей для отображения ────────────────────

interface SettingField {
  key: keyof UserSettings
  label: string
  description: string
  type: 'number' | 'float'
  min?: number
  max?: number
  step?: number
}

const SETTING_FIELDS: SettingField[] = [
  {
    key: 'w_proactive',
    label: 'Вес проактивности',
    description: 'Коэффициент важности привязки задачи к цели',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'w_importance',
    label: 'Вес важности',
    description: 'Коэффициент важности задачи',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'w_consequences',
    label: 'Вес последствий',
    description: 'Коэффициент последствий невыполнения задачи',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'w_urgency',
    label: 'Вес срочности',
    description: 'Коэффициент срочности выполнения задачи',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'w_refusals',
    label: 'Вес отказов',
    description: 'Штраф за количество откладываний задачи',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'w_project_speed',
    label: 'Вес скорости проекта',
    description: 'Штраф за низкую скорость выполнения проекта',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'w_sphere_satisfaction',
    label: 'Вес удовлетворённости сферы',
    description: 'Штраф за низкую оценку удовлетворённости в сфере',
    type: 'float',
    min: 0,
    step: 0.1,
  },
  {
    key: 'delay_minutes',
    label: 'Отложить на (мин)',
    description: 'На сколько минут откладывается задача при нажатии "Позже"',
    type: 'number',
    min: 1,
  },
  {
    key: 'deadline_near',
    label: 'Дедлайн близко (дней)',
    description: 'За сколько дней до дедлайна показывать жёлтый кирпичик',
    type: 'number',
    min: 1,
  },
]

// ── Страница настроек ────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: settings, isLoading, isError, error } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [initialized, setInitialized] = useState(false)

  // Инициализируем форму после загрузки данных
  if (settings && !initialized) {
    const values: Record<string, string> = {}
    SETTING_FIELDS.forEach((field) => {
      const val = settings[field.key]
      values[field.key] = val !== undefined && val !== null ? String(val) : ''
    })
    if (!initialized) {
      setFormValues(values)
      setInitialized(true)
    }
  }

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const data: Record<string, number> = {}
    SETTING_FIELDS.forEach((field) => {
      const raw = formValues[field.key]
      if (raw !== undefined && raw !== '') {
        data[field.key] = field.type === 'float' ? parseFloat(raw) : parseInt(raw, 10)
      }
    })
    updateMutation.mutate(data as Partial<UserSettings>)
  }

  const hasChanges = () => {
    if (!settings) return false
    return SETTING_FIELDS.some((field) => {
      const current = String(settings[field.key] ?? '')
      const form = formValues[field.key] ?? ''
      return current !== form
    })
  }

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Шапка */}
        <header className="mb-6 pb-4 border-b flex items-center justify-between flex-wrap gap-4">
          <div>
            <button
              onClick={() => navigate('/workspace')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Назад
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Параметры алгоритмов и интерфейса
            </p>
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

        {/* Форма */}
        {!isLoading && !isError && (
          <>
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 w-1/3">
                      Параметр
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Значение
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SETTING_FIELDS.map((field) => (
                    <tr key={field.key} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {field.label}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {field.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={formValues[field.key] ?? ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Кнопки */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => navigate('/workspace')}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges() || updateMutation.isPending}
                className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>

            {updateMutation.isSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Настройки сохранены
              </div>
            )}

            {updateMutation.isError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Ошибка сохранения:{' '}
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Неизвестная ошибка'}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
