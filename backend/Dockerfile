# backend/Dockerfile — ИСПРАВЛЕННАЯ ВЕРСИЯ
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first (separate layer for better caching)
RUN pip install --no-cache-dir --upgrade pip hatchling

# Copy ONLY dependency files first (for better Docker cache)
COPY pyproject.toml ./
# Если есть requirements.txt как бэкап — раскомментируйте:
# COPY requirements.txt ./

# Install dependencies in isolated prefix
# Используем pip install . вместо -e . для Docker-сборки
RUN pip install --no-cache-dir --prefix=/install .

# Optional dev dependencies (only if needed in build stage)
# RUN pip install --no-cache-dir --prefix=/install ".[dev]"

# ── Runtime stage ───────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 appuser

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code (AFTER installing deps for better caching)
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser alembic.ini .env.example ./
# Также скопируйте pyproject.toml для runtime-валидации
COPY --chown=appuser:appuser pyproject.toml ./

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000

# Для продакшена уберите --reload и добавьте workers
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
