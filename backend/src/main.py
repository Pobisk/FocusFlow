"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import structlog

from core.config import settings, get_settings
from core.scheduler import create_scheduler, start_scheduler, shutdown_scheduler
from db.session import async_engine, sync_engine
from models.base import BaseModel
from api.v1.endpoints import health

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger("info"),
)

logger = structlog.get_logger(__name__)

# Global scheduler instance
scheduler = create_scheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # ── Startup ─────────────────────────────────────
    logger.info("🚀 Starting FocusFlow API", environment=settings.environment)
    
    # Create tables on startup (for development only)
    if settings.is_dev:
        logger.info("🔧 Dev mode: creating DB tables")
        async with async_engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
    
    # Start scheduler
    start_scheduler(scheduler)
    
    yield  # Application runs here
    
    # ── Shutdown ────────────────────────────────────
    logger.info("🛑 Shutting down FocusFlow API")
    shutdown_scheduler(scheduler)
    await async_engine.dispose()
    sync_engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="FocusFlow API",
    description="Personal productivity assistant with data analysis and notifications",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── Middleware ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────
app.include_router(health.router, prefix="/api/v1")

# Root redirect to docs
@app.get("/", include_in_schema=False)
async def root():
    return {"message": "FocusFlow API", "docs": "/api/docs"}


# For testing: expose app variable
__all__ = ["app"]
