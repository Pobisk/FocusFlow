import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserName, clearSession } from '@/lib/auth'
import { selectWorkTask } from '@/lib/api'
import { dateOnlyToUTC, getTodayLocalDate } from '@/lib/utils'

export function WorkspacePage() {
  const [userName, setUserName] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const name = getUserName()
    if (!name) {
      navigate('/', { replace: true })
      return
    }
    setUserName(name)
  }, [navigate])

  const handleLogout = () => {
    clearSession()
    navigate('/', { replace: true })
  }

  const handleWorkClick = async () => {
    if (isSelecting) return
    setIsSelecting(true)
    try {
      const localDateStr = getTodayLocalDate()
      const todayUtc = dateOnlyToUTC(localDateStr)
      const result = await selectWorkTask(todayUtc)
      if (result.task_id) {
        navigate(`/work?task_id=${result.task_id}`)
      } else {
        // Нет подходящих задач — всё равно на work, там покажет "Нет подходящих задач"
        navigate('/work?no_task=1')
      }
    } catch {
      // Ошибка запроса — всё равно переходим
      navigate('/work?no_task=1')
    } finally {
      setIsSelecting(false)
    }
  }

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="mx-auto" style={{ maxWidth: 'min(490px, 100%)' }}>
        <header className="mb-8 pb-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Здравствуйте, {userName}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Добро пожаловать в FocusFlow
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-100 transition"
          >
            Выйти
          </button>
        </header>

        {/* Работа */}
        <button
          onClick={handleWorkClick}
          disabled={isSelecting}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2 disabled:opacity-50"
        >
          <h3 className="font-medium text-lg">{isSelecting ? '⏳ Поиск задачи...' : '🚀 Работа'}</h3>
          <p className="text-sm text-gray-500">Рекомендованная задача для выполнения</p>
        </button>

        {/* Сегодня */}
        <button
          onClick={() => navigate('/today')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">📅 Сегодня</h3>
          <p className="text-sm text-gray-500">Задачи на сегодня и сводка по времени</p>
        </button>

        {/* Задачи */}
        <button
          onClick={() => navigate('/tasks')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">📋 Задачи</h3>
          <p className="text-sm text-gray-500">Список всех задач</p>
        </button>

        {/* Проекты */}
        <button
          onClick={() => navigate('/projects')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">📦 Проекты</h3>
          <p className="text-sm text-gray-500">Управление проектами</p>
        </button>

        {/* КНМБ */}
        <button
          onClick={() => navigate('/someday')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">💭 КНМБ</h3>
          <p className="text-sm text-gray-500">Когда-нибудь может быть</p>
        </button>

        {/* Отчёт — неактивна */}
        <div className="w-full p-4 bg-white rounded-xl shadow-sm border opacity-50 mb-2">
          <h3 className="font-medium text-lg">📊 Отчёт</h3>
          <p className="text-sm text-gray-500">Аналитика вашей продуктивности</p>
        </div>

        {/* Цели */}
        <button
          onClick={() => navigate('/goals')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">🎯 Цели</h3>
          <p className="text-sm text-gray-500">Желаемые результаты в сферах жизни</p>
        </button>

        {/* Сферы */}
        <button
          onClick={() => navigate('/spheres')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">🌐 Сферы</h3>
          <p className="text-sm text-gray-500">Управление сферами жизни</p>
        </button>

        {/* Настройки */}
        <button
          onClick={() => navigate('/settings')}
          className="w-full p-4 bg-white rounded-xl shadow-sm border text-left hover:shadow-md hover:border-primary/30 transition cursor-pointer mb-2"
        >
          <h3 className="font-medium text-lg">⚙️ Настройки</h3>
          <p className="text-sm text-gray-500">Параметры алгоритмов и интерфейса</p>
        </button>
      </div>
    </main>
  )
}
