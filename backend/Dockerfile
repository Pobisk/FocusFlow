# backend/Dockerfile — РАБОЧАЯ ВЕРСИЯ с requirements.txt
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy requirements FIRST for better Docker cache
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ───────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 appuser

# Copy installed Python packages
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser alembic.ini .env.example ./

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000

# ... после копирования кода в runtime stage ...

# Optional: Run DB migrations on container start
# Раскомментируйте, если хотите авто-миграции (осторожно в production!)
# RUN python -c "from src.db.init_db import run_alembic_upgrade; run_alembic_upgrade()"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
