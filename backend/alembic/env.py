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
    Priority: DATABASE_URL env var > settings.database_url
    """
        
    # 1. Приоритет: переменная окружения (для Docker/CI)
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        # Нормализуем: asyncpg → psycopg2 для синхронных миграций Alembic
        return env_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://") \
                     .replace("postgresql://", "postgresql+psycopg2://")
    
    # 2. Фолбэк: настройки из pydantic
    url = str(settings.database_url)
    return url.replace("postgresql://", "postgresql+psycopg2://")


def run_migrations_offline() -> None:
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
