# syntax=docker/dockerfile:1
# backend/Dockerfile — оптимизированная версия

# ── Стадия сборки зависимостей ─────────────────────────────
FROM python:3.12-slim-bookworm AS builder

# Аргументы для кастомизации (опционально)
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

# Обновляем pip один раз
RUN pip install --upgrade pip

# Копируем ТОЛЬКО requirements.txt для кеширования слоя
COPY requirements.txt .

# Устанавливаем пакеты во временную директорию
RUN pip install --prefix="${INSTALL_DIR}" -r requirements.txt


# ── Финальная стадия (runtime) ─────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

# Аргументы и переменные
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

# 🔥 Единая установка runtime-зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \          # runtime-зависимость для psycopg2
    curl \            # для HEALTHCHECK
    tini \            # init-система для корректной обработки сигналов
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    # Создаем не-root пользователя
    && useradd --no-log-init --create-home --uid ${APP_UID} ${APP_USER}

# 🔥 Копируем установленные пакеты из builder
ARG INSTALL_DIR=/install
COPY --from=builder ${INSTALL_DIR} /usr/local

# 🔥 Копируем исходный код ОДНОЙ командой (убираем дублирование --chown)
COPY --chown=${APP_USER}:${APP_USER} \
    src/ ./src/ \
    alembic/ ./alembic/ \
    alembic.ini .env.example ./

# 🔥 Устанавливаем tini как entrypoint для правильного завершения процессов
ENTRYPOINT ["/usr/bin/tini", "--"]

# 🔥 HEALTHCHECK с корректным путем (через PYTHONPATH)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8000/api/health || exit 1

EXPOSE 8000

# Переключаемся на не-root пользователя ПОСЛЕ всех root-операций
USER ${APP_USER}

# 🔥 Исправленный CMD:
# - uvicorn ищет приложение как "модуль:переменная"
# - Благодаря PYTHONPATH=/app/src, "main:app" находит src/main.py
# - А внутри main.py "from core.config" тоже работает, т.к. core в том же src/
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
