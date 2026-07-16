import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSomedayList,
  createSomeday,
  updateSomeday,
  getSpheres,
  type SomedayMaybe,
  type SomedayMaybeCreate,
  type SomedayMaybeUpdate,
} from '@/lib/api'

export function SomedayPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showAll, setShowAll] = useState(false)
  const [selectedSphere, setSelectedSphere] = useState<string | null>(null)

  // ── Загрузка ─────────────────────────────────────
  const { data: spheres = [] } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
  })

  const { data: records = [], isLoading, isError, error } = useQuery({
    queryKey: ['someday', showAll],
    queryFn: () => getSomedayList(showAll),
  })

  // Фильтрация по сферам на фронте
  const filteredRecords = selectedSphere
    ? records.filter((r) => r.sphere_id === selectedSphere)
    : records

  // ── Состояние мини-диалога ────────────────────────
  const [showDialog, setShowDialog] = useState(false)
  const [editRecord, setEditRecord] = useState<SomedayMaybe | null>(null)
  const [dialogSphereId, setDialogSphereId] = useState('')
  const [dialogTitle, setDialogTitle] = useState('')
  const [dialogDescription, setDialogDescription] = useState('')
  const [dialogIsActive, setDialogIsActive] = useState(true)

  // ── Мутации ──────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: SomedayMaybeCreate) => createSomeday(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['someday'] })
      closeDialog()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SomedayMaybeUpdate }) =>
      updateSomeday(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['someday'] })
      closeDialog()
    },
  })

  // ── Обработчики диалога ──────────────────────────
  const openAddDialog = () => {
    setEditRecord(null)
    setDialogSphereId(spheres[0]?.id || '')
    setDialogTitle('')
    setDialogDescription('')
    setDialogIsActive(true)
    setShowDialog(true)
  }

  const openEditDialog = (record: SomedayMaybe) => {
    setEditRecord(record)
    setDialogSphereId(record.sphere_id)
    setDialogTitle(record.title)
    setDialogDescription(record.description ?? '')
    setDialogIsActive(record.is_active)
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditRecord(null)
  }

  const handleSubmit = () => {
    if (!dialogTitle.trim() || !dialogSphereId) return

    if (editRecord) {
      updateMutation.mutate({
        id: editRecord.id,
        data: {
          sphere_id: dialogSphereId,
          title: dialogTitle.trim(),
          description: dialogDescription.trim() || null,
          is_active: dialogIsActive,
        },
      })
    } else {
      createMutation.mutate({
        sphere_id: dialogSphereId,
        title: dialogTitle.trim(),
        description: dialogDescription.trim() || null,
        is_active: dialogIsActive,
      })
    }
  }

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-3xl mx-auto">
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
              Когда-нибудь может быть
            </h1>
          </div>
          <button
            onClick={openAddDialog}
            className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition shrink-0"
          >
            + Добавить
          </button>
        </header>

        {/* Фильтры */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
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
          <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-gray-300"
            />
            Все
          </label>
        </div>

        {/* Загрузка */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        )}

        {/* Ошибка */}
        {isError && (
          <div className="text-center py-12 text-red-500">
            Ошибка: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {/* Список */}
        {!isLoading && !isError && (
          <>
            {/* Десктоп-таблица */}
            <div className="hidden md:block">
              <table className="w-full text-sm bg-white rounded-xl shadow-sm border">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-center px-3 py-3 font-medium text-gray-700 w-10">
                      Сфера
                    </th>
                    <th className="text-left px-3 py-3 font-medium text-gray-700">
                      Название
                    </th>
                    {showAll && (
                      <th className="text-center px-3 py-3 font-medium text-gray-700 w-20">
                        Активна
                      </th>
                    )}
                    <th className="text-center px-3 py-3 font-medium text-gray-700 w-16">
                      Дней
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showAll ? 4 : 3} className="text-center py-12 text-gray-400">
                        Нет записей
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                        <td className="px-3 py-2 text-center font-mono text-gray-600">
                          {record.sphere_code}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => openEditDialog(record)}
                            className="text-gray-900 hover:text-primary hover:underline text-left"
                          >
                            {record.title}
                          </button>
                        </td>
                        {showAll && (
                          <td className="px-3 py-2 text-center">
                            {record.is_active ? (
                              <span className="text-green-600" title="Активна">✓</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center font-mono text-gray-600">
                          {record.is_active ? record.days_exist ?? '' : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Мобильный список */}
            <div className="md:hidden space-y-2">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Нет записей
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <div key={record.id} className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-mono text-gray-500 shrink-0">{record.sphere_code}</span>
                        <button
                          onClick={() => openEditDialog(record)}
                          className="text-gray-900 hover:text-primary hover:underline text-left truncate"
                        >
                          {record.title}
                        </button>
                      </div>
                      {showAll && (
                        <span className="shrink-0 text-sm text-gray-400">
                          {record.is_active ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {record.is_active && record.days_exist !== null && (
                        <span>Дней: {record.days_exist}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Мини-диалог добавления/редактирования ── */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div
            className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              {editRecord ? 'Редактировать запись' : 'Новая запись'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Сфера
                </label>
                <select
                  value={dialogSphereId}
                  onChange={(e) => setDialogSphereId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {spheres
                    .filter((s) => s.is_active)
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={dialogTitle}
                  onChange={(e) => setDialogTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Введите название"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Описание
                </label>
                <textarea
                  value={dialogDescription}
                  onChange={(e) => setDialogDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  placeholder="Описание (опционально)"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dialogIsActive}
                  onChange={(e) => setDialogIsActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Активна
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeDialog}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {editRecord ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
