#!/bin/bash
#===============================================================================
# FocusFlow — PostgreSQL Backup Script (FIXED)
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

mkdir -p "${BACKUP_DIR}"

# ── Бэкап ────────────────────────────────────────────────────────────────────
echo "📦 [$(date '+%Y-%m-%d %H:%M:%S')] Начало бэкапа: ${BACKUP_FILE}"

# Формат -Fc: сжатый custom-format, поддерживает параллельное восстановление
