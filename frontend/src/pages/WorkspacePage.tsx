import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserName, clearSession } from '@/lib/auth'

export function WorkspacePage() {
  const [userName, setUserName] = useState('')
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

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
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

        {/* Навигационные кнопки */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <button
            onClick={() => navigate('/settings')}
            className="p-4 bg-white rounded-lg shadow-sm border text-left hover:shadow-md transition cursor-pointer"
          >
            <h3 className="font-medium mb-1">⚙️ Настройки</h3>
            <p className="text-sm text-gray-500">
              Параметры алгоритмов и интерфейса
            </p>
          </button>
          <button
            onClick={() => navigate('/spheres')}
            className="p-4 bg-white rounded-lg shadow-sm border text-left hover:shadow-md transition cursor-pointer"
          >
            <h3 className="font-medium mb-1">🌐 Сферы</h3>
            <p className="text-sm text-gray-500">
              Управление сферами жизни
            </p>
          </button>
          <button
            onClick={() => navigate('/goals')}
            className="p-4 bg-white rounded-lg shadow-sm border text-left hover:shadow-md transition cursor-pointer"
          >
            <h3 className="font-medium mb-1">🎯 Цели</h3>
            <p className="text-sm text-gray-500">
              Желаемые результаты в сферах жизни
            </p>
          </button>
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <h3 className="font-medium mb-2">📋 Задачи</h3>
            <p className="text-sm text-gray-500">
              Скоро здесь будет список ваших задач
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <h3 className="font-medium mb-2">📊 Статистика</h3>
            <p className="text-sm text-gray-500">
              Аналитика вашей продуктивности
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

