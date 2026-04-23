"""Sample scheduled task for APScheduler."""

import structlog
from sqlmodel import select

from db.session import get_sync_session
from models.base import BaseModel

logger = structlog.get_logger(__name__)


def analyze_user_data() -> None:
    """
    Sample task: runs every 5 minutes.
    
    Replace with your actual data analysis logic.
    """
    logger.info("🔄 Starting scheduled task: analyze_user_data")
    
    try:
        # Example: get sync session and query data
        with get_sync_session() as session:
            # stmt = select(User).where(User.is_active == True)
            # users = session.exec(stmt).all()
            # ... process users ...
            logger.info("✅ Data analysis completed", count=0)  # placeholder
            
    except Exception as e:
        logger.error("❌ Task failed", error=str(e), exc_info=True)
        raise  # Re-raise to let APScheduler handle retries/logging


def send_notifications() -> None:
    """Sample task: send notifications to users."""
    logger.info("🔔 Starting notification task")
    # TODO: Implement notification logic
    logger.info("✅ Notifications sent")
