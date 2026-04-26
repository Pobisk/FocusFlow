"""Health check endpoint for monitoring and load balancers."""

from fastapi import APIRouter, Depends, status
from sqlmodel import text
from sqlalchemy.exc import SQLAlchemyError

from db.session import get_db
from core.config import settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", status_code=status.HTTP_200_OK)
async def health_check(db=Depends(get_db)):
    """
    Comprehensive health check:
    - API status
    - Database connectivity
    - Environment info (non-sensitive)
    """
    health = {
        "status": "healthy",
        "environment": settings.environment,
        "database": "unknown",
    }
    
    # Check database connection
    try:
        await db.execute(text("SELECT 1"))
        health["database"] = "connected"
    except SQLAlchemyError as e:
        health["status"] = "degraded"
        health["database"] = f"error: {str(e)[:50]}"
    
    # Return appropriate status code
    status_code = status.HTTP_200_OK if health["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    
    return health


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check():
    """
    Readiness probe: is the app ready to receive traffic?
    Use for Kubernetes readinessProbe or load balancer checks.
    """
    return {"ready": True}
