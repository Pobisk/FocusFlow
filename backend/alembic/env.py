"""Alembic env.py - direct engine creation, no config fallback."""

import os
import sys
from logging.config import fileConfig
from alembic import context
from sqlalchemy import create_engine, pool, MetaData

# === Импортируйте ВСЕ ваши модели здесь для autogenerate ===
# Это критично: если модель не импортирована, она не попадёт в миграцию
from models.user import User  # ← пример, замените на ваши реальные модели
from models.base import BaseModel

# Alembic Config
config = context.config
target_metadata = BaseModel.metadata

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# === 🔥 ГЛАВНОЕ: создаём URL напрямую, игнорируя alembic.ini ===
def _get_sync_url() -> str:
    """Возвращает синхронный URL для Alembic, независимо от настроек."""
    # 1. Читаем из окружения (приоритет №1)
    url = os.getenv("DATABASE_URL")
    
    # 2. Фоллбэк на settings (если окружение пусто)
    if not url:
        sys.path.insert(0, '/app')
        from core.config import settings
        url = str(settings.database_url)
    
    # 3. Конвертируем async → sync драйвер
    if url and url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    elif url and url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://")
    
    # 4. Если ничего не помогло — крашимся явно, а не с "driver://"
    if not url or url.startswith("driver://"):
        raise RuntimeError(
            f"❌ DATABASE_URL not set or invalid. Got: {url!r}. "
            "Set DATABASE_URL=postgresql+asyncpg://... in docker-compose.yml"
        )
    
    return url


# === Отладочный вывод при импорте модуля ===
_sync_url = _get_sync_url()
print(f"\n{'='*70}")
print(f"🔍 [ALEMBIC ENV LOADED]")
print(f"   Sync URL: {_sync_url[:80]}...")
print(f"   Target metadata: {target_metadata}")
print(f"{'='*70}\n")


def run_migrations_offline() -> None:
    """Offline mode — не используется в Docker, но оставим для полноты."""
    context.configure(
        url=_sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online mode — создаём engine НАПРЯМУЮ, минуя config."""
    print(f"🔍 [ONLINE] Creating engine with URL: {_sync_url[:80]}...")
    
    # ✅ Создаём engine напрямую — никаких config.get_section()!
    connectable = create_engine(_sync_url, poolclass=pool.NullPool)
    
    print(f"✅ Engine created, dialect: {connectable.dialect.name}")
    
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            print(f"🔄 Running migrations...")
            context.run_migrations()
            print(f"✅ Migrations completed")


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
