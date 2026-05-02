'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sha256 } from '@/lib/sha256';
import { authLogin } from '@/lib/api';

export default function LoginForm() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  /**
   * Валидация полей формы
   * @returns {string|null} Сообщение об ошибке или null, если всё ок
   */
  const validate = () => {
    if (!login.trim()) return 'Введите логин';
    if (login.trim().length < 3) return 'Логин должен содержать минимум 3 символа';
    if (!password) return 'Введите пароль';
    if (password.length < 6) return 'Пароль должен содержать минимум 6 символов';
    return null;
  };

  /**
   * Обработчик отправки формы
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Валидация
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    try {
      // Вычисляем SHA-256 хэш пароля
      const passwordHash = await sha256(password);
      
      // Вызываем API авторизации
      const result = await authLogin(login.trim(), passwordHash);
      
      // Сохраняем сессию в localStorage
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('user_name', result.name);
      
      // Переход на рабочий экран + обновление роутера
      router.push('/workspace');
      router.refresh();
      
    } catch (err) {
      // Безопасное извлечение сообщения об ошибке
      const errorMessage = 
        err instanceof Error ? err.message : 
        typeof err === 'string' ? err : 
        'Ошибка авторизации';
        
      setError(errorMessage);
      console.error('Login error:', err);
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      {/* Блок ошибки */}
      {error && (
        <div 
          className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
      
      {/* Поле логина */}
      <div>
        <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">
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
      
      {/* Поле пароля */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
      
      {/* Кнопка входа */}
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
        ) : 'Войти'}
      </button>
    </form>
  );
}
