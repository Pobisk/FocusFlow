"""Alembic environment configuration for SQLModel + async PostgreSQL."""

import os
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from core.config import settings

from models import BaseModel  # __init__.py уже импортировал все модели внутрь
# Это заставит Python загрузить __init__.py → все модели зарегистрируются
__import__("models", fromlist=["__all__"])

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate'
target_metadata = BaseModel.metadata


def get_url() -> str:
    """
    Get database URL with psycopg2 driver for Alembic (sync).
    Reads directly from environment to avoid Pydantic caching issues.
    """
    # Читаем напрямую из окружения — надёжнее, чем через settings
    url = os.getenv("DATABASE_URL")
    
    if not url:
        # Фоллбэк: если нет в окружении, берём из settings
        url = str(settings.database_url)
    
    if not url or url.startswith("driver://"):
        # Фоллбэк: если всё ещё заглушка — берём из alembic.ini и конвертируем
        url = config.get_main_option("sqlalchemy.url")
    
    # Конвертируем любой postgresql-вариант в синхронный psycopg2
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    elif url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://")
    
    return url  # если уже psycopg2 или другой драйвер


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode - SYNC version with psycopg2."""
    # ✅ Сначала устанавливаем URL, потом получаем секцию

    url = get_url()
    print(f"🔍 [DEBUG] Final URL for Alembic: {url}")  # ← добавьте эту строку
    
    config.set_main_option("sqlalchemy.url", get_url())
    
    configuration = config.get_section(config.config_ini_section) or {}
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
