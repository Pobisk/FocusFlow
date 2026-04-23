"""Database session management with SQLModel."""

from sqlmodel import create_engine, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from core.config import settings

# Sync engine for Alembic migrations
sync_engine = create_engine(
    str(settings.database_url).replace("postgresql://", "postgresql+psycopg2://"),
    pool_pre_ping=True,
    echo=settings.is_dev,
)

# Async engine for application runtime
async_engine = create_async_engine(
    str(settings.database_url).replace("postgresql://", "postgresql+asyncpg://"),
    pool_pre_ping=True,
    echo=settings.is_dev,
)

# Async session factory
async_session_maker = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency for FastAPI routes: yields async DB session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_session() -> Session:
    """Get sync session for APScheduler tasks (non-async context)."""
    return Session(sync_engine)
