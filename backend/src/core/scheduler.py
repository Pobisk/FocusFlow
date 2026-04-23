"""APScheduler setup with FastAPI lifecycle."""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import structlog

from tasks.sample_task import analyze_user_data, send_notifications

logger = structlog.get_logger(__name__)


def create_scheduler() -> BackgroundScheduler:
    """Create and configure APScheduler instance."""
    scheduler = BackgroundScheduler(timezone="UTC")
    
    # ── Register tasks ───────────────────────────────
    # Task 1: Run every 5 minutes
    scheduler.add_job(
        func=analyze_user_data,
        trigger=IntervalTrigger(minutes=5),
        id="analyze_user_data",
        name="Analyze user data every 5 minutes",
        replace_existing=True,
        max_instances=1,  # Prevent overlapping executions
    )
    
    # Task 2: Run every hour (example)
    scheduler.add_job(
        func=send_notifications,
        trigger=IntervalTrigger(hours=1),
        id="send_notifications",
        name="Send notifications hourly",
        replace_existing=True,
        max_instances=1,
    )
    
    return scheduler


def start_scheduler(scheduler: BackgroundScheduler) -> None:
    """Start the scheduler if not already running."""
    if not scheduler.running:
        scheduler.start()
        logger.info("🗓️ Scheduler started", jobs_count=len(scheduler.get_jobs()))


def shutdown_scheduler(scheduler: BackgroundScheduler) -> None:
    """Gracefully shutdown scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=True)
        logger.info("🛑 Scheduler shutdown complete")
