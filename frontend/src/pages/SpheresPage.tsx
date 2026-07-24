import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSpheres,
  createSphere,
  updateSphere,
  deleteSphere,
  setSpheresFocus,
  type Sphere,
  type SphereCreate,
  type SphereUpdate,
} from '@/lib/api'

// ── Модальное окно добавления/редактирования ────────

interface SphereFormModalProps {
  mode: 'create' | 'edit'
  sphere?: Sphere
  open: boolean
  onClose: () => void
  onSave: (data: SphereCreate | SphereUpdate) => void
  isSaving: boolean
}

function SphereFormModal({
  mode,
  sphere,
  open,
  onClose,
  onSave,
  isSaving,
}: SphereFormModalProps) {
    const [code, setCode] = useState(sphere?.code ?? '')
    const [name, setName] = useState(sphere?.name ?? '')
    const [order, setOrder] = useState(sphere?.order ?? 0)
    const [satisfaction, setSatisfaction] = useState(sphere?.satisfaction ?? 3)
    const [isActive, setIsActive] = useState(sphere?.is_active ?? true)
    const [isFocused, setIsFocused] = useState(sphere?.is_focused ?? true)

  // Синхронизация состояния формы при открытии/смене редактируемой сферы
  const prevSphereRef = useRef(sphere)
  const prevOpenRef = useRef(open)
  useEffect(() => {
    const sphereChanged = sphere !== prevSphereRef.current
    const justOpened = open && !prevOpenRef.current
    if (justOpened || sphereChanged) {
            setCode(sphere?.code ?? '')
      setName(sphere?.name ?? '')
      setOrder(sphere?.order ?? 0)
      setSatisfaction(sphere?.satisfaction ?? 3)
      setIsActive(sphere?.is_active ?? true)
      setIsFocused(sphere?.is_focused ?? true)
    }
    prevSphereRef.current = sphere
    prevOpenRef.current = open
  }, [open, sphere])

  if (!open) return null

    const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
        if (mode === 'create') {
      onSave({ code, name, order, satisfaction, is_focused: isFocused } as SphereCreate)
    } else {
      const data: SphereUpdate = {}
      if (code !== sphere?.code) data.code = code
      if (name !== sphere?.name) data.name = name
      if (order !== sphere?.order) data.order = order
      if (satisfaction !== sphere?.satisfaction) data.satisfaction = satisfaction
      if (isActive !== sphere?.is_active) data.is_active = isActive
      if (isFocused !== sphere?.is_focused) data.is_focused = isFocused
      onSave(data)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">
          {mode === 'create' ? 'Добавить сферу' : 'Редактировать сферу'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Код
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={10}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Например: Ф, Р, Б"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Например: Финансы"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Порядок сортировки
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
                    <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Удовлетворённость: {satisfaction.toFixed(1)}
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={satisfaction}
              onChange={(e) => setSatisfaction(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>5</span>
            </div>
          </div>
                    <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              Активна
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isFocused}
                onChange={(e) => setIsFocused(e.target.checked)}
                className="rounded border-gray-300"
              />
              Фокус
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSaving ? 'Сохранение...' : mode === 'create' ? 'Добавить' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Диалог подтверждения удаления ────────────────────

function ConfirmDeleteModal({
  sphere,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: {
  sphere: Sphere | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  if (!open || !sphere) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-2">Удалить сферу</h2>
        <p className="text-sm text-gray-600 mb-4">
          Вы уверены, что хотите удалить сферу «{sphere.name}» ({sphere.code})?
          Это действие скроет её из всех списков.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Основная страница ────────────────────────────────

export function SpheresPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
    const [showAll, setShowAll] = useState(false)
  const [focused, setFocused] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingSphere, setEditingSphere] = useState<Sphere | undefined>()
  const [deletingSphere, setDeletingSphere] = useState<Sphere | null>(null)

  // Запрос списка сфер
  const { data: spheres = [], isLoading, isError, error } = useQuery({
    queryKey: ['spheres', showAll],
    queryFn: () => getSpheres(showAll || undefined),
  })

  // Мутация создания
  const createMutation = useMutation({
    mutationFn: createSphere,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spheres'] })
      setModalMode(null)
    },
  })

  // Мутация обновления
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SphereUpdate }) =>
      updateSphere(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spheres'] })
      setModalMode(null)
      setEditingSphere(undefined)
    },
  })

    // Мутация удаления
  const deleteMutation = useMutation({
    mutationFn: deleteSphere,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spheres'] })
      setDeletingSphere(null)
    },
  })

  // Мутация массового фокуса
  const focusMutation = useMutation({
    mutationFn: setSpheresFocus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spheres'] })
    },
  })

  const handleSave = (data: SphereCreate | SphereUpdate) => {
    if (modalMode === 'create') {
      createMutation.mutate(data as SphereCreate)
    } else if (modalMode === 'edit' && editingSphere) {
      updateMutation.mutate({ id: editingSphere.id, data })
    }
  }

  const handleDelete = () => {
    if (deletingSphere) {
      deleteMutation.mutate(deletingSphere.id)
    }
  }

  const openEditModal = (sphere: Sphere) => {
    setEditingSphere(sphere)
    setModalMode('edit')
  }

  const openCreateModal = () => {
    setEditingSphere(undefined)
    setModalMode('create')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingSphere(undefined)
  }

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Шапка */}
        <header className="mb-6 pb-4 border-b flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/workspace')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Назад
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Сферы жизни</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Управляйте своими сферами жизни
            </p>
                    </div>
                    <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={focused}
                onChange={(e) => {
                  const newFocused = e.target.checked
                  setFocused(newFocused)
                  focusMutation.mutate(newFocused)
                }}
                className="rounded border-gray-300"
              />
              Фокус
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-gray-300"
              />
              Все
            </label>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition"
            >
              + Добавить сферу
            </button>
          </div>
        </header>

        {/* Состояния загрузки/ошибки */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        )}

        {isError && (
          <div className="text-center py-12 text-red-500">
            Ошибка загрузки: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

                {/* Список сфер */}
        {!isLoading && !isError && (
          <>
            {/* Десктоп-таблица */}
            <div className="hidden md:block">
              <table className="w-full text-sm bg-white rounded-xl shadow-sm border">
                <thead>
                  <tr className="border-b bg-gray-50">
                                        <th className="text-center px-4 py-3 font-medium text-gray-700 w-14">Код</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Название</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-16">Фокус</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">Порядок</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-28">Удовл.</th>
                                        <th className="text-center px-4 py-3 font-medium text-gray-700 w-16">Активна</th>
                  </tr>
                </thead>
                <tbody>
                  {spheres.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        Сферы пока не добавлены. Нажмите "+ Добавить сферу"
                      </td>
                    </tr>
                  ) : (
                    spheres.map((sphere) => (
                                            <tr key={sphere.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-center font-mono text-gray-600">{sphere.code}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEditModal(sphere)}
                            className="text-primary hover:text-primary/80 hover:underline text-left"
                          >
                            {sphere.name}
                          </button>
                        </td>
                                                <td className="px-4 py-3 text-center">
                          {sphere.is_focused ? (
                            <span className="text-green-500 text-lg">✓</span>
                          ) : (
                            <span className="text-red-400 text-lg">✗</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{sphere.order}</td>
                        <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{sphere.satisfaction.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center">
                          {sphere.is_active ? (
                            <span className="text-green-500 text-lg">✓</span>
                          ) : (
                            <span className="text-red-400 text-lg">✗</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Мобильные карточки */}
            <div className="md:hidden space-y-2">
              {spheres.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Сферы пока не добавлены. Нажмите "+ Добавить сферу"
                </div>
              ) : (
                spheres.map((sphere) => (
                  <div key={sphere.id} className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-gray-500 shrink-0">{sphere.code}</span>
                        <button
                          onClick={() => openEditModal(sphere)}
                          className="text-primary hover:text-primary/80 hover:underline text-left truncate"
                        >
                          {sphere.name}
                        </button>
                      </div>
                      {sphere.is_active ? (
                        <span className="text-green-500 shrink-0">✓</span>
                      ) : (
                        <span className="text-red-400 shrink-0">✗</span>
                      )}
                    </div>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {sphere.is_focused ? <span className="text-green-500 text-lg">✓</span> : <span className="text-red-400 text-lg">✗</span>}
                      <span>Порядок: {sphere.order}</span>
                      <span>Удовлетворенность: {sphere.satisfaction.toFixed(1)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Модальные окна */}
      <SphereFormModal
        mode={modalMode === 'create' ? 'create' : 'edit'}
        sphere={editingSphere}
        open={modalMode !== null}
        onClose={closeModal}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDeleteModal
        sphere={deletingSphere}
        open={deletingSphere !== null}
        onClose={() => setDeletingSphere(null)}
        onConfirm={handleDelete}
        isDeleting={deleteMutation.isPending}
      />
    </main>
  )
}
