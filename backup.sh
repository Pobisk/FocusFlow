#!/bin/bash
#===============================================================================
# FocusFlow — PostgreSQL Backup Script
# Запуск: ./backup.sh
# Cron: 0 3 * * * /path/to/backup.sh >> /var/log/focusflow-backup.log 2>&1
#===============================================================================

set -euo pipefail

# ── Конфигурация ─────────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%F_%H%M)
BACKUP_FILE="focusflow_${TIMESTAMP}.dump"

# Загружаем переменные из .env (если есть)
if [[ -f "${PROJECT_DIR}/.env" ]]; then
    set -a
    source "${PROJECT_DIR}/.env"
    set +a
fi

# ── Проверки ─────────────────────────────────────────────────────────────────
if [[ -z "${DB_USER:-}" || -z "${DB_PASSWORD:-}" || -z "${DB_NAME:-}" ]]; then
    echo "❌ Ошибка: не заданы DB_USER, DB_PASSWORD или DB_NAME в .env"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^focusflow-postgres$"; then
    echo "❌ Контейнер focusflow-postgres не запущен"
    exit 1
fi

# Создаём папку бэкапов, если нет
mkdir -p "${BACKUP_DIR}"

# ── Бэкап ────────────────────────────────────────────────────────────────────
echo "📦 [$(date '+%Y-%m-%d %H:%M:%S')] Начало бэкапа: ${BACKUP_FILE}"

docker exec focusflow-postgres pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -F c \          # custom format (сжатый, поддерживает параллельное восстановление)
    -Z 6 \          # уровень сжатия (0-9)
    --no-owner \    # не восстанавливать владельца (удобно при миграции)
    --no-acl \      # не восстанавливать права доступа
    -f "/backups/${BACKUP_FILE}"

# Проверка, что файл создан и не пустой
if [[ ! -s "${BACKUP_DIR}/${BACKUP_FILE}" ]]; then
    echo "❌ Ошибка: файл бэкапа пустой или не создан"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "✅ Бэкап создан: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Ротация: удаляем старые бэкапы ───────────────────────────────────────────
echo "🗑 Удаление бэкапов старше ${RETENTION_DAYS} дней..."
find "${BACKUP_DIR}" -name "focusflow_*.dump" -type f -mtime +${RETENTION_DAYS} -delete

# Показать список оставшихся бэкапов
echo "📋 Текущие бэкапы:"
ls -lh "${BACKUP_DIR}"/focusflow_*.dump 2>/dev/null || echo "   (нет бэкапов)"

echo "✨ [$(date '+%Y-%m-%d %H:%M:%S')] Бэкап завершён успешно"
