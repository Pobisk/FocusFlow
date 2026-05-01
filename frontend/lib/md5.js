/**
 * Вычисление MD5 хэша строки с использованием Web Crypto API.
 * @param {string} message - исходная строка
 * @returns {Promise<string>} хэш в нижнем регистре (32 символа)
 */
export async function md5(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('MD5', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}
