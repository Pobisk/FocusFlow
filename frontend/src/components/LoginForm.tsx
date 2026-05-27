import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sha256 } from '@/lib/sha256'
import { authLogin } from '@/lib/api'
import { setSession } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface LoginFormProps {
  className?: string
}

export function LoginForm({ className }: LoginFormProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validate = (): string | null => {
    if (!login.trim()) return 'Введите логин'
    if (login.trim().length < 3) return 'Логин должен содержать минимум 3 символа'
    if (!password) return 'Введите пароль'
    if (password.length < 6) return 'Пароль должен содержать минимум 6 символов'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const passwordHash = await sha256(password)
      const result = await authLogin(login.trim(), passwordHash)

      setSession(result.access_token, result.name)
      navigate('/workspace')
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Ошибка авторизации'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4 max-w-md mx-auto', className)}
    >
      {error && (
        <div
          className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="login"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Логин
        </label>
        <input
          id="login"
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          disabled={loading}
          placeholder="Введите логин"
          autoComplete="username"
          required
          minLength={3}
          maxLength={100}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Пароль
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          disabled={loading}
          placeholder="Введите пароль"
          autoComplete="current-password"
          required
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 
                   focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 
                   disabled:cursor-not-allowed transition font-medium"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Вход...
          </span>
        ) : (
          'Войти'
        )}
      </button>
    </form>
  )
}
