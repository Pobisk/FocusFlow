import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSpheres,
  createSphere,
  updateSphere,
  deleteSphere,
  type Sphere,
  type SphereCreate,
  type SphereUpdate,
} from '@/lib/api'
import { SphereFilter } from '@/components/SphereFilter'
import { cn } from '@/lib/utils'

// ── Вспомогательные компоненты ───────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            'text-lg transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
            star <= Math.round(value)
              ? 'text-yellow-400'
              : 'text-gray-200',
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── Модальное окно ───────────────────────────────────

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
    }
    prevSphereRef.current = sphere
    prevOpenRef.current = open
  }, [open, sphere])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'create') {
      onSave({ code, name, order, satisfaction } satisfies SphereCreate)
    } else {
      const data: SphereUpdate = {}
      if (code !== sphere?.code) data.code = code
      if (name !== sphere?.name) data.name = name
      if (order !== sphere?.order) data.order = order
      if (satisfaction !== sphere?.satisfaction) data.satisfaction = satisfaction
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
              Удовлетворённость
            </label>
            <StarRating value={satisfaction} onChange={setSatisfaction} />
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
  const [filterCode, setFilterCode] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingSphere, setEditingSphere] = useState<Sphere | undefined>()
  const [deletingSphere, setDeletingSphere] = useState<Sphere | null>(null)

  // Запрос списка сфер
  const { data: spheres = [], isLoading, isError, error } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
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

  // Мутация изменения satisfaction (мгновенное сохранение)
  const satisfactionMutation = useMutation({
    mutationFn: ({ id, satisfaction }: { id: string; satisfaction: number }) =>
      updateSphere(id, { satisfaction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spheres'] })
    },
  })

  const filteredSpheres = filterCode
    ? spheres.filter((s) => s.code === filterCode)
    : spheres

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
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition"
          >
            + Добавить сферу
          </button>
        </header>

        {/* Фильтр */}
        <div className="mb-6">
          <SphereFilter
            spheres={spheres}
            selected={filterCode}
            onSelect={setFilterCode}
          />
        </div>

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
          <div className="grid gap-4 md:grid-cols-2">
            {filteredSpheres.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                {filterCode
                  ? 'Нет сфер с таким кодом'
                  : 'Сферы пока не добавлены. Нажмите "+ Добавить сферу"'}
              </div>
            )}

            {filteredSpheres.map((sphere) => (
              <div
                key={sphere.id}
                className="bg-white rounded-xl shadow-sm border p-5 flex flex-col gap-3"
              >
                {/* Верхняя строка: код + название */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-lg">
                      {sphere.code}
                    </span>
                    <div>
                      <h3 className="font-medium text-gray-900">{sphere.name}</h3>
                      <p className="text-xs text-gray-400">
                        Порядок: {sphere.order}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Оценка удовлетворённости */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Удовлетворённость</span>
                  <StarRating
                    value={sphere.satisfaction}
                    onChange={(v) =>
                      satisfactionMutation.mutate({
                        id: sphere.id,
                        satisfaction: v,
                      })
                    }
                  />
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(sphere)}
                    className="flex-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => setDeletingSphere(sphere)}
                    className="flex-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
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
