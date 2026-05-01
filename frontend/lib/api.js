const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Авторизация пользователя
 * @param {string} login 
 * @param {string} passwordHash - MD5 хэш пароля
 */
export async function authLogin(login, passwordHash) {
  const response = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, hash: passwordHash }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail?.error || 'Ошибка авторизации');
  }
  
  return response.json();
}

/**
 * Универсальный fetch с автоматической подстановкой токена
 * @param {string} url - путь к endpoint (без /api)
 * @param {Object} options - опции fetch
 * @param {boolean} options.requireAuth - требовать авторизацию (по умолчанию true)
 */
export async function apiFetch(url, options = {}) {
  const { requireAuth = true, ...fetchOptions } = options;
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  
  if (requireAuth && !token) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    throw new Error('Требуется авторизация');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...fetchOptions.headers,
  };
  
  const response = await fetch(`${API_BASE}${url}`, { ...fetchOptions, headers });
  
  // Обработка истечения токена
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_name');
      window.location.href = '/';
    }
    throw new Error('Сессия истекла');
  }
  
  return response;
}
