import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGoals,
  getGoalStatuses,
  createGoal,
  updateGoal,
  deleteGoal,
  getSpheres,
  type Goal,
  type GoalCreate,
  type GoalUpdate,
  type Sphere,
  type GoalStatusRef,
} from '@/lib/api'
import { SphereFilter } from '@/components/SphereFilter'
import { cn, dateOnlyToUTC, utcToDateOnly, formatDateLocal } from '@/lib/utils'

// ── Конфигурация цветов для статусов (запас на случай отсутствия в справочнике) ──

const STATUS_COLORS: Record<number, string> = {
  1: '#22c55e', // active
  2: '#3b82f6', // completed
  3: '#ef4444', // cancelled
}

const STATUS_LABELS: Record<number, string> = {
  1: 'Активна',
  2: 'Завершена',
  3: 'Отменена',
}

// ── Компонент бейджа статуса ─────────────────────────

function StatusBadge({
  statusId,
  statusName,
  statusColor,
}: {
  statusId: number
  statusName: string
  statusColor: string | null
}) {
  const color = statusColor ?? STATUS_COLORS[statusId] ?? '#6b7280'
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}18`,
        color: color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {statusName}
    </span>
  )
}

// ── Модальное окно ───────────────────────────────────

interface GoalFormModalProps {
  mode: 'create' | 'edit'
  goal?: Goal
  spheres: Sphere[]
  statuses: GoalStatusRef[]
  open: boolean
  onClose: () => void
  onSave: (data: GoalCreate | GoalUpdate) => void
  isSaving: boolean
}

function GoalFormModal({
  mode,
  goal,
  spheres,
  statuses,
  open,
  onClose,
  onSave,
  isSaving,
}: GoalFormModalProps) {
  const [sphereId, setSphereId] = useState(goal?.sphere_id ?? spheres[0]?.id ?? '')
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [statusId, setStatusId] = useState(goal?.status_id ?? 1)

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
      setStatusId(goal?.status_id ?? 1)
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
        deadline: deadline || null,
      } satisfies GoalCreate)
    } else {
      const data: GoalUpdate = {}
      if (sphereId !== goal?.sphere_id) data.sphere_id = sphereId
      if (title !== goal?.title) data.title = title.trim()
      if (description !== (goal?.description ?? ''))
        data.description = description.trim() || null
            if ((deadline || null) !== (goal?.deadline ?? null))
        data.deadline = deadline || null
      if (statusId !== goal?.status_id) data.status_id = statusId
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
          {/* Сфера */}
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

          {/* Название */}
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

          {/* Описание */}
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

          {/* Срок */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Срок достижения
            </label>
                        <input
              type="date"
              value={deadline ? utcToDateOnly(deadline) : ''}
              onChange={(e) => {
                const val = e.target.value
                if (!val) { setDeadline(''); return }
                setDeadline(dateOnlyToUTC(val))
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Статус (только в режиме редактирования) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Можно вернуть в работу отменённую или завершённую цель
              </p>
            </div>
          )}

          {/* Кнопки */}
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

// ── Диалог подтверждения отмены ──────────────────────

function ConfirmCancelModal({
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
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)

  // Сферы
  const { data: spheres = [] } = useQuery({
    queryKey: ['spheres'],
    queryFn: getSpheres,
  })

  // Статусы из справочника
  const { data: statuses = [] } = useQuery({
    queryKey: ['goalStatuses'],
    queryFn: getGoalStatuses,
  })

  // Цели
  const { data: goals = [], isLoading, isError, error } = useQuery({
    queryKey: ['goals', showAll, statusFilter],
    queryFn: () => getGoals({ show_all: showAll, status_id: statusFilter }),
  })

  // Мутации
  const createMutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setModalMode(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GoalUpdate }) =>
      updateGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setModalMode(null)
      setEditingGoal(undefined)
    },
  })

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

  const handleSave = (data: GoalCreate | GoalUpdate) => {
    if (modalMode === 'create') {
      createMutation.mutate(data as GoalCreate)
    } else if (modalMode === 'edit' && editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data })
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

  const handleCancelGoal = () => {
    if (deletingGoal) {
      updateMutation.mutate({
        id: deletingGoal.id,
        data: { status_id: 3 },
      })
      setDeletingGoal(null)
    }
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

        {/* Фильтры */}
        <div className="mb-6 space-y-3">
          <SphereFilter
            spheres={spheres}
            selected={filterCode}
            onSelect={(code) => {
              setFilterCode(code)
              setStatusFilter(undefined)
              setShowAll(false)
            }}
          />

          {/* Быстрые фильтры по статусу (поверх показа "все") */}
          {showAll && statuses.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter(undefined)}
                className={cn(
                  'px-3 py-1 text-xs rounded-full border transition',
                  statusFilter === undefined
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
                )}
              >
                Все
              </button>
              {statuses.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition',
                    statusFilter === s.id
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
                  )}
                  style={
                    statusFilter === s.id
                      ? {
                          backgroundColor: s.color ?? STATUS_COLORS[s.id] ?? '#6b7280',
                        }
                      : undefined
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Состояния */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        )}

        {isError && (
          <div className="text-center py-12 text-red-500">
            Ошибка загрузки:{' '}
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
        )}

        {!isLoading && !isError && filteredGoals.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {filterCode
              ? 'Нет целей в этой сфере'
              : 'Цели пока не добавлены. Нажмите "+ Добавить цель"'}
          </div>
        )}

        {!isLoading && !isError && filteredGoals.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredGoals.map((goal) => {
              const color = goal.status_color ?? STATUS_COLORS[goal.status_id] ?? '#6b7280'
              const isActive = goal.status_id === 1
              const isCancelled = goal.status_id === 3

              return (
                <div
                  key={goal.id}
                  className={cn(
                    'bg-white rounded-xl shadow-sm border p-5 flex flex-col gap-3 transition',
                    isCancelled && 'opacity-60',
                  )}
                  style={{
                    borderColor: isActive ? `${color}40` : undefined,
                  }}
                >
                  {/* Верхняя строка: код сферы + статус */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-10 h-10 rounded-lg font-bold flex items-center justify-center text-lg"
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
                        }}
                      >
                        {goal.sphere_code}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900">{goal.title}</h3>
                        <p className="text-xs text-gray-400">{goal.sphere_name}</p>
                      </div>
                    </div>
                    <StatusBadge
                      statusId={goal.status_id}
                      statusName={goal.status_name}
                      statusColor={goal.status_color}
                    />
                  </div>

                  {/* Описание */}
                  {goal.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {goal.description}
                    </p>
                  )}

                  {/* Дедлайн */}
                                    {goal.deadline && (
                    <div className="text-xs text-gray-500">
                      Срок: {formatDateLocal(goal.deadline)}
                    </div>
                  )}

                  {/* Кнопки действий */}
                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <button
                      onClick={() => openEditModal(goal)}
                      className="flex-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      {isActive ? 'Редактировать' : 'Открыть'}
                    </button>
                    {isActive && (
                      <button
                        onClick={() => setDeletingGoal(goal)}
                        className="flex-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                      >
                        Отменить
                      </button>
                    )}
                    {goal.status_id === 2 && (
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: goal.id,
                            data: { status_id: 1 },
                          })
                        }
                        className="flex-1 px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition"
                      >
                        Вернуть в работу
                      </button>
                    )}
                    {goal.status_id === 3 && (
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: goal.id,
                            data: { status_id: 1 },
                          })
                        }
                        className="flex-1 px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition"
                      >
                        Вернуть в работу
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Модальные окна */}
      <GoalFormModal
        mode={modalMode === 'create' ? 'create' : 'edit'}
        goal={editingGoal}
        spheres={spheres}
        statuses={statuses}
        open={modalMode !== null}
        onClose={closeModal}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmCancelModal
        goal={deletingGoal}
        open={deletingGoal !== null}
        onClose={() => setDeletingGoal(null)}
        onConfirm={handleCancelGoal}
        isDeleting={false}
      />
    </main>
  )
}
