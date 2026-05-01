# syntax=docker/dockerfile:1
# backend/Dockerfile — исправленная версия

# ── Стадия сборки зависимостей ─────────────────────────────
FROM python:3.12-slim-bookworm AS builder

ARG INSTALL_DIR=/install
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /build

# Системные зависимости для компиляции (только для builder)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install --prefix="${INSTALL_DIR}" -r requirements.txt


# ── Финальная стадия (runtime) ─────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

ARG APP_USER=appuser \
    APP_UID=1000 \
    APP_DIR=/app \
    SRC_DIR=src

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="${APP_DIR}/${SRC_DIR}" \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR ${APP_DIR}

# Runtime-зависимости: libpq5 для psycopg2, curl для healthcheck, tini как init
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && useradd --no-log-init --create-home --uid ${APP_UID} ${APP_USER}

# Копируем установленные пакеты из builder
ARG INSTALL_DIR=/install
COPY --from=builder ${INSTALL_DIR} /usr/local

# === 1. Копируем файлы по одному (все в корень /app) ===
# requirements.txt (обязательный)
COPY --chown=${APP_USER}:${APP_USER} requirements.txt ./
# pyproject.toml (если есть)
COPY --chown=${APP_USER}:${APP_USER} pyproject.toml ./
# alembic.ini (обязательный для Alembic)
COPY --chown=${APP_USER}:${APP_USER} alembic.ini ./
# .env.example (опциональный, скрытый файл)
COPY --chown=${APP_USER}:${APP_USER} .env.example ./

# === 2. Копируем директорию alembic/ отдельно ===
COPY --chown=${APP_USER}:${APP_USER} \
  alembic/ ./alembic/

# === 2. Копируем исходный код ===
COPY --chown=${APP_USER}:${APP_USER} \
  src/ ./src/
  

# Используем tini как entrypoint для корректной обработки сигналов
ENTRYPOINT ["/usr/bin/tini", "--"]

# HEALTHCHECK с корректным путем
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8000/api/health || exit 1

EXPOSE 8000

# Переключаемся на non-root пользователя
USER ${APP_USER}

# Запускаем uvicorn с правильным путем к приложению
# Благодаря PYTHONPATH=/app/src, "main:app" находит src/main.py
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
