#!/bin/bash
#===============================================================================
# FocusFlow — PostgreSQL Backup Script
# Запуск: ./backup.sh
# Cron: 0 3 * * * /opt/focusflow/backup.sh >> /var/log/focusflow-backup.log 2>&1
#===============================================================================

set -euo pipefail

# ── Конфигурация ─────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%F_%H%M)
BACKUP_FILE="focusflow_${TIMESTAMP}.dump"

# ── Загрузка переменных окружения из .env ─────────────────────────────────────
# Надёжный способ: игнорируем комментарии и пустые строки
if [[ -f "${PROJECT_DIR}/.env" ]]; then
    # Экспортируем только переменные в формате KEY=value (без export, без комментариев)
    while IFS='=' read -r key value; do
        # Пропускаем пустые строки и комментарии
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # Убираем возможные кавычки и пробелы вокруг =
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs | sed 's/^["'\'']//; s/["'\'']$//')
        export "$key=$value"
    done < "${PROJECT_DIR}/.env"
fi

# ── Валидация обязательных переменных ─────────────────────────────────────────
: "${DB_USER:?Ошибка: переменная DB_USER не задана в .env}"
: "${DB_PASSWORD:?Ошибка: переменная DB_PASSWORD не задана в .env}"
: "${DB_NAME:?Ошибка: переменная DB_NAME не задана в .env}"

# Проверка на пробелы в критичных переменных (могут сломать pg_dump)
for var in DB_USER DB_NAME; do
    val="${!var}"
    if [[ "$val" =~ [[:space:]] ]]; then
        echo "❌ Ошибка: $var содержит пробелы: [$val]" >&2
        echo "   Используйте только a-z, 0-9, _ без пробелов" >&2
        exit 1
    fi
done

# ── Проверка, что контейнер запущен ──────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^focusflow-postgres$"; then
    echo "❌ Контейнер focusflow-postgres не запущен" >&2
    exit 1
fi

# ── Создание директории для бэкапов ──────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Отладочный вывод (можно закомментировать в продакшене) ───────────────────
# echo "[DEBUG] DB_USER=[${DB_USER}] DB_NAME=[${DB_NAME}]" >&2

# ── Выполнение бэкапа ────────────────────────────────────────────────────────
echo "📦 [$(date '+%Y-%m-%d %H:%M:%S')] Начало бэкапа: ${BACKUP_FILE}"

# Формат -Fc: сжатый custom-format (поддерживает параллельное восстановление)
# -Z6: уровень сжатия (0-9)
# --no-owner / --no-acl: для удобства восстановления на другом сервере
if ! docker exec focusflow-postgres pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -Fc \
    -Z6 \
    --no-owner \
    --no-acl \
    -f "/backups/${BACKUP_FILE}" 2>&1; then
    echo "❌ Ошибка: pg_dump вернул код выхода $?" >&2
    exit 1
fi

# ── Валидация результата ─────────────────────────────────────────────────────
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

if [[ ! -f "${BACKUP_PATH}" ]]; then
    echo "❌ Ошибка: файл бэкапа не создан: ${BACKUP_PATH}" >&2
    echo "🔍 Проверяем содержимое /backups внутри контейнера:" >&2
    docker exec focusflow-postgres ls -la /backups/ >&2 || true
    exit 1
fi

if [[ ! -s "${BACKUP_PATH}" ]]; then
    echo "❌ Ошибка: файл бэкапа пустой: ${BACKUP_PATH}" >&2
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
echo "✅ Бэкап создан: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Ротация: удаление старых бэкапов ─────────────────────────────────────────
echo "🗑 Удаление бэкапов старше ${RETENTION_DAYS} дней..."
find "${BACKUP_DIR}" -name "focusflow_*.dump" -type f -mtime +${RETENTION_DAYS} -delete -print

# ── Итоговый отчёт ───────────────────────────────────────────────────────────
echo "📋 Текущие бэкапы:"
ls -lh "${BACKUP_DIR}"/focusflow_*.dump 2>/dev/null || echo "   (нет бэкапов)"

echo "✨ [$(date '+%Y-%m-%d %H:%M:%S')] Бэкап завершён успешно"
exit 0
