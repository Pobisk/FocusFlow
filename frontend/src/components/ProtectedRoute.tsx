import { Navigate, Outlet } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'

/**
 * Компонент-обёртка для защищённых маршрутов.
 * Если пользователь не авторизован — редирект на главную.
 */
export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
