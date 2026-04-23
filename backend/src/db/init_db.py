"""Database initialization utilities: create tables, seed data, run migrations."""

import asyncio
import sys
from pathlib import Path

import structlog
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlmodel import SQLModel

from core.config import settings
from db.session import async_engine, sync_engine

logger = structlog.get_logger(__name__)


async def create_tables() -> None:
    """
    Create all database tables from SQLModel metadata.
    
    ⚠️ Use only in development! For production, use Alembic migrations.
    """
    logger.info("🔧 Creating database tables...")
    
    async with async_engine.begin() as conn:
        # Create all tables that don't exist yet
        await conn.run_sync(SQLModel.metadata.create_all)
    
    logger.info("✅ Tables created successfully")


async def drop_tables() -> None:
    """
    Drop all database tables.
    
    ⚠️ DANGEROUS: Use only in development/testing environments!
    """
    if not settings.is_dev:
        logger.error("❌ drop_tables() is only allowed in development mode")
        raise RuntimeError("Cannot drop tables in production environment")
    
    logger.warning("⚠️ Dropping ALL database tables...")
    
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    
    logger.warning("✅ All tables dropped")


async def seed_initial_data() -> None:
    """
    Insert initial/seed data into the database.
    
    Extend this function with your actual seed data logic.
    """
    logger.info("🌱 Seeding initial data...")
    
    # Example: import your models here
    # from models.user import User
    # from sqlmodel import select
    
    async with async_engine.begin() as conn:
        # Example seed logic (commented out):
        # result = await conn.run_sync(
        #     lambda session: session.exec(select(User).where(User.email == "admin@example.com")).first()
        # )
        # if not result:
        #     admin = User(email="admin@example.com", full_name="Admin", is_active=True)
        #     session.add(admin)
        #     await session.commit()
        #     logger.info("✅ Created admin user")
        pass  # TODO: Add your seed data here
    
    logger.info("✅ Seed data completed")


def run_alembic_upgrade(revision: str = "head") -> None:
    """
    Run Alembic migrations programmatically.
    
    Args:
        revision: Target revision (default: "head" for latest)
    """
    logger.info(f"🔄 Running Alembic migration to {revision}...")
    
    # Find alembic.ini relative to this file
    alembic_cfg = AlembicConfig(
        Path(__file__).parent.parent.parent / "alembic.ini"
    )
    
    # Override database URL to use sync driver for Alembic
    alembic_cfg.set_main_option(
        "sqlalchemy.url",
        str(settings.database_url).replace("postgresql://", "postgresql+psycopg2://")
    )
    
    # Run upgrade
    command.upgrade(alembic_cfg, revision)
    
    logger.info(f"✅ Migrations completed: {revision}")


async def init_db(create: bool = True, seed: bool = True, migrate: bool = True) -> None:
    """
    Full database initialization pipeline.
    
    Args:
        create: Create tables if they don't exist (dev only)
        seed: Insert initial seed data
        migrate: Run Alembic migrations before other operations
    """
    logger.info("🚀 Starting database initialization...", 
                create=create, seed=seed, migrate=migrate)
    
    try:
        # Step 1: Run migrations (production-safe way to update schema)
        if migrate and not settings.is_dev:
            run_alembic_upgrade()
        
        # Step 2: Create tables (development convenience)
        if create and settings.is_dev:
            await create_tables()
        
        # Step 3: Seed initial data
        if seed:
            await seed_initial_data()
        
        logger.info("✅ Database initialization completed successfully")
        
    except Exception as e:
        logger.error("❌ Database initialization failed", error=str(e), exc_info=True)
        raise


# ── CLI Interface ──────────────────────────────────────────────────

async def cli_main() -> int:
    """
    Command-line interface for database operations.
    
    Usage:
        python -m src.db.init_db --create --seed
        python -m src.db.init_db --migrate
        python -m src.db.init_db --reset  # DANGER: drops all tables first
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="FocusFlow Database Utilities")
    parser.add_argument("--create", action="store_true", help="Create tables from models")
    parser.add_argument("--seed", action="store_true", help="Insert seed data")
    parser.add_argument("--migrate", action="store_true", help="Run Alembic migrations")
    parser.add_argument("--reset", action="store_true", help="⚠️ DROP ALL TABLES then recreate (dev only!)")
    parser.add_argument("--no-migrate", action="store_true", help="Skip migrations")
    
    args = parser.parse_args()
    
    # Handle dangerous reset operation
    if args.reset:
        if not settings.is_dev:
            logger.error("❌ --reset is only allowed in development mode")
            return 1
        await drop_tables()
        args.create = True  # Automatically recreate after drop
    
    # Default: run full init if no specific flags
    if not any([args.create, args.seed, args.migrate, args.reset]):
        args.create = args.seed = True
        args.migrate = not args.no_migrate
    
    try:
        await init_db(
            create=args.create,
            seed=args.seed,
            migrate=args.migrate
        )
        return 0
    except Exception as e:
        logger.error("Initialization failed", error=str(e))
        return 1


def main() -> int:
    """Entry point for CLI: python -m src.db.init_db"""
    return asyncio.run(cli_main())


# Allow running as module: python -m src.db.init_db
if __name__ == "__main__":
    sys.exit(main())
