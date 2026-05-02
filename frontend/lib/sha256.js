/**
 * Вычисление SHA-256 хэша строки с использованием Web Crypto API.
 * 
 * @param {string} message - исходная строка (пароль)
 * @returns {Promise<string>} хэш в виде hex-строки (64 символа, нижний регистр)
 * 
 * @example
 * const hash = await sha256('my_password');
 * console.log(hash); // "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
 */
export async function sha256(message) {
  // Кодируем строку в UTF-8 байты
  const msgBuffer = new TextEncoder().encode(message);
  
  // Вычисляем хэш через Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  
  // Конвертируем ArrayBuffer в hex-строку
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}
