import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getSpheres,
  type Goal,
  type GoalCreate,
  type GoalUpdate,
  type Sphere,
} from '@/lib/api'
import { SphereFilter } from '@/components/SphereFilter'
import { cn } from '@/lib/utils'

// ── Вспомогательные компоненты ───────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  const labels: Record<string, string> = {
    active: 'Активна',
    completed: 'Завершена',
    cancelled: 'Отменена',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        styles[status] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {labels[status] ?? status}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          value >= 100
            ? 'bg-green-500'
            : value >= 50
              ? 'bg-blue-500'
              : value > 0
                ? 'bg-yellow-500'
                : 'bg-gray-200',
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// ── Модальное окно ───────────────────────────────────

interface GoalFormModalProps {
  mode: 'create' | 'edit'
  goal?: Goal
  spheres: Sphere[]
  open: boolean
  onClose: () => void
  onSave: (data: GoalCreate | GoalUpdate) => void
  isSaving: boolean
}

function GoalFormModal({
  mode,
  goal,
  spheres,
  open,
  onClose,
  onSave,
  isSaving,
}: GoalFormModalProps) {
  const [sphereId, setSphereId] = useState(goal?.sphere_id ?? spheres[0]?.id ?? '')
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')

  const prevGoalRef = useRef(goal)
  const prevOpenRef = useRef(open)
  useEffect(() => {
    const goalChanged = goal !== prevGoalRef.current
    const justOpened = open && !prevOpenRef.current
    if (justOpened || goalChanged) {
      setSphereId(goal?.sphere_id ?? spheres[0]?.id ?? '')
      setTitle(goal?.title ?? '')
      setDescription(goal?.description ?? '')
      setDeadline(goal?.deadline ?? '')
    }
    prevGoalRef.current = goal
    prevOpenRef.current = open
  }, [open, goal, spheres])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sphereId || !title.trim()) return

    if (mode === 'create') {
      onSave({
        sphere_id: sphereId,
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      } satisfies GoalCreate)
    } else {
      const data: GoalUpdate = {}
      if (sphereId !== goal?.sphere_id) data.sphere_id = sphereId
      if (title !== goal?.title) data.title = title.trim()
      if (description !== (goal?.description ?? ''))
        data.description = description.trim() || null
      if ((deadline || null) !== (goal?.deadline ?? null))
        data.deadline = deadline ? new Date(deadline).toISOString() : null
      onSave(data)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">
          {mode === 'create' ? 'Добавить цель' : 'Редактировать цель'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сфера жизни
            </label>
            <select
              value={sphereId}
              onChange={(e) => setSphereId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="" disabled>
                Выберите сферу
              </option>
              {spheres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название цели
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Например: Накопить 1 млн на квартиру"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Описание цели (опционально)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Срок достижения
            </label>
            <input
              type="date"
              value={deadline ? deadline.slice(0, 10) : ''}
              onChange={(e) =>
                setDeadline(e.target.value ? `${e.target.value}T23:59:59Z` : '')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
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
              disabled={isSaving || !title.trim() || !sphereId}
              className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSaving
                ? 'Сохранение...'
                : mode === 'create'
                  ? 'Добавить'
                  : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Диалог подтверждения ─────────────────────────────

function ConfirmModal({
  goal,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: {
  goal: Goal | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  if (!open || !goal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-2">Отменить цель</h2>
        <p className="text-sm text-gray-600 mb-4">
          Вы уверены, что хотите отменить цель «{goal.title}»?
          Связанные проекты и задачи не будут удалены.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Оставить
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {isDeleting ? 'Отмена...' : 'Отменить цель'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Основная страница ────────────────────────────────

export function GoalsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterCode, setFilterCode] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>()
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Запрос списка сфер (для выпадающего списка и фильтра)
  const { data: spheres = [] } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
  })

  // Запрос списка целей
  const { data: goals = [], isLoading, isError, error } = useQuery({
    queryKey: ['goals', showAll],
    queryFn: () => getGoals({ show_all: showAll }),
  })

  // Мутация создания
  const createMutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setModalMode(null)
    },
  })

  // Мутация обновления
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GoalUpdate }) =>
      updateGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setModalMode(null)
      setEditingGoal(undefined)
    },
  })

  // Мутация удаления
  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setDeletingGoal(null)
    },
  })

  // Фильтр по сфере
  const filteredGoals = filterCode
    ? goals.filter((g) => g.sphere_code === filterCode)
    : goals

  // Группировка по статусу
  const activeGoals = filteredGoals.filter((g) => g.status === 'active')
  const completedGoals = filteredGoals.filter((g) => g.status === 'completed')
  const cancelledGoals = filteredGoals.filter((g) => g.status === 'cancelled')

  const displayGoals =
    showAll || modalMode === 'edit'
      ? filteredGoals
      : activeGoals

  const handleSave = (data: GoalCreate | GoalUpdate) => {
    if (modalMode === 'create') {
      createMutation.mutate(data as GoalCreate)
    } else if (modalMode === 'edit' && editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data })
    }
  }

  const handleDelete = () => {
    if (deletingGoal) {
      deleteMutation.mutate(deletingGoal.id)
    }
  }

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal)
    setModalMode('edit')
  }

  const openCreateModal = () => {
    setEditingGoal(undefined)
    setModalMode('create')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingGoal(undefined)
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Цели</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Желаемые результаты в сферах жизни
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              Все статусы
            </label>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition"
            >
              + Добавить цель
            </button>
          </div>
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
            Ошибка загрузки:{' '}
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {/* Секция активных целей */}
        {!isLoading && !isError && displayGoals.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {filterCode
              ? 'Нет целей в этой сфере'
              : 'Цели пока не добавлены. Нажмите "+ Добавить цель"'}
          </div>
        )}

        {!isLoading && !isError && displayGoals.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {displayGoals.map((goal) => (
              <div
                key={goal.id}
                className={cn(
                  'bg-white rounded-xl shadow-sm border p-5 flex flex-col gap-3',
                  goal.status === 'completed' && 'border-blue-200',
                  goal.status === 'cancelled' && 'border-gray-200 opacity-60',
                )}
              >
                {/* Верхняя строка: код сферы + статус */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-lg">
                      {goal.sphere_code}
                    </span>
                    <div>
                      <h3 className="font-medium text-gray-900">{goal.title}</h3>
                      <p className="text-xs text-gray-400">{goal.sphere_name}</p>
                    </div>
                  </div>
                  <StatusBadge status={goal.status} />
                </div>

                {/* Делайн */}
                {goal.deadline && (
                  <div className="text-xs text-gray-500">
                    Срок:{' '}
                    {new Date(goal.deadline).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                )}

                {/* Прогресс */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Прогресс</span>
                    <span>{Math.round(goal.progress)}%</span>
                  </div>
                  <ProgressBar value={goal.progress} />
                </div>

                {/* Индикатор активных проектов */}
                {goal.has_active_projects && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Есть активные проекты
                  </div>
                )}

                {/* Кнопки действий */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(goal)}
                    className="flex-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    Редактировать
                  </button>
                  {goal.status === 'active' && (
                    <button
                      onClick={() => setDeletingGoal(goal)}
                      className="flex-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                    >
                      Отменить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Секция завершённых и отменённых (если showAll) */}
        {showAll && (completedGoals.length > 0 || cancelledGoals.length > 0) && (
          <div className="mt-8 space-y-2">
            {completedGoals.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-blue-600 mb-3">
                  Завершённые ({completedGoals.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {completedGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="bg-white rounded-lg border border-blue-200 p-4 opacity-80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm">
                          {goal.sphere_code}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {goal.title}
                          </p>
                          <p className="text-xs text-gray-400">
                            Прогресс: {Math.round(goal.progress)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cancelledGoals.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-3 mt-6">
                  Отменённые ({cancelledGoals.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {cancelledGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded bg-gray-50 text-gray-500 font-bold flex items-center justify-center text-sm">
                          {goal.sphere_code}
                        </span>
                        <p className="text-sm text-gray-500 line-through">
                          {goal.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальные окна */}
      <GoalFormModal
        mode={modalMode === 'create' ? 'create' : 'edit'}
        goal={editingGoal}
        spheres={spheres}
        open={modalMode !== null}
        onClose={closeModal}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmModal
        goal={deletingGoal}
        open={deletingGoal !== null}
        onClose={() => setDeletingGoal(null)}
        onConfirm={handleDelete}
        isDeleting={deleteMutation.isPending}
      />
    </main>
  )
}
