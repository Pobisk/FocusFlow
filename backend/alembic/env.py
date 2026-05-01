"""Alembic environment configuration for SQLModel + async PostgreSQL."""

import asyncio
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool, Connection
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
    Converts any postgresql:// or postgresql+asyncpg:// to postgresql+psycopg2://
    """
    url = str(settings.database_url)
    # Конвертируем любой postgresql-вариант в синхронный psycopg2
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    elif url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://")
    return url  # если уже psycopg2 или другой драйвер — возвращаем как есть


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection)."""
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
    """Run migrations in 'online' mode (with DB connection) - SYNC version."""
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    
    # ✅ Используем синхронный engine_from_config + psycopg2
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
    run_migrations_online()  # ✅ Убрали asyncio.run() — миграции синхронные
